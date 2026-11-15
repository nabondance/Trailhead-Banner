#!/bin/bash
# Shared by the dev-server scripts. Several worktrees can run a dev server at
# once, so each one records its own PID and port instead of assuming :3000.
# Source from the repository root.

DEV_PID_FILE=.dev-server.pid
DEV_PORT_FILE=.dev-server.port

# True when the dev server started by dev-start in this checkout is alive.
dev_running() {
  [ -f "$DEV_PID_FILE" ] && ps -p "$(cat "$DEV_PID_FILE")" > /dev/null 2>&1
}

descendants() {
  local child
  for child in $(pgrep -P "$1"); do
    descendants "$child"
    echo "$child"
  done
}

# Stop a process and everything it started: pnpm starts next, which starts its
# own workers, and an orphaned worker keeps the port.
stop_tree() {
  local tree
  tree="$(descendants "$1") $1"
  # shellcheck disable=SC2086 # a list of PIDs, split on purpose
  kill $tree 2> /dev/null || true
  sleep 1
  # shellcheck disable=SC2086
  kill -9 $tree 2> /dev/null || true
}

# `next dev` processes running in this checkout that dev-start did not start,
# e.g. a `pnpm dev` typed by hand. Matched on node processes only, so a shell
# whose command line merely mentions "next dev" is never picked up.
hand_started_pids() {
  local pid cwd here
  here=$(pwd -P)
  for pid in $(pgrep -x node 2> /dev/null); do
    ps -o args= -p "$pid" 2> /dev/null | grep -Eq 'next(/dist/bin/next)? dev' || continue
    cwd=$(readlink "/proc/$pid/cwd" 2> /dev/null || lsof -a -p "$pid" -d cwd -Fn 2> /dev/null | sed -n 's/^n//p')
    [ "$cwd" = "$here" ] && echo "$pid"
  done
}

# TCP port a process tree listens on (empty when lsof is missing).
listen_port() {
  local pids
  pids=$(echo "$(descendants "$1") $1" | tr -s ' \n' ',' | sed 's/^,//;s/,$//')
  lsof -nP -a -p "$pids" -iTCP -sTCP:LISTEN -Fn 2> /dev/null | sed -n 's/^n.*:\([0-9]*\)$/\1/p' | head -1
}

# Port of this checkout's dev server: the one dev-start recorded, else the one
# a hand-started server listens on, else the Next.js default.
dev_port() {
  local hand port
  if [ -f "$DEV_PORT_FILE" ]; then
    cat "$DEV_PORT_FILE"
    return
  fi
  hand=$(hand_started_pids | head -1)
  [ -n "$hand" ] && port=$(listen_port "$hand")
  echo "${port:-3000}"
}
dev_url() { echo "http://localhost:$(dev_port)"; }

# True when this checkout has a dev server, however it was started.
dev_server_exists() { dev_running || [ -n "$(hand_started_pids)" ]; }

port_in_use() { (echo > "/dev/tcp/localhost/$1") > /dev/null 2>&1; }

# First free port from 3000, so a lone worktree keeps the usual URL.
free_port() {
  local p
  for p in $(seq 3000 3099); do
    port_in_use "$p" || {
      echo "$p"
      return 0
    }
  done
  return 1
}
