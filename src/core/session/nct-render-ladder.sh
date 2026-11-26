# nct-render-ladder.sh — rendering fallback ladder, SOURCED by the
# session scripts and nct-godot-run (not executed directly).
#
# Why: whether the native rendering path works depends on the graphics
# stack under us — GPU driver, compositor buffer sharing (dmabuf),
# VM virtual hardware (VirtualBox's vmwgfx dmabuf import is broken,
# ASSUMPTION A13). A device probe cannot see those failures; they only
# appear when the real chain runs. So the ladder TRIES the real chain,
# best configuration first, and steps down only when an attempt dies
# fast. The rung that stayed up is remembered, so a broken stack pays
# the failed attempts once, not on every start.
#
# Rungs (each changes one layer):
#   0  native        compositor default renderer; Godot default
#                    (Wayland display, Vulkan rendering)
#   1  Godot opengl3 on Wayland
#   2  Godot as an X11 client, opengl3, software GL
#   3  full software rung 2 + compositor on WLR_RENDERER=pixman
#      (= the A13 greeter configuration, now the bottom rung)
#
# An attempt SUCCEEDS when the command exits 0, or — for the greeter —
# the bridge's login-started marker appears (a login succeeded;
# whatever exit follows is greetd's session transition, not a
# rendering failure). A nonzero exit is a failure whenever it happens:
# the window (NCT_LADDER_WINDOW, default 10 s) only separates "failed
# fast" from "failed after window" in the log — on the rig, labwc died
# 17 s in with the same signature as the 2 s deaths (A14 as proven).
#
# Explicit configuration always wins over the ladder:
#   NCT_RENDER_DRIVER / NCT_DISPLAY_DRIVER / WLR_RENDERER already set
#     -> single attempt, environment untouched
#   NCT_RENDER_RUNG=<n>  -> single attempt at that rung
#   NCT_RENDER_LADDER=off -> single attempt, rung 0 environment
#
# ladder_run STATE_DIR LOGNAME CMD [ARGS...]
#   Runs CMD under the ladder, appending CMD's output and one line per
#   attempt to STATE_DIR/LOGNAME. Returns the final attempt's exit
#   code (0 when the login marker decided success).

LADDER_MAX=${LADDER_MAX:-3}

# ladder_rotate DIR LOG — bound a ladder log's growth. An
# error-looping attempt appends without limit (on the rig a 2 GB
# cage.log filled the greeter's /tmp, breaking apt and logins).
# Past the cap, keep one previous generation as .old, start fresh.
LADDER_LOG_CAP=${NCT_LOG_CAP_BYTES:-10485760}
ladder_rotate() {
  _lrot_f=$1/$2
  if [ -f "$_lrot_f" ] && [ "$(wc -c < "$_lrot_f")" -gt "$LADDER_LOG_CAP" ]; then
    mv -f "$_lrot_f" "$_lrot_f.old" 2>/dev/null || true
  fi
}

# ladder_apply RUNG — set the four rendering variables for RUNG.
ladder_apply() {
  case "$1" in
    0) unset NCT_RENDER_DRIVER NCT_DISPLAY_DRIVER LIBGL_ALWAYS_SOFTWARE WLR_RENDERER ;;
    1) NCT_RENDER_DRIVER=opengl3; export NCT_RENDER_DRIVER
       unset NCT_DISPLAY_DRIVER LIBGL_ALWAYS_SOFTWARE WLR_RENDERER ;;
    2) NCT_RENDER_DRIVER=opengl3; NCT_DISPLAY_DRIVER=x11; LIBGL_ALWAYS_SOFTWARE=1
       export NCT_RENDER_DRIVER NCT_DISPLAY_DRIVER LIBGL_ALWAYS_SOFTWARE
       unset WLR_RENDERER ;;
    3) NCT_RENDER_DRIVER=opengl3; NCT_DISPLAY_DRIVER=x11; LIBGL_ALWAYS_SOFTWARE=1
       WLR_RENDERER=pixman
       export NCT_RENDER_DRIVER NCT_DISPLAY_DRIVER LIBGL_ALWAYS_SOFTWARE WLR_RENDERER ;;
  esac
}

# ladder_rungfile STATE_DIR — where the remembered rung lives: a
# persistent place when one is writable (the greeter's home is
# /var/lib/nct-greeter since A13), else the state dir itself.
ladder_rungfile() {
  if [ -n "${NCT_RENDER_STATE_DIR:-}" ]; then
    printf '%s/render-rung' "$NCT_RENDER_STATE_DIR"
  elif [ -n "${HOME:-}" ] && [ -w "${HOME:-}" ]; then
    printf '%s/.local/state/nct/render-rung' "$HOME"
  else
    printf '%s/render-rung' "$1"
  fi
}

ladder_run() {
  _lr_dir=$1; _lr_log=$2; shift 2
  _lr_file=$(ladder_rungfile "$_lr_dir")
  _lr_window=${NCT_LADDER_WINDOW:-10}
  # A marker from an earlier run must not bless this one.
  rm -f "$_lr_dir/login-started"
  ladder_rotate "$_lr_dir" "$_lr_log"
  # Per-run header: the ladder logs are append-only across boots and
  # attempts; this stamp is what separates one run's segment from
  # every earlier era in the same file.
  echo "=== ladder run $(date -Is) cmd=$* ===" >> "$_lr_dir/$_lr_log"
  # Attempt order: the pinned/remembered rung first, then down to the
  # bottom, then wrap to the top — each rung at most once.
  if [ -n "${NCT_RENDER_RUNG:-}" ]; then
    _lr_order=${NCT_RENDER_RUNG}
  elif [ "${NCT_RENDER_LADDER:-on}" = "off" ] || [ -n "${NCT_RENDER_DRIVER:-}" ] \
      || [ -n "${NCT_DISPLAY_DRIVER:-}" ] || [ -n "${WLR_RENDERER:-}" ]; then
    _lr_order=0
    # Single attempt with the environment exactly as given: rung 0's
    # "unset everything" must NOT be applied here.
    _lr_t0=$(date +%s)
    echo "ladder: single attempt (explicit config) cmd=$*" >> "$_lr_dir/$_lr_log"
    _lr_code=0
    "$@" >> "$_lr_dir/$_lr_log" 2>&1 || _lr_code=$?
    echo "ladder: exit $_lr_code after $(( $(date +%s) - _lr_t0 ))s" >> "$_lr_dir/$_lr_log"
    return "$_lr_code"
  else
    _lr_start=0
    if [ -f "$_lr_file" ]; then
      _lr_start=$(cat "$_lr_file" 2>/dev/null || echo 0)
      case "$_lr_start" in ''|*[!0-9]*) _lr_start=0 ;; esac
      [ "$_lr_start" -gt "$LADDER_MAX" ] && _lr_start=0
    fi
    _lr_order=""
    _lr_i=$_lr_start
    while [ "$_lr_i" -le "$LADDER_MAX" ]; do _lr_order="$_lr_order $_lr_i"; _lr_i=$(( _lr_i + 1 )); done
    _lr_i=0
    while [ "$_lr_i" -lt "$_lr_start" ]; do _lr_order="$_lr_order $_lr_i"; _lr_i=$(( _lr_i + 1 )); done
  fi
  _lr_code=1
  for _lr_rung in $_lr_order; do
    ladder_rotate "$_lr_dir" "$_lr_log"
    ladder_apply "$_lr_rung"
    echo "ladder: attempt rung=$_lr_rung cmd=$*" >> "$_lr_dir/$_lr_log"
    _lr_t0=$(date +%s)
    _lr_code=0
    "$@" >> "$_lr_dir/$_lr_log" 2>&1 || _lr_code=$?
    _lr_elapsed=$(( $(date +%s) - _lr_t0 ))
    if [ -f "$_lr_dir/login-started" ]; then
      echo "ladder: rung=$_lr_rung ok (login started; exit $_lr_code after ${_lr_elapsed}s)" >> "$_lr_dir/$_lr_log"
      _lr_code=0; _lr_ok=1
    elif [ "$_lr_code" -eq 0 ]; then
      echo "ladder: rung=$_lr_rung ok (clean exit after ${_lr_elapsed}s)" >> "$_lr_dir/$_lr_log"
      _lr_ok=1
    elif [ "$_lr_elapsed" -ge "$_lr_window" ]; then
      # A nonzero exit past the window is still a dead session — on a
      # slow software stack the same breakage can outlive the window
      # (labwc died 17 s in on the rig with the same dmabuf signature
      # as the 2 s deaths). Keep stepping instead of blessing the rung.
      echo "ladder: rung=$_lr_rung failed after window (exit $_lr_code after ${_lr_elapsed}s)" >> "$_lr_dir/$_lr_log"
      _lr_ok=0
    else
      echo "ladder: rung=$_lr_rung failed fast (exit $_lr_code after ${_lr_elapsed}s)" >> "$_lr_dir/$_lr_log"
      _lr_ok=0
    fi
    if [ "$_lr_ok" -eq 1 ]; then
      mkdir -p "$(dirname "$_lr_file")" 2>/dev/null || true
      printf '%s\n' "$_lr_rung" > "$_lr_file" 2>/dev/null || true
      return "$_lr_code"
    fi
  done
  echo "ladder: all rungs failed; last exit $_lr_code" >> "$_lr_dir/$_lr_log"
  return "$_lr_code"
}
