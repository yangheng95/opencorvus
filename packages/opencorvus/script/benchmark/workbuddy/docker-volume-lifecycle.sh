#!/usr/bin/env bash

workbuddy_docker_socket=/mnt/wsl/docker-desktop/shared-sockets/host-services/docker.proxy.sock
workbuddy_windows_docker='/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe'
workbuddy_windows_cwd=/mnt/d/myhexin-local/opencorvus-bench

workbuddy_docker_with_engine() {
  if [ -S "$workbuddy_docker_socket" ] && \
     DOCKER_HOST="unix://$workbuddy_docker_socket" docker version >/dev/null 2>&1; then
    DOCKER_HOST="unix://$workbuddy_docker_socket" docker "$@"
    return
  fi
  if [ -x "$workbuddy_windows_docker" ]; then
    (cd "$workbuddy_windows_cwd" && "$workbuddy_windows_docker" "$@")
    return
  fi
  return 127
}

workbuddy_remove_provider_volume() {
  local volume="$1"
  if workbuddy_docker_with_engine volume inspect "$volume" >/dev/null 2>&1; then
    workbuddy_docker_with_engine volume rm "$volume" >/dev/null
    return
  fi
  workbuddy_docker_with_engine version >/dev/null 2>&1
}

workbuddy_write_cleanup_pending() {
  local control_root="$1"
  local volume="$2"
  local reason="$3"
  python3 - "$control_root/provider-volume-cleanup-pending.json" "$volume" "$reason" <<'PY'
import json
import time
import sys
from pathlib import Path

Path(sys.argv[1]).write_text(json.dumps({
    "schema_version": 1,
    "volume": sys.argv[2],
    "reason": sys.argv[3],
    "recorded_at": time.time(),
}, indent=2) + "\n")
PY
}

workbuddy_clear_cleanup_pending() {
  python3 - "$1/provider-volume-cleanup-pending.json" <<'PY'
import sys
from pathlib import Path

Path(sys.argv[1]).unlink(missing_ok=True)
PY
}
