#!/usr/bin/env python3
"""nct-greetd-bridge — greetd IPC <-> one-line TCP protocol for the greeter.

Marker: NCT-WL-BRIDGE. Layer: services.

Why this exists: greetd speaks JSON over a Unix socket ($GREETD_SOCK);
Godot has no Unix-socket API, so the Godot greeter cannot speak it. This
bridge speaks greetd IPC on one side and a trivial line protocol on
127.0.0.1:7717 on the other:

    PING                 -> PONG
    AUTH <user> <pass>   -> OK | FAIL <why>      (pass = rest of the line)
    START                -> STARTED | FAIL <why> (starts the session)

Backends:
  greetd  — used when GREETD_SOCK is set: real greetd IPC
            (create_session / post_auth_message_response / start_session,
            4-byte little-endian length-prefixed JSON).
            ASSUMPTION A3: implemented from the greetd protocol docs;
            the VM test bed (tests/vm, check 03) is its first real proof.
  fixture — used otherwise (all local/nested tests): credentials from
            $NCT_AUTH_FIXTURE, lines of  user:password . START execs
            $NCT_SESSION_CMD (default: nct-session-apps, because in tests
            a compositor is already running; the VM greeter session sets
            it to nct-session).
"""
import json, os, socket, socketserver, struct, subprocess, sys

HOST, PORT = "127.0.0.1", 7717
SESSION_CMD = os.environ.get("NCT_SESSION_CMD", "nct-session-apps")

def fixture_check(user, password):
    path = os.environ.get("NCT_AUTH_FIXTURE", "")
    if not path or not os.path.exists(path):
        return False, "no fixture backend configured"
    with open(path) as f:
        for line in f:
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            u, _, p = line.partition(":")
            if u == user and p == password:
                return True, ""
    return False, "invalid credentials"

class Greetd:
    """One greetd conversation, held across AUTH and START lines."""
    def __init__(self):
        self.sock_path = os.environ["GREETD_SOCK"]
        self.s = None
    def _send(self, obj):
        data = json.dumps(obj).encode()
        self.s.sendall(struct.pack("<I", len(data)) + data)
    def _recv(self):
        (n,) = struct.unpack("<I", self._exact(4))
        return json.loads(self._exact(n))
    def _exact(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.s.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("greetd closed the socket")
            buf += chunk
        return buf
    def auth(self, user, password):
        self.s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.s.connect(self.sock_path)
        self._send({"type": "create_session", "username": user})
        resp = self._recv()
        while resp.get("type") == "auth_message":
            # Foundation greeter supports the plain secret prompt only;
            # other auth message types get the password as the response.
            self._send({"type": "post_auth_message_response", "response": password})
            resp = self._recv()
        if resp.get("type") == "success":
            return True, ""
        self._send({"type": "cancel_session"})
        return False, str(resp.get("description", "greetd error"))
    def start(self):
        cmd = SESSION_CMD.split()
        self._send({"type": "start_session", "cmd": cmd, "env": []})
        resp = self._recv()
        return resp.get("type") == "success", str(resp.get("description", ""))

USE_GREETD = bool(os.environ.get("GREETD_SOCK"))

def mark_started():
    """Drop the login-started marker in the greeter state dir.

    The greeter session's render ladder (nct-render-ladder.sh) treats
    this marker as proof the current attempt works: after a successful
    START, whatever exit follows is greetd's session transition, not
    a rendering failure, so the ladder must not step down.
    """
    state = os.environ.get("NCT_STATE_DIR")
    if not state:
        return
    try:
        os.makedirs(state, exist_ok=True)
        with open(os.path.join(state, "login-started"), "w") as f:
            f.write("started\n")
    except OSError:
        pass

class Handler(socketserver.StreamRequestHandler):
    greetd = None
    def handle(self):
        for raw in self.rfile:
            line = raw.decode(errors="replace").rstrip("\n")
            if not line:
                continue
            parts = line.split(" ", 2)
            verb = parts[0]
            if verb == "PING":
                self._reply("PONG")
            elif verb == "AUTH" and len(parts) == 3:
                user, password = parts[1], parts[2]
                if USE_GREETD:
                    self.greetd = Greetd()
                    ok, why = self.greetd.auth(user, password)
                else:
                    ok, why = fixture_check(user, password)
                # Attempts are logged (user + outcome, never the
                # password): the log is how tests and operators tell a
                # rejected login from a greeter that never asked.
                print(f"nct-greetd-bridge: AUTH user={user} -> {'OK' if ok else 'FAIL ' + why}",
                      file=sys.stderr, flush=True)
                self._reply("OK" if ok else f"FAIL {why}")
            elif verb == "START":
                if USE_GREETD and self.greetd is not None:
                    ok, why = self.greetd.start()
                    if ok:
                        mark_started()
                    self._reply("STARTED" if ok else f"FAIL {why}")
                elif USE_GREETD:
                    self._reply("FAIL no successful AUTH first")
                else:
                    subprocess.Popen(SESSION_CMD.split(),
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                     start_new_session=True)
                    mark_started()
                    print(f"nct-greetd-bridge: START -> spawned session cmd: {SESSION_CMD}",
                          file=sys.stderr, flush=True)
                    self._reply("STARTED")
            else:
                self._reply("FAIL unknown or malformed line")
    def _reply(self, text):
        self.wfile.write((text + "\n").encode())
        self.wfile.flush()

if __name__ == "__main__":
    backend = "greetd" if USE_GREETD else "fixture"
    print(f"nct-greetd-bridge: backend={backend} listening on {HOST}:{PORT}, session cmd: {SESSION_CMD}", file=sys.stderr)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer((HOST, PORT), Handler) as srv:
        srv.serve_forever()
