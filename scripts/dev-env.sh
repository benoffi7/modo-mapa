#!/usr/bin/env bash
#
# Dev environment manager for modo-mapa.
# Manages Firebase emulators, Vite dev server, and seed data.
#
# Usage:
#   ./scripts/dev-env.sh status    — Check what's running
#   ./scripts/dev-env.sh start     — Start emulators + Vite (if not already running)
#   ./scripts/dev-env.sh stop      — Stop emulators + Vite
#   ./scripts/dev-env.sh restart   — Stop + Start
#   ./scripts/dev-env.sh seed      — Seed test data (emulators must be running)
#   ./scripts/dev-env.sh health    — Full health check (ports, auth, firestore, storage)
#   ./scripts/dev-env.sh logs      — Show emulator logs (last 50 lines)
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Ports used by the dev environment
PORT_VITE=5173
PORT_FIRESTORE=8080
PORT_AUTH=9099
PORT_STORAGE=9199
PORT_FUNCTIONS=5001
PORT_EMULATOR_UI=4000

ALL_EMULATOR_PORTS="$PORT_FIRESTORE $PORT_AUTH $PORT_STORAGE $PORT_FUNCTIONS $PORT_EMULATOR_UI"
ALL_PORTS="$PORT_VITE $ALL_EMULATOR_PORTS"

LOG_DIR="$PROJECT_ROOT/.dev-logs"
EMULATOR_LOG="$LOG_DIR/emulators.log"
VITE_LOG="$LOG_DIR/vite.log"

# ── Helpers ──────────────────────────────────────────────────────────────

_color() {
  local color="$1"; shift
  case "$color" in
    red)    echo -e "\033[31m$*\033[0m" ;;
    green)  echo -e "\033[32m$*\033[0m" ;;
    yellow) echo -e "\033[33m$*\033[0m" ;;
    cyan)   echo -e "\033[36m$*\033[0m" ;;
    *)      echo "$*" ;;
  esac
}

_port_pid() {
  lsof -ti :"$1" 2>/dev/null | head -1
}

_port_is_up() {
  lsof -ti :"$1" >/dev/null 2>&1
}

_wait_for_port() {
  local port="$1" label="$2" timeout="${3:-30}"
  local elapsed=0
  while ! _port_is_up "$port"; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$timeout" ]; then
      _color red "  TIMEOUT: $label (port $port) did not start after ${timeout}s"
      return 1
    fi
  done
  _color green "  OK: $label (port $port) — ${elapsed}s"
}

# ── Commands ─────────────────────────────────────────────────────────────

cmd_status() {
  echo ""
  _color cyan "=== Dev Environment Status ==="
  echo ""

  local all_up=true
  for pair in \
    "$PORT_VITE:Vite" \
    "$PORT_AUTH:Auth Emulator" \
    "$PORT_FIRESTORE:Firestore Emulator" \
    "$PORT_STORAGE:Storage Emulator" \
    "$PORT_FUNCTIONS:Functions Emulator" \
    "$PORT_EMULATOR_UI:Emulator UI"; do

    local port="${pair%%:*}"
    local label="${pair#*:}"
    local pid
    pid=$(_port_pid "$port")
    if [ -n "$pid" ]; then
      _color green "  UP   $label (port $port, pid $pid)"
    else
      _color red   "  DOWN $label (port $port)"
      all_up=false
    fi
  done

  echo ""
  if $all_up; then
    _color green "All services running."
    echo "  App:          http://localhost:$PORT_VITE"
    echo "  Emulator UI:  http://localhost:$PORT_EMULATOR_UI"
    echo "  Admin:        http://localhost:$PORT_VITE/admin"
  else
    _color yellow "Some services are down. Run: ./scripts/dev-env.sh start"
  fi
  echo ""
}

cmd_stop() {
  _color cyan "Stopping dev environment..."

  # Kill Vite
  local vite_pid
  vite_pid=$(_port_pid "$PORT_VITE")
  if [ -n "$vite_pid" ]; then
    kill "$vite_pid" 2>/dev/null || true
    _color yellow "  Killed Vite (pid $vite_pid)"
  fi

  # Kill emulators — find the java process that owns the emulator ports
  for port in $ALL_EMULATOR_PORTS; do
    local pid
    pid=$(_port_pid "$port")
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done

  # Wait a moment for ports to free
  sleep 2

  # Verify
  local still_running=false
  for port in $ALL_PORTS; do
    if _port_is_up "$port"; then
      local pid
      pid=$(_port_pid "$port")
      _color red "  Port $port still in use (pid $pid) — force killing"
      kill -9 "$pid" 2>/dev/null || true
      still_running=true
    fi
  done

  if $still_running; then
    sleep 1
  fi

  _color green "  Dev environment stopped."
}

cmd_start() {
  mkdir -p "$LOG_DIR"

  # Check if already running
  local emulators_up=true
  for port in $PORT_AUTH $PORT_FIRESTORE $PORT_STORAGE $PORT_FUNCTIONS; do
    if ! _port_is_up "$port"; then
      emulators_up=false
      break
    fi
  done

  if $emulators_up; then
    _color green "Emulators already running."
  else
    # Kill any partial emulator state
    for port in $ALL_EMULATOR_PORTS; do
      local pid
      pid=$(_port_pid "$port")
      if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null || true
      fi
    done
    sleep 2

    _color cyan "Starting Firebase emulators..."

    # Build functions first
    if [ -f functions/package.json ]; then
      _color yellow "  Building Cloud Functions..."
      (cd functions && npm run build) >> "$EMULATOR_LOG" 2>&1
    fi

    npx firebase emulators:start --only auth,firestore,functions,storage \
      >> "$EMULATOR_LOG" 2>&1 &

    echo ""
    _color yellow "Waiting for emulators..."
    _wait_for_port "$PORT_AUTH"      "Auth"      30
    _wait_for_port "$PORT_FIRESTORE" "Firestore" 30
    _wait_for_port "$PORT_STORAGE"   "Storage"   30
    _wait_for_port "$PORT_FUNCTIONS" "Functions"  30
    echo ""

    # Auto-seed on fresh emulator start
    _color cyan "Seeding test data..."
    node scripts/seed-admin-data.mjs 2>&1 | tail -5
    echo ""
  fi

  # Vite
  if _port_is_up "$PORT_VITE"; then
    _color green "Vite already running."
  else
    _color cyan "Starting Vite dev server..."
    npx vite --host >> "$VITE_LOG" 2>&1 &
    _wait_for_port "$PORT_VITE" "Vite" 15
  fi

  echo ""
  _color green "Dev environment ready!"
  echo "  App:          http://localhost:$PORT_VITE"
  echo "  Emulator UI:  http://localhost:$PORT_EMULATOR_UI"
  echo "  Admin:        http://localhost:$PORT_VITE/admin"
  echo ""
}

cmd_seed() {
  # Verify Firestore emulator is running
  if ! _port_is_up "$PORT_FIRESTORE"; then
    _color red "Firestore emulator is not running. Start it first: ./scripts/dev-env.sh start"
    exit 1
  fi

  _color cyan "Seeding test data..."
  node scripts/seed-admin-data.mjs
  echo ""
  _color green "Seed complete!"
}

cmd_health() {
  echo ""
  _color cyan "=== Health Check ==="
  echo ""

  local ok=true

  # 1. Port checks
  _color yellow "1. Port availability:"
  for pair in \
    "$PORT_VITE:Vite" \
    "$PORT_AUTH:Auth" \
    "$PORT_FIRESTORE:Firestore" \
    "$PORT_STORAGE:Storage" \
    "$PORT_FUNCTIONS:Functions"; do

    local port="${pair%%:*}"
    local label="${pair#*:}"
    if _port_is_up "$port"; then
      _color green "   OK: $label (port $port)"
    else
      _color red "   FAIL: $label (port $port)"
      ok=false
    fi
  done

  # 2. Auth emulator responds
  echo ""
  _color yellow "2. Auth emulator HTTP check:"
  if curl -sf "http://localhost:$PORT_AUTH/" >/dev/null 2>&1; then
    _color green "   OK: Auth emulator responds"
  else
    _color red "   FAIL: Auth emulator not responding"
    ok=false
  fi

  # 3. Firestore emulator responds
  _color yellow "3. Firestore emulator HTTP check:"
  if curl -sf "http://localhost:$PORT_FIRESTORE/" >/dev/null 2>&1; then
    _color green "   OK: Firestore emulator responds"
  else
    _color red "   FAIL: Firestore emulator not responding"
    ok=false
  fi

  # 4. Storage emulator responds
  _color yellow "4. Storage emulator HTTP check:"
  if curl -sf "http://localhost:$PORT_STORAGE/" >/dev/null 2>&1; then
    _color green "   OK: Storage emulator responds"
  else
    _color red "   FAIL: Storage emulator not responding"
    ok=false
  fi

  # 5. Vite responds
  _color yellow "5. Vite dev server HTTP check:"
  if curl -sf "http://localhost:$PORT_VITE/" >/dev/null 2>&1; then
    _color green "   OK: Vite responds"
  else
    _color red "   FAIL: Vite not responding"
    ok=false
  fi

  # 6. Check if seed data exists
  echo ""
  _color yellow "6. Seed data check (config/counters doc):"
  local counters_check
  counters_check=$(curl -sf "http://localhost:$PORT_FIRESTORE/emulator/v1/projects/modo-mapa-app/databases/(default)/documents/config/counters" 2>/dev/null || echo "FAIL")
  if echo "$counters_check" | grep -q "fields"; then
    _color green "   OK: Seed data found"
  else
    _color yellow "   WARN: No seed data. Run: ./scripts/dev-env.sh seed"
  fi

  echo ""
  if $ok; then
    _color green "All checks passed!"
  else
    _color red "Some checks failed. Review above."
  fi
  echo ""
}

cmd_logs() {
  local lines="${1:-50}"
  if [ -f "$EMULATOR_LOG" ]; then
    _color cyan "=== Emulator Logs (last $lines lines) ==="
    tail -n "$lines" "$EMULATOR_LOG"
  else
    _color yellow "No emulator log file found."
  fi
  echo ""
  if [ -f "$VITE_LOG" ]; then
    _color cyan "=== Vite Logs (last $lines lines) ==="
    tail -n "$lines" "$VITE_LOG"
  else
    _color yellow "No Vite log file found."
  fi
}

cmd_restart() {
  cmd_stop
  cmd_start
}

# ── Main ─────────────────────────────────────────────────────────────────

case "${1:-help}" in
  status)  cmd_status ;;
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  seed)    cmd_seed ;;
  health)  cmd_health ;;
  logs)    cmd_logs "${2:-50}" ;;
  *)
    echo "Usage: $0 {status|start|stop|restart|seed|health|logs [lines]}"
    exit 1
    ;;
esac
