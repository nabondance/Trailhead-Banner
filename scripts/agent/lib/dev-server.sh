#!/bin/bash
# Shared by the dev-server scripts. Several worktrees can run a dev server at
# once, so each one records its own PID and port instead of assuming :3000.
# Source from the repository root.

DEV_PID_FILE=.dev-server.pid
DEV_PORT_FILE=.dev-server.port

dev_port() { cat "$DEV_PORT_FILE" 2> /dev/null || echo 3000; }
dev_url() { echo "http://localhost:$(dev_port)"; }

# True when this worktree's own dev server process is alive.
dev_running() {
  [ -f "$DEV_PID_FILE" ] && ps -p "$(cat "$DEV_PID_FILE")" > /dev/null 2>&1
}

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
