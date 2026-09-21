#!/usr/bin/env bash
set -euo pipefail

workbuddy_root=/var/lib/opencorvus-benchmark/source/workbuddy-bench
evidence_root=/var/lib/opencorvus-benchmark/evidence-workbuddy-luna-mission-base-code-v20260825-chain-proof
control_root=/var/lib/opencorvus-benchmark/control-workbuddy-luna-mission-base-code-v20260825-chain-proof
adapter_root=/mnt/d/myhexin-local/opencorvus-bench/packages/opencorvus/script/benchmark/workbuddy
catalog="$adapter_root/catalog_chain_proof.py"
active="$control_root/active-run.json"
docker_socket=/mnt/wsl/docker-desktop/shared-sockets/host-services/docker.proxy.sock
provider_volume=opencorvus-workbuddy-provider-chain-proof-r1
. "$adapter_root/docker-volume-lifecycle.sh"
runner_pid=""
runner_start_time=""
runner_pgid=""
provider_mountpoint=""
recovery_failure_reason="container_cleanup_or_evidence_recovery_failed"

cleanup_provider_volume() {
  workbuddy_remove_provider_volume "$provider_volume"
}

cleanup_owned_exit() {
  rc=$?
  if ! cleanup_provider_volume; then
    workbuddy_write_cleanup_pending "$control_root" "$provider_volume" "supervisor_exit_cleanup_unavailable"
    [ "$rc" -ne 0 ] || rc=5
  fi
  trap - EXIT
  exit "$rc"
}

runner_group_state() {
  local pgid="$1"
  local rows state
  if ! rows="$(ps -eo pgid=,stat= 2>/dev/null)"; then
    printf 'observation_error\n'
    return 0
  fi
  if ! state="$(awk -v pgid="$pgid" '$1 == pgid && $2 !~ /^Z/ { found=1 } END { print found ? "live" : "absent" }' <<<"$rows")"; then
    printf 'observation_error\n'
    return 0
  fi
  printf '%s\n' "$state"
}

runner_leader_identity_state() {
  local pid="$1"
  local expected_start="$2"
  local stat_path="/proc/$pid/stat"
  local current_start
  if [ ! -e "$stat_path" ]; then
    printf 'absent\n'
    return 0
  fi
  if [ ! -r "$stat_path" ] || ! current_start="$(cut -d ' ' -f 22 "$stat_path")" || [ -z "$current_start" ]; then
    printf 'observation_error\n'
    return 0
  fi
  if [ -n "$expected_start" ] && [ "$current_start" = "$expected_start" ]; then
    printf 'same\n'
  else
    printf 'identity_mismatch\n'
  fi
}

stop_runner_group() {
  local leader_state group_state
  if [ -z "$runner_pid" ] || [ -z "$runner_pgid" ]; then
    return 0
  fi
  leader_state="$(runner_leader_identity_state "$runner_pid" "$runner_start_time")"
  case "$leader_state" in
    same|absent) ;;
    *)
      recovery_failure_reason="runner_group_state_unavailable:$runner_pgid"
      return 1
      ;;
  esac
  group_state="$(runner_group_state "$runner_pgid")"
  case "$group_state" in
    absent) return 0 ;;
    live) ;;
    *)
      recovery_failure_reason="runner_group_state_unavailable:$runner_pgid"
      return 1
      ;;
  esac
  kill -TERM -- "-$runner_pgid" >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    group_state="$(runner_group_state "$runner_pgid")"
    case "$group_state" in
      absent)
        wait "$runner_pid" >/dev/null 2>&1 || true
        return 0
        ;;
      live) ;;
      *)
        recovery_failure_reason="runner_group_state_unavailable:$runner_pgid"
        return 1
        ;;
    esac
    sleep 1
  done
  kill -KILL -- "-$runner_pgid" >/dev/null 2>&1 || true
  for _ in $(seq 1 10); do
    group_state="$(runner_group_state "$runner_pgid")"
    case "$group_state" in
      absent)
        wait "$runner_pid" >/dev/null 2>&1 || true
        return 0
        ;;
      live) ;;
      *)
        recovery_failure_reason="runner_group_state_unavailable:$runner_pgid"
        return 1
        ;;
    esac
    sleep 1
  done
  recovery_failure_reason="runner_group_live_survivor:$runner_pgid"
  return 1
}

write_orphan_recovery_pending() {
  local reason="$1"
  python3 - "$control_root/orphan-recovery-pending.json" "$run_id" "$provider_volume" "$reason" "$runner_pgid" <<'PY'
import json
import time
import sys
from pathlib import Path

Path(sys.argv[1]).write_text(json.dumps({
    "schema_version": 1,
    "run_id": sys.argv[2],
    "provider_volume": sys.argv[3],
    "reason": sys.argv[4],
    "runner_pgid": int(sys.argv[5]) if sys.argv[5] else None,
    "recorded_at": time.time(),
}, indent=2) + "\n")
PY
}

clear_orphan_recovery_pending() {
  python3 - "$control_root/orphan-recovery-pending.json" <<'PY'
import sys
from pathlib import Path

Path(sys.argv[1]).unlink(missing_ok=True)
PY
}

quiesce_recovery_failure() {
  local id="$1"
  local running="$2"
  local state
  if [ "$running" != "true" ]; then
    return 0
  fi
  docker stop --timeout 10 "$id" >/dev/null 2>&1 || \
    docker kill --signal KILL "$id" >/dev/null 2>&1 || true
  for _ in $(seq 1 10); do
    if ! state="$(docker inspect --format '{{.State.Running}}' "$id" 2>/dev/null)"; then
      recovery_failure_reason="container_recovery_state_unavailable:$id"
      return 1
    fi
    if [ "$state" = "false" ]; then
      return 0
    fi
    sleep 1
  done
  recovery_failure_reason="container_recovery_running_survivor:$id"
  return 1
}

recover_trial_containers() {
  local container_list id identity running auth_source owner_source owner_id
  local owner_probe audit_probe recovery_root
  local -a containers
  if ! container_list="$(docker ps -aq --no-trunc)"; then
    return 1
  fi
  containers=()
  if [ -n "$container_list" ]; then
    mapfile -t containers <<<"$container_list"
  fi
  for id in "${containers[@]}"; do
    if ! identity="$(docker inspect "$id" | python3 -c '
import json, sys
row = json.load(sys.stdin)[0]
mounts = {item.get("Destination"): item.get("Source") for item in row.get("Mounts") or []}
print("\t".join([
    str(bool((row.get("State") or {}).get("Running"))).lower(),
    str(mounts.get("/run/secrets/opencorvus-provider/auth.json") or ""),
    str(mounts.get("/run/evidence/attempt-owner.json") or ""),
]))
')"; then
      return 1
    fi
    IFS=$'\t' read -r running auth_source owner_source <<<"$identity"
    if [ "$auth_source" != "$provider_mountpoint/auth.json" ] || \
       [ "$owner_source" != "$provider_mountpoint/attempt-owner.json" ]; then
      continue
    fi
    if [ "$running" = "true" ]; then
      if ! owner_id="$(docker exec --user root "$id" python3 -c 'import json; print(json.load(open("/run/evidence/attempt-owner.json"))["run_id"])')"; then
        quiesce_recovery_failure "$id" "$running" || true
        return 1
      fi
    else
      owner_probe="$attempt_root/.attempt-owner-$id.json"
      if ! docker cp "$id:/run/evidence/attempt-owner.json" "$owner_probe" >/dev/null; then
        return 1
      fi
      if ! owner_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["run_id"])' "$owner_probe")"; then
        return 1
      fi
    fi
    if [ "$owner_id" != "$run_id" ]; then
      continue
    fi
    recovery_root="$attempt_root/orphan-recovery/$id/agent"
    mkdir -p "$recovery_root"
    if [ "$running" = "true" ]; then
      if ! docker exec --user root "$id" sh -ceu '
        pid_file=/logs/agent/opencorvus-server.pid
        pid=absent
        if [ -f "$pid_file" ]; then pid=$(cat "$pid_file"); fi
        OPENCORVUS_HOME=/tmp/opencorvus-workbuddy-home /opt/opencorvus/bin/run-opencorvus-workbuddy.py --cleanup-owned-processes
        printf "server_pid=%s\nserver_group_stopped=1\n" "$pid" > /logs/agent/host-cleanup.txt
        rm -f /logs/agent/credential-leak-audit.json
        OPENCORVUS_HOME=/tmp/opencorvus-workbuddy-home /opt/opencorvus/bin/run-opencorvus-workbuddy.py --finalize-host-cancelled
      '; then
        quiesce_recovery_failure "$id" "$running" || true
        return 1
      fi
      if ! docker exec --user root "$id" python3 -c 'import json; raise SystemExit(0 if json.load(open("/logs/agent/credential-leak-audit.json")).get("passed") is True else 2)'; then
        quiesce_recovery_failure "$id" "$running" || true
        return 1
      fi
      if ! docker exec --user root "$id" tar -C /logs/agent -cf - . | \
        tar -C "$recovery_root" -xf -; then
        quiesce_recovery_failure "$id" "$running" || true
        return 1
      fi
      if ! quiesce_recovery_failure "$id" "$running"; then
        return 1
      fi
    else
      audit_probe="$attempt_root/.credential-leak-audit-$id.json"
      if ! docker cp "$id:/logs/agent/credential-leak-audit.json" "$audit_probe" >/dev/null; then
        return 1
      fi
      if ! python3 -c 'import json,sys; raise SystemExit(0 if json.load(open(sys.argv[1])).get("passed") is True else 2)' "$audit_probe"; then
        return 1
      fi
      if ! docker cp "$id:/logs/agent/." "$recovery_root" >/dev/null; then
        return 1
      fi
    fi
    if ! docker rm "$id" >/dev/null; then
      return 1
    fi
  done
  return 0
}

finish_runtime_resources() {
  if ! stop_runner_group; then
    if [ "$recovery_failure_reason" = "container_cleanup_or_evidence_recovery_failed" ]; then
      recovery_failure_reason="runner_group_live_survivor:$runner_pgid"
    fi
    write_orphan_recovery_pending "$recovery_failure_reason"
    return 7
  fi
  if ! recover_trial_containers; then
    write_orphan_recovery_pending "$recovery_failure_reason"
    return 8
  fi
  clear_orphan_recovery_pending
  if ! cleanup_provider_volume; then
    workbuddy_write_cleanup_pending "$control_root" "$provider_volume" "trial_finished_cleanup_unavailable"
    return 5
  fi
  return 0
}

if [ "${1:-}" = "--recover-containers-only" ]; then
  : "${OPENCORVUS_RECOVERY_CONTROL_ROOT:?}"
  : "${OPENCORVUS_RECOVERY_EVIDENCE_ROOT:?}"
  : "${OPENCORVUS_RECOVERY_RUN_ID:?}"
  : "${OPENCORVUS_RECOVERY_ATTEMPT_ROOT:?}"
  : "${OPENCORVUS_RECOVERY_PROVIDER_VOLUME:?}"
  : "${OPENCORVUS_RECOVERY_PROVIDER_MOUNTPOINT:?}"
  control_root="$OPENCORVUS_RECOVERY_CONTROL_ROOT"
  evidence_root="$OPENCORVUS_RECOVERY_EVIDENCE_ROOT"
  run_id="$OPENCORVUS_RECOVERY_RUN_ID"
  attempt_root="$OPENCORVUS_RECOVERY_ATTEMPT_ROOT"
  provider_volume="$OPENCORVUS_RECOVERY_PROVIDER_VOLUME"
  provider_mountpoint="$OPENCORVUS_RECOVERY_PROVIDER_MOUNTPOINT"
  mkdir -p "$control_root" "$attempt_root"
  exec 8>"$control_root/chain-proof.lock"
  if ! flock -n 8; then
    echo "chain-proof supervisor lock is already held" >&2
    exit 4
  fi
  if [ -f "$control_root/orphan-recovery-pending.json" ]; then
    pending_runner_pgid="$(python3 -c 'import json,sys; value=json.load(open(sys.argv[1])).get("runner_pgid"); print(value if value is not None else "")' "$control_root/orphan-recovery-pending.json")"
    if [ -n "$pending_runner_pgid" ]; then
      pending_runner_state="$(runner_group_state "$pending_runner_pgid")"
      case "$pending_runner_state" in
        absent) ;;
        live)
          echo "runner group recovery is still pending for pgid $pending_runner_pgid" >&2
          exit 8
          ;;
        *)
          echo "runner group state is unavailable for pgid $pending_runner_pgid" >&2
          exit 8
          ;;
      esac
    fi
  fi
  if recover_trial_containers; then
    clear_orphan_recovery_pending
    exit 0
  fi
  write_orphan_recovery_pending "$recovery_failure_reason"
  exit 8
fi

if [ "${1:-}" = "--exercise-runner-group-failure" ]; then
  : "${OPENCORVUS_RUNNER_FAILURE_CONTROL_ROOT:?}"
  : "${OPENCORVUS_RUNNER_FAILURE_ATTEMPT_ROOT:?}"
  control_root="$OPENCORVUS_RUNNER_FAILURE_CONTROL_ROOT"
  attempt_root="$OPENCORVUS_RUNNER_FAILURE_ATTEMPT_ROOT"
  run_id="00000000-0000-4000-8000-000000000001"
  provider_volume="workbuddy-test-preserved-volume"
  runner_pgid=424242
  marker="$control_root/unexpected-resource-action"
  mkdir -p "$control_root" "$attempt_root"
  stop_runner_group() { return 1; }
  recover_trial_containers() { touch "$marker.recover"; return 0; }
  cleanup_provider_volume() { touch "$marker.cleanup"; return 0; }
  resource_rc=0
  finish_runtime_resources || resource_rc=$?
  test "$resource_rc" -eq 7
  test ! -e "$marker.recover"
  test ! -e "$marker.cleanup"
  python3 - "$control_root/orphan-recovery-pending.json" <<'PY'
import json
import sys

value = json.load(open(sys.argv[1]))
assert value["reason"] == "runner_group_live_survivor:424242"
assert value["runner_pgid"] == 424242
PY
  exit 0
fi

if [ "${1:-}" = "--exercise-runner-observation-failure" ]; then
  : "${OPENCORVUS_RUNNER_FAILURE_CONTROL_ROOT:?}"
  : "${OPENCORVUS_RUNNER_FAILURE_ATTEMPT_ROOT:?}"
  : "${OPENCORVUS_RUNNER_FAILURE_KIND:?}"
  control_root="$OPENCORVUS_RUNNER_FAILURE_CONTROL_ROOT"
  attempt_root="$OPENCORVUS_RUNNER_FAILURE_ATTEMPT_ROOT"
  run_id="00000000-0000-4000-8000-000000000002"
  provider_volume="workbuddy-test-preserved-volume"
  runner_pid=424241
  runner_pgid=424242
  runner_start_time=12345
  marker="$control_root/unexpected-resource-action"
  mkdir -p "$control_root" "$attempt_root"
  if [ "$OPENCORVUS_RUNNER_FAILURE_KIND" = "group" ]; then
    runner_leader_identity_state() { printf 'absent\n'; }
    runner_group_state() { printf 'observation_error\n'; }
  else
    runner_leader_identity_state() { printf 'observation_error\n'; }
  fi
  recover_trial_containers() { touch "$marker.recover"; return 0; }
  cleanup_provider_volume() { touch "$marker.cleanup"; return 0; }
  resource_rc=0
  finish_runtime_resources || resource_rc=$?
  test "$resource_rc" -eq 7
  test ! -e "$marker.recover"
  test ! -e "$marker.cleanup"
  python3 - "$control_root/orphan-recovery-pending.json" <<'PY'
import json
import sys

value = json.load(open(sys.argv[1]))
assert value["reason"] == "runner_group_state_unavailable:424242"
assert value["runner_pgid"] == 424242
PY
  exit 0
fi

if [ "${1:-}" = "--exercise-runner-group-cleanup" ]; then
  : "${OPENCORVUS_RUNNER_GROUP_CHILD_FILE:?}"
  setsid python3 - "$OPENCORVUS_RUNNER_GROUP_CHILD_FILE" <<'PY' &
import os
import sys
import time

child = os.fork()
if child == 0:
    time.sleep(300)
    os._exit(0)
with open(sys.argv[1], "w", encoding="ascii") as handle:
    handle.write(f"{child}\n")
os._exit(17)
PY
  runner_pid=$!
  runner_pgid=$runner_pid
  if [ -r "/proc/$runner_pid/stat" ]; then
    runner_start_time="$(cut -d ' ' -f 22 "/proc/$runner_pid/stat")"
  fi
  wait "$runner_pid" >/dev/null 2>&1 || true
  stop_runner_group
  python3 - "$OPENCORVUS_RUNNER_GROUP_CHILD_FILE" <<'PY'
import sys
import time
from pathlib import Path

child_file = Path(sys.argv[1])
deadline = time.monotonic() + 5
while time.monotonic() < deadline and not child_file.is_file():
    time.sleep(0.05)
pid = int(child_file.read_text())
stat = Path(f"/proc/{pid}/stat")
if stat.is_file() and stat.read_text().split()[2] != "Z":
    raise SystemExit("runner child remained live after process-group cleanup")
PY
  exit 0
fi

mkdir -p "$evidence_root" "$control_root"
exec 9>"$control_root/chain-proof.lock"
if ! flock -n 9; then
  echo "chain-proof supervisor lock is already held" >&2
  exit 4
fi
if [ -f "$control_root/orphan-recovery-pending.json" ]; then
  echo "orphan recovery is pending; preserve container and volume for recovery" >&2
  exit 6
fi
trap cleanup_owned_exit EXIT
if [ -f "$control_root/provider-volume-cleanup-pending.json" ]; then
  cleanup_provider_volume || exit 6
  echo "cleared pending provider volume; rerun preparation before benchmark launch" >&2
  exit 6
fi
test -S "$docker_socket"
export DOCKER_HOST="unix://$docker_socket"
docker version --format '{{.Server.Version}} {{.Server.Os}}/{{.Server.Arch}}' >/dev/null
docker volume inspect "$provider_volume" >/dev/null
provider_mountpoint="$(docker volume inspect --format '{{.Mountpoint}}' "$provider_volume")"
test -n "$provider_mountpoint"
python3 "$catalog" --evidence-root "$evidence_root" --control-root "$control_root" --preflight

run_id="$(python3 -c 'import uuid; print(uuid.uuid4())')"
attempt_root="$evidence_root/attempts/$run_id"
mkdir -p "$attempt_root"
python3 - "$attempt_root/attempt-owner.json" "$run_id" <<'PY'
import json
import sys
from pathlib import Path

Path(sys.argv[1]).write_text(json.dumps({
    "schema_version": 1,
    "run_id": sys.argv[2],
}, indent=2) + "\n")
PY
docker image inspect "$workbuddy_provider_utility_image" >/dev/null
tar -C "$attempt_root" -cf - attempt-owner.json | \
  docker run --rm -i --mount "type=volume,source=$provider_volume,target=/target" \
    "$workbuddy_provider_utility_image" tar -C /target -xf -
docker run --rm --mount "type=volume,source=$provider_volume,target=/target" \
  "$workbuddy_provider_utility_image" sh -ceu \
    'chmod 644 /target/attempt-owner.json; test -s /target/attempt-owner.json'
attempt_owner_source="$provider_mountpoint/attempt-owner.json"
runtime_job_slug=opencorvus-luna-code-chain-proof-runtime
runtime_job="$workbuddy_root/configs/jobs/$runtime_job_slug.yaml"
python3 - "$workbuddy_root/configs/jobs/opencorvus-luna-code-chain-proof.yaml" "$runtime_job" "$attempt_root" "$attempt_owner_source" <<'PY'
import sys
from pathlib import Path
import yaml

source, target, attempt_root, attempt_owner_source = sys.argv[1:]
job = yaml.safe_load(Path(source).read_text())
job['jobs_dir'] = attempt_root
job.setdefault('environment_override', {}).setdefault('mounts', []).append({
    'type': 'bind',
    'source': attempt_owner_source,
    'target': '/run/evidence/attempt-owner.json',
    'read_only': True,
})
Path(target).write_text(yaml.safe_dump(job, sort_keys=False))
PY

python3 - "$active" "$run_id" "$attempt_root" <<'PY'
import json
import os
import time
from pathlib import Path
import sys

path = Path(sys.argv[1])
value = {
    'schema_version': 1,
    'run_id': sys.argv[2],
    'attempt_root': sys.argv[3],
    'pid': os.getppid(),
    'pid_start_time': Path(f'/proc/{os.getppid()}/stat').read_text().split()[21],
    'status': 'running',
    'started_at': time.time(),
}
path.write_text(json.dumps(value, indent=2) + '\n')
PY

finish() {
  rc=$?
  local resource_rc=0
  trap - INT TERM HUP
  finish_runtime_resources || resource_rc=$?
  if [ "$rc" -eq 0 ] && [ "$resource_rc" -ne 0 ]; then rc=$resource_rc; fi
  python3 "$catalog" --evidence-root "$evidence_root" --control-root "$control_root" || true
  python3 - "$active" "$rc" <<'PY'
import json
import time
import sys
from pathlib import Path

path = Path(sys.argv[1])
value = json.loads(path.read_text()) if path.is_file() else {'schema_version': 1}
value.update({'status': 'finished', 'exit_code': int(sys.argv[2]), 'finished_at': time.time()})
path.write_text(json.dumps(value, indent=2) + '\n')
PY
  trap - EXIT
  exit "$rc"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

cd "$workbuddy_root"
setsid env PYTHONPATH="$workbuddy_root/src" \
  /var/lib/opencorvus-benchmark/bin/uv run ./scripts/run.sh \
  --job "$runtime_job_slug" &
runner_pid=$!
runner_pgid=$runner_pid
runner_start_time="$(cut -d ' ' -f 22 "/proc/$runner_pid/stat")"
wait "$runner_pid"
