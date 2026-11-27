// nct-wl-bridge — wlr-foreign-toplevel <-> one-line TCP
// protocol for the shell's WindowTransformer stack.
//
// Marker: NCT-WL-BRIDGE. Layer: services.
//
// Why this exists: the shell (Godot) needs to shade, restore
// and close FOREIGN windows — surfaces owned by the compositor
// (labwc), not by the shell. Wayland gives a client exactly
// one handle on other clients' windows: the
// wlr-foreign-toplevel management protocol, which labwc
// implements (its foreign_request_minimize lands in
// view_minimize). Godot has no Wayland client bindings, so
// this bridge holds the binding on one side and a trivial
// line protocol on 127.0.0.1:7718 on the other — the same
// shape as nct-greetd-bridge (7717):
//
//   PING            -> PONG
//   LIST            -> TOP <id> <app_id> <act> <min> <stacked> <title>
//                      ... one per window, then END
//   SHADE_ACTIVE    -> OK <id> | FAIL <why>
//   RESTORE <id>    -> OK | FAIL <why>
//   CLOSE <id>      -> OK | FAIL <why>
//
// Shade, here, is the WindowTransformer semantics of the
// demo (demo-de core/windows.js): the window renders nowhere
// and its titlebar lives as an item of the shell's stack.
// The bridge performs it as a minimize it owns: a toplevel
// is "stacked" iff this bridge minimized it via SHADE_ACTIVE
// and it has not been unminimized since (by RESTORE or by
// anyone else — the state feed heals the flag either way).
//
// Client modes (what the session's keybinds call):
//   nct-wl-bridge shade-active | restore <id> | close <id> | list
//
// Backends:
//   wayland — used when WAYLAND_DISPLAY is set: libwayland
//             against the running compositor. The protocol
//             code is generated at build time by
//             wayland-scanner from the vendored
//             wlr-foreign-toplevel-management-unstable-v1.xml
//             beside this file. (A Python/pywayland version
//             of this backend was tried first and dropped:
//             Debian's pywayland ships no wlr modules, its
//             import needs a cffi package it does not depend
//             on, and its dispatch loop segfaulted under a
//             trivial probe — build log 36.)
//   fixture — used when NCT_WL_FIXTURE names a file of
//             tab-separated rows:
//               app_id <TAB> title <TAB> activated <TAB> minimized <TAB> stacked
//             (all local/nested tests; the table is stateful —
//             SHADE_ACTIVE / RESTORE / CLOSE mutate it.)
//
// NCT_WL_EXCLUDE_APP_IDS (comma-separated) keeps SHADE_ACTIVE
// from ever minimizing the matching windows — the shell's own
// surface is a foreign toplevel too, and shading it would
// hide the desktop itself. An entry is either a bare app_id
// (matches every window of that app) or app_id:titleprefix
// (matches only windows whose title starts with the prefix).
// The prefix form exists for the shell: every Godot window
// reports app_id Godot_Engine, the shell alone is titled
// "NCT Shell..." — a bare Godot_Engine entry would bar every
// NCT app from the stack.
//
// Build:
//   wayland-scanner client-header wlr-foreign-toplevel-management-unstable-v1.xml wlr-foreign-toplevel.h
//   wayland-scanner private-code  wlr-foreign-toplevel-management-unstable-v1.xml wlr-foreign-toplevel.c
//   cc -O2 -o nct-wl-bridge nct-wl-bridge.c wlr-foreign-toplevel.c -lwayland-client

#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <poll.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>
#include <wayland-client.h>

#include "wlr-foreign-toplevel.h"

// ---------------------------------------------------------------- table

struct top {
	int id;
	char *app_id;
	char *title;
	bool activated, minimized, stacked;
	struct zwlr_foreign_toplevel_handle_v1 *handle; // NULL in fixture mode
	struct top *next;
};

static struct top *tops;
static int next_id = 1;

static struct top *top_new(void) {
	struct top *t = calloc(1, sizeof *t);
	t->id = next_id++;
	t->app_id = strdup("");
	t->title = strdup("");
	t->next = tops;
	tops = t;
	return t;
}

static struct top *top_find(int id) {
	for (struct top *t = tops; t; t = t->next)
		if (t->id == id)
			return t;
	return NULL;
}

static void top_drop(struct top *t) {
	struct top **pp = &tops;
	while (*pp && *pp != t)
		pp = &(*pp)->next;
	if (*pp)
		*pp = t->next;
	if (t->handle)
		zwlr_foreign_toplevel_handle_v1_destroy(t->handle);
	free(t->app_id);
	free(t->title);
	free(t);
}

static void set_str(char **slot, const char *value) {
	free(*slot);
	*slot = strdup(value ? value : "");
}

// ---------------------------------------------------------------- wayland

static struct wl_display *display;
static struct zwlr_foreign_toplevel_manager_v1 *manager;
static struct wl_seat *seat;

static void handle_title(void *data,
		struct zwlr_foreign_toplevel_handle_v1 *h, const char *title) {
	(void)h;
	set_str(&((struct top *)data)->title, title);
}

static void handle_app_id(void *data,
		struct zwlr_foreign_toplevel_handle_v1 *h, const char *app_id) {
	(void)h;
	set_str(&((struct top *)data)->app_id, app_id);
}

static void handle_noop(void *data,
		struct zwlr_foreign_toplevel_handle_v1 *h) {
	(void)data; (void)h;
}

static void handle_output(void *data,
		struct zwlr_foreign_toplevel_handle_v1 *h,
		struct wl_output *output) {
	(void)data; (void)h; (void)output;
}

static void handle_state(void *data,
		struct zwlr_foreign_toplevel_handle_v1 *h,
		struct wl_array *state) {
	(void)h;
	struct top *t = data;
	t->activated = false;
	t->minimized = false;
	uint32_t *atoms = state->data;
	for (size_t i = 0; i < state->size / sizeof(uint32_t); i++) {
		if (atoms[i] == ZWLR_FOREIGN_TOPLEVEL_HANDLE_V1_STATE_ACTIVATED)
			t->activated = true;
		if (atoms[i] == ZWLR_FOREIGN_TOPLEVEL_HANDLE_V1_STATE_MINIMIZED)
			t->minimized = true;
	}
	if (!t->minimized)
		t->stacked = false; // unminimized by anyone: leaves the stack
}

static void handle_closed(void *data,
		struct zwlr_foreign_toplevel_handle_v1 *h) {
	(void)h;
	struct top *t = data;
	top_drop(t); // destroys the proxy, as clients are expected to
}

static void handle_parent(void *data,
		struct zwlr_foreign_toplevel_handle_v1 *h,
		struct zwlr_foreign_toplevel_handle_v1 *parent) {
	(void)data; (void)h; (void)parent;
}

static const struct zwlr_foreign_toplevel_handle_v1_listener handle_listener = {
	.title = handle_title,
	.app_id = handle_app_id,
	.output_enter = handle_output,
	.output_leave = handle_output,
	.state = handle_state,
	.done = handle_noop,
	.closed = handle_closed,
	.parent = handle_parent,
};

static void manager_toplevel(void *data,
		struct zwlr_foreign_toplevel_manager_v1 *mgr,
		struct zwlr_foreign_toplevel_handle_v1 *handle) {
	(void)data; (void)mgr;
	struct top *t = top_new();
	// The list is newest-first; the feed reads better in
	// arrival order, so re-append at the tail.
	struct top **pp = &tops;
	while (*pp && *pp != t)
		pp = &(*pp)->next;
	if (*pp)
		*pp = t->next;
	struct top **tail = &tops;
	while (*tail)
		tail = &(*tail)->next;
	*tail = t;
	t->next = NULL;
	t->handle = handle;
	zwlr_foreign_toplevel_handle_v1_add_listener(handle,
		&handle_listener, t);
}

static void manager_finished(void *data,
		struct zwlr_foreign_toplevel_manager_v1 *mgr) {
	(void)data; (void)mgr;
}

static const struct zwlr_foreign_toplevel_manager_v1_listener manager_listener = {
	.toplevel = manager_toplevel,
	.finished = manager_finished,
};

static void registry_global(void *data, struct wl_registry *registry,
		uint32_t name, const char *interface, uint32_t version) {
	(void)data;
	if (strcmp(interface, zwlr_foreign_toplevel_manager_v1_interface.name) == 0) {
		uint32_t v = version < 3 ? version : 3;
		manager = wl_registry_bind(registry, name,
			&zwlr_foreign_toplevel_manager_v1_interface, v);
		zwlr_foreign_toplevel_manager_v1_add_listener(manager,
			&manager_listener, NULL);
	} else if (strcmp(interface, wl_seat_interface.name) == 0 && !seat) {
		uint32_t v = version < 5 ? version : 5;
		seat = wl_registry_bind(registry, name, &wl_seat_interface, v);
	}
}

static void registry_remove(void *data, struct wl_registry *registry,
		uint32_t name) {
	(void)data; (void)registry; (void)name;
}

static const struct wl_registry_listener registry_listener = {
	.global = registry_global,
	.global_remove = registry_remove,
};

static bool wayland_init(void) {
	display = wl_display_connect(NULL);
	if (!display)
		return false;
	struct wl_registry *registry = wl_display_get_registry(display);
	wl_registry_add_listener(registry, &registry_listener, NULL);
	wl_display_roundtrip(display);
	if (!manager) {
		fprintf(stderr, "nct-wl-bridge: compositor offers no %s\n",
			zwlr_foreign_toplevel_manager_v1_interface.name);
		return false;
	}
	return true;
}

// ---------------------------------------------------------------- fixture

static bool fixture_mode;

static void fixture_load(const char *path) {
	FILE *f = fopen(path, "r");
	if (!f) {
		fprintf(stderr, "nct-wl-bridge: cannot open fixture %s\n", path);
		exit(1);
	}
	char line[1024];
	struct top **tail = &tops;
	while (fgets(line, sizeof line, f)) {
		char *save = NULL;
		char *app = strtok_r(line, "\t\n", &save);
		if (!app)
			continue;
		char *title = strtok_r(NULL, "\t\n", &save);
		char *act = strtok_r(NULL, "\t\n", &save);
		char *min = strtok_r(NULL, "\t\n", &save);
		char *stk = strtok_r(NULL, "\t\n", &save);
		struct top *t = calloc(1, sizeof *t);
		t->id = next_id++;
		t->app_id = strdup(app);
		t->title = strdup(title ? title : "");
		t->activated = act && strcmp(act, "1") == 0;
		t->minimized = min && strcmp(min, "1") == 0;
		t->stacked = stk && strcmp(stk, "1") == 0;
		*tail = t;
		tail = &t->next;
	}
	fclose(f);
}

// ---------------------------------------------------------------- commands

static char exclude_buf[512];

static bool excluded(const char *app_id, const char *title) {
	if (!exclude_buf[0])
		return false;
	char buf[512];
	snprintf(buf, sizeof buf, "%s", exclude_buf);
	for (char *tok = strtok(buf, ","); tok; tok = strtok(NULL, ",")) {
		char *colon = strchr(tok, ':');
		if (colon) {
			*colon = 0;
			if (strcmp(tok, app_id) == 0 &&
			    strncmp(title, colon + 1, strlen(colon + 1)) == 0)
				return true;
		} else if (strcmp(tok, app_id) == 0)
			return true;
	}
	return false;
}

static void clean(char *s) {
	for (; *s; s++)
		if (*s == '\t' || *s == '\n' || *s == '\r')
			*s = ' ';
}

// Runs one command line, writing reply lines to out (grown
// with fmemopen by the caller through a callback instead —
// simpler: replies go straight to a memory buffer).
struct reply {
	char buf[16384];
	size_t len;
};

static void reply_add(struct reply *r, const char *line) {
	size_t n = strlen(line);
	if (r->len + n + 1 < sizeof r->buf) {
		memcpy(r->buf + r->len, line, n);
		r->len += n;
		r->buf[r->len++] = '\n';
		r->buf[r->len] = 0;
	}
}

static void do_shade_active(struct reply *r) {
	for (struct top *t = tops; t; t = t->next) {
		if (t->activated && !excluded(t->app_id, t->title)) {
			t->stacked = true;
			if (t->handle)
				zwlr_foreign_toplevel_handle_v1_set_minimized(t->handle);
			else
				t->minimized = true;
			char line[64];
			snprintf(line, sizeof line, "OK %d", t->id);
			reply_add(r, line);
			return;
		}
	}
	reply_add(r, "FAIL no activated window to shade");
}

static void do_restore(struct reply *r, int id) {
	struct top *t = top_find(id);
	if (!t) {
		reply_add(r, "FAIL no such window");
		return;
	}
	t->stacked = false;
	if (t->handle) {
		zwlr_foreign_toplevel_handle_v1_unset_minimized(t->handle);
		if (seat)
			zwlr_foreign_toplevel_handle_v1_activate(t->handle, seat);
	} else {
		t->minimized = false;
		for (struct top *o = tops; o; o = o->next)
			o->activated = false;
		t->activated = true;
	}
	reply_add(r, "OK");
}

static void do_close(struct reply *r, int id) {
	struct top *t = top_find(id);
	if (!t) {
		reply_add(r, "FAIL no such window");
		return;
	}
	if (t->handle)
		zwlr_foreign_toplevel_handle_v1_close(t->handle);
	else
		top_drop(t);
	reply_add(r, "OK");
}

static void handle_command(char *line, struct reply *r) {
	while (*line == ' ' || *line == '\t')
		line++;
	if (strcmp(line, "PING") == 0) {
		reply_add(r, "PONG");
	} else if (strcmp(line, "LIST") == 0) {
		for (struct top *t = tops; t; t = t->next) {
			char app[256], title[1024], out[1400];
			snprintf(app, sizeof app, "%s", t->app_id);
			snprintf(title, sizeof title, "%s", t->title);
			clean(app);
			clean(title);
			snprintf(out, sizeof out, "TOP %d %s %d %d %d %s",
				t->id, app[0] ? app : "-", t->activated ? 1 : 0,
				t->minimized ? 1 : 0, t->stacked ? 1 : 0, title);
			reply_add(r, out);
		}
		reply_add(r, "END");
	} else if (strcmp(line, "SHADE_ACTIVE") == 0) {
		do_shade_active(r);
	} else if (strncmp(line, "RESTORE ", 8) == 0) {
		do_restore(r, atoi(line + 8));
	} else if (strncmp(line, "CLOSE ", 6) == 0) {
		do_close(r, atoi(line + 6));
	} else {
		reply_add(r, "FAIL unknown command");
	}
	if (display)
		wl_display_flush(display);
}

// ---------------------------------------------------------------- server

#define MAX_CLIENTS 16

struct client {
	int fd;
	char buf[4096];
	size_t len;
};

static int bridge_port(void) {
	const char *env = getenv("NCT_WL_BRIDGE_PORT");
	return env && *env ? atoi(env) : 7718;
}

static int listen_fd(void) {
	int fd = socket(AF_INET, SOCK_STREAM, 0);
	int one = 1;
	setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
	struct sockaddr_in addr = {0};
	addr.sin_family = AF_INET;
	addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
	addr.sin_port = htons(bridge_port());
	if (bind(fd, (struct sockaddr *)&addr, sizeof addr) < 0 ||
			listen(fd, 8) < 0) {
		perror("nct-wl-bridge: listen");
		exit(1);
	}
	return fd;
}

static void client_service(struct client *c) {
	char chunk[1024];
	ssize_t n = recv(c->fd, chunk, sizeof chunk, 0);
	if (n <= 0) {
		close(c->fd);
		c->fd = -1;
		c->len = 0;
		return;
	}
	for (ssize_t i = 0; i < n; i++) {
		if (chunk[i] == '\n') {
			c->buf[c->len] = 0;
			struct reply r = {0};
			handle_command(c->buf, &r);
			if (r.len)
				send(c->fd, r.buf, r.len, MSG_NOSIGNAL | MSG_DONTWAIT);
			c->len = 0;
		} else if (c->len < sizeof c->buf - 1) {
			c->buf[c->len++] = chunk[i];
		}
	}
}

static int daemon_main(void) {
	const char *fixture = getenv("NCT_WL_FIXTURE");
	const char *excl = getenv("NCT_WL_EXCLUDE_APP_IDS");
	if (excl)
		snprintf(exclude_buf, sizeof exclude_buf, "%s", excl);
	fixture_mode = fixture && *fixture;
	if (fixture_mode) {
		fixture_load(fixture);
	} else if (!wayland_init()) {
		fprintf(stderr, "nct-wl-bridge: no wayland display\n");
		return 1;
	}
	int lfd = listen_fd();
	fprintf(stderr, "nct-wl-bridge listening on 127.0.0.1:%d\n",
		bridge_port());
	struct client clients[MAX_CLIENTS];
	for (int i = 0; i < MAX_CLIENTS; i++)
		clients[i].fd = -1;
	for (;;) {
		struct pollfd fds[2 + MAX_CLIENTS];
		int nfds = 0;
		int wl_idx = -1;
		if (display) {
			while (wl_display_prepare_read(display) != 0)
				wl_display_dispatch_pending(display);
			wl_display_flush(display);
			wl_idx = nfds;
			fds[nfds].fd = wl_display_get_fd(display);
			fds[nfds].events = POLLIN;
			nfds++;
		}
		int listen_idx = nfds;
		fds[nfds].fd = lfd;
		fds[nfds].events = POLLIN;
		nfds++;
		int first_client = nfds;
		for (int i = 0; i < MAX_CLIENTS; i++) {
			if (clients[i].fd >= 0) {
				fds[nfds].fd = clients[i].fd;
				fds[nfds].events = POLLIN;
				nfds++;
			}
		}
		int timeout = display ? -1 : 100;
		if (poll(fds, nfds, timeout) < 0) {
			if (display)
				wl_display_cancel_read(display);
			if (errno == EINTR)
				continue;
			return 1;
		}
		if (display) {
			if (wl_idx >= 0 && (fds[wl_idx].revents & POLLIN)) {
				if (wl_display_read_events(display) < 0)
					return 1;
			} else {
				wl_display_cancel_read(display);
			}
			wl_display_dispatch_pending(display);
		}
		if (fds[listen_idx].revents & POLLIN) {
			int cfd = accept(lfd, NULL, NULL);
			if (cfd >= 0) {
				bool placed = false;
				for (int i = 0; i < MAX_CLIENTS; i++) {
					if (clients[i].fd < 0) {
						clients[i].fd = cfd;
						clients[i].len = 0;
						placed = true;
						break;
					}
				}
				if (!placed)
					close(cfd);
			}
		}
		int ci = 0;
		for (int i = 0; i < MAX_CLIENTS; i++) {
			if (clients[i].fd < 0)
				continue;
			if (fds[first_client + ci].revents & POLLIN)
				client_service(&clients[i]);
			ci++;
		}
	}
	return 0;
}

// ---------------------------------------------------------------- client

static int client_main(int argc, char **argv) {
	char cmd[128];
	if (strcmp(argv[1], "shade-active") == 0)
		snprintf(cmd, sizeof cmd, "SHADE_ACTIVE");
	else if (strcmp(argv[1], "list") == 0)
		snprintf(cmd, sizeof cmd, "LIST");
	else if (strcmp(argv[1], "restore") == 0 && argc == 3)
		snprintf(cmd, sizeof cmd, "RESTORE %s", argv[2]);
	else if (strcmp(argv[1], "close") == 0 && argc == 3)
		snprintf(cmd, sizeof cmd, "CLOSE %s", argv[2]);
	else {
		fprintf(stderr, "usage: nct-wl-bridge shade-active | list | "
			"restore <id> | close <id>\n");
		return 2;
	}
	int fd = socket(AF_INET, SOCK_STREAM, 0);
	struct sockaddr_in addr = {0};
	addr.sin_family = AF_INET;
	addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
	addr.sin_port = htons(bridge_port());
	if (connect(fd, (struct sockaddr *)&addr, sizeof addr) < 0) {
		perror("nct-wl-bridge: connect");
		return 1;
	}
	dprintf(fd, "%s\n", cmd);
	FILE *f = fdopen(fd, "r");
	char line[2048];
	int status = 1;
	bool is_list = strcmp(cmd, "LIST") == 0;
	while (fgets(line, sizeof line, f)) {
		fputs(line, stdout);
		if (is_list) {
			if (strcmp(line, "END\n") == 0) {
				status = 0;
				break;
			}
		} else {
			status = strncmp(line, "OK", 2) == 0 ? 0 : 1;
			break;
		}
	}
	fclose(f);
	return status;
}

int main(int argc, char **argv) {
	if (argc > 1)
		return client_main(argc, argv);
	return daemon_main();
}
