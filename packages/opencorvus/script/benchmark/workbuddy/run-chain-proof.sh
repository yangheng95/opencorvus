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

mkdir -p "$evidence_root" "$control_root"
exec 9>"$control_root/chain-proof.lock"
if ! flock -n 9; then
  echo "chain-proof supervisor lock is already held" >&2
  exit 4
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
python3 "$catalog" --evidence-root "$evidence_root" --control-root "$control_root" --preflight

run_id="$(python3 -c 'import uuid; print(uuid.uuid4())')"
attempt_root="$evidence_root/attempts/$run_id"
runtime_job_slug=opencorvus-luna-code-chain-proof-runtime
runtime_job="$workbuddy_root/configs/jobs/$runtime_job_slug.yaml"
python3 - "$workbuddy_root/configs/jobs/opencorvus-luna-code-chain-proof.yaml" "$runtime_job" "$attempt_root" <<'PY'
import sys
from pathlib import Path
import yaml

source, target, attempt_root = sys.argv[1:]
job = yaml.safe_load(Path(source).read_text())
job['jobs_dir'] = attempt_root
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
  python3 "$catalog" --evidence-root "$evidence_root" --control-root "$control_root" || true
  if ! cleanup_provider_volume; then
    workbuddy_write_cleanup_pending "$control_root" "$provider_volume" "trial_finished_cleanup_unavailable"
    [ "$rc" -ne 0 ] || rc=5
  fi
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

cd "$workbuddy_root"
PYTHONPATH="$workbuddy_root/src" \
  /var/lib/opencorvus-benchmark/bin/uv run ./scripts/run.sh \
  --job "$runtime_job_slug"
