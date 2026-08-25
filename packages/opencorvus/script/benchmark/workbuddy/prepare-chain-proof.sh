#!/usr/bin/env bash
set -euo pipefail

workbuddy_root=/var/lib/opencorvus-benchmark/source/workbuddy-bench
active_runner=/var/lib/opencorvus-benchmark/opencorvus-runner
runtime_source=/var/lib/opencorvus-benchmark/source/opencorvus-workbuddy-runtime-e8cdd1be-r2
control_root=/var/lib/opencorvus-benchmark/control-workbuddy-luna-mission-base-code-v20260825-chain-proof
bench_root=/mnt/d/myhexin-local/opencorvus-bench
bench_commit="${OPENCORVUS_BENCH_COMMIT:?OPENCORVUS_BENCH_COMMIT must be supplied by the Windows worktree owner}"
adapter_root="$bench_root/packages/opencorvus/script/benchmark/workbuddy"
image_context="$control_root/harness-image"
payload_root="$image_context/payload"
runtime_bundle_dir="$runtime_source/packages/opencorvus/dist/opencorvus-linux-x64"
runtime_bundle_archive="$control_root/opencorvus-linux-x64-bundle.tar.gz"
official_commit=625b2233093ae4f23e76be28c1f341d41cc70373
runtime_commit=e8cdd1be4d280399bbb953562000b430f4e59fe7
image=workbuddy-bench/harness/opencorvus:chain-proof-r1
docker_socket=/mnt/wsl/docker-desktop/shared-sockets/host-services/docker.proxy.sock
provider_volume=opencorvus-workbuddy-provider-chain-proof-r1
provider_volume_owned=0
. "$adapter_root/docker-volume-lifecycle.sh"

cleanup_failed_preparation() {
  rc=$?
  if [ "$rc" -ne 0 ] && [ "$provider_volume_owned" -eq 1 ]; then
    if ! workbuddy_remove_provider_volume "$provider_volume"; then
      workbuddy_write_cleanup_pending "$control_root" "$provider_volume" "preparation_failed_cleanup_unavailable"
    fi
  fi
  trap - EXIT
  exit "$rc"
}
trap cleanup_failed_preparation EXIT

mkdir -p "$control_root"
exec 8>"$control_root/chain-proof.lock"
if ! flock -n 8; then
  echo "chain-proof lock is already held" >&2
  exit 4
fi
if [ -f "$control_root/orphan-recovery-pending.json" ]; then
  echo "orphan recovery is pending; preserve container and volume for recovery" >&2
  exit 6
fi

test "$(git -C "$workbuddy_root" rev-parse HEAD)" = "$official_commit"
case "$bench_commit" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
  *) echo "invalid OPENCORVUS_BENCH_COMMIT" >&2; exit 1 ;;
esac
test "$(git -C "$active_runner" rev-parse HEAD)" = "$runtime_commit"

mkdir -p \
  "$workbuddy_root/configs/harnesses/opencorvus/versions" \
  "$workbuddy_root/configs/harnesses/opencorvus/docker" \
  "$workbuddy_root/configs/models" \
  "$workbuddy_root/configs/jobs" \
  "$control_root"

install -m 0644 "$adapter_root/configs/harnesses/opencorvus/_defaults.yaml" \
  "$workbuddy_root/configs/harnesses/opencorvus/_defaults.yaml"
install -m 0644 "$adapter_root/configs/harnesses/opencorvus/versions/chain-proof-r1.yaml" \
  "$workbuddy_root/configs/harnesses/opencorvus/versions/chain-proof-r1.yaml"
install -m 0644 "$adapter_root/configs/harnesses/opencorvus/docker/Dockerfile" \
  "$workbuddy_root/configs/harnesses/opencorvus/docker/Dockerfile"
install -m 0644 "$adapter_root/configs/models/opencorvus-luna.yaml" \
  "$workbuddy_root/configs/models/opencorvus-luna.yaml"
install -m 0644 "$adapter_root/configs/jobs/opencorvus-luna-code-chain-proof.yaml" \
  "$workbuddy_root/configs/jobs/opencorvus-luna-code-chain-proof.yaml"
install -m 0644 "$adapter_root/opencorvus_agent.py" "$workbuddy_root/src/opencorvus_agent.py"

if ! grep -F '"opencorvus-agent": HarnessRuntimeAdapter(' \
  "$workbuddy_root/src/workbuddy_bench/runner/harness_adapters.py" >/dev/null; then
  git -C "$workbuddy_root" apply "$adapter_root/workbuddy-harness-adapter.patch"
fi

python3 - <<'PY'
import os
import shlex
from pathlib import Path

target = Path('/var/lib/opencorvus-benchmark/source/workbuddy-bench/.env')
content = '\n'.join([
    'OPENCORVUS_WB_BASE_URL=' + shlex.quote('https://chatgpt.com/backend-api/codex'),
    'OPENCORVUS_WB_API_KEY=' + shlex.quote('opencorvus-managed-provider'),
    '',
])
target.write_text(content)
os.chmod(target, 0o600)
PY

if [ ! -d "$runtime_source/.git" ]; then
  git clone --shared --no-checkout "$active_runner" "$runtime_source"
  git -C "$runtime_source" checkout --detach "$runtime_commit"
fi
test "$(git -C "$runtime_source" rev-parse HEAD)" = "$runtime_commit"
if [ ! -d "$runtime_source/node_modules" ]; then
  cd "$runtime_source"
  PATH=/var/lib/opencorvus-benchmark/bun/bin:$PATH \
    /var/lib/opencorvus-benchmark/bun/bin/bun install --frozen-lockfile
fi

cd "$runtime_source"
PATH=/var/lib/opencorvus-benchmark/bun/bin:$PATH \
  /var/lib/opencorvus-benchmark/bun/bin/bun run --cwd packages/sdk/js build
test -f "$runtime_source/packages/sdk/js/dist/expert-squad-authoring.js"

if [ ! -x "$runtime_bundle_dir/opencorvus" ] || \
   [ ! -f "$runtime_bundle_dir/package.json" ] || \
   [ ! -f "$runtime_bundle_dir/work-artifact-target-package-manifest.json" ]; then
  cd "$runtime_source"
  PATH=/var/lib/opencorvus-benchmark/bun/bin:$PATH \
    /var/lib/opencorvus-benchmark/bun/bin/bun run --cwd packages/opencorvus script/build.ts --single
fi
"$runtime_bundle_dir/opencorvus" --version
if [ ! -f "$runtime_bundle_archive" ]; then
  tar -czf "$runtime_bundle_archive" -C "$runtime_bundle_dir" .
fi

mkdir -p "$payload_root/bin" "$payload_root/share/workbuddybench-code"
tar -xzf "$runtime_bundle_archive" -C "$payload_root"
install -m 0644 "$adapter_root/configs/harnesses/opencorvus/docker/Dockerfile" \
  "$image_context/Dockerfile"
install -m 0755 "$adapter_root/run_opencorvus_trial.py" \
  "$payload_root/bin/run-opencorvus-workbuddy.py"
install -m 0644 "$adapter_root/workbuddybench-code.SKILL.md" \
  "$payload_root/share/workbuddybench-code/SKILL.md"

docker_exe="$workbuddy_windows_docker"
test -x "$docker_exe"
test -S "$docker_socket"
export DOCKER_HOST="unix://$docker_socket"
docker version --format '{{.Server.Version}} {{.Server.Os}}/{{.Server.Arch}}' >/dev/null
cd "$bench_root"
tar -C "$image_context" -cf - . | "$docker_exe" build --pull=false --provenance=false --load -t "$image" -
"$docker_exe" image inspect "$image" > "$control_root/image-inspect.json"

workbuddy_remove_provider_volume "$provider_volume"
workbuddy_clear_cleanup_pending "$control_root"
docker volume create "$provider_volume" >/dev/null
provider_volume_owned=1
provider_mountpoint="$(docker volume inspect --format '{{.Mountpoint}}' "$provider_volume")"
test -n "$provider_mountpoint"

python3 - "$workbuddy_root/configs/jobs/opencorvus-luna-code-chain-proof.yaml" "$provider_mountpoint" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
mountpoint = sys.argv[2]
placeholder = "__OPENCORVUS_PROVIDER_MOUNTPOINT__"
content = path.read_text()
if content.count(placeholder) != 3:
    raise SystemExit("WorkBuddy job must contain exactly three provider-volume placeholders")
path.write_text(content.replace(placeholder, mountpoint))
PY

python3 - "$control_root/source-receipt.json" "$bench_root" "$bench_commit" "$workbuddy_root" "$runtime_source" "$runtime_bundle_archive" "$image" "$control_root/image-inspect.json" "$provider_volume" "$provider_mountpoint" <<'PY'
import hashlib
import json
import subprocess
import sys
from pathlib import Path

output, bench, bench_commit, workbuddy, runtime, bundle_path, image, image_inspect_path, provider_volume, provider_mountpoint = sys.argv[1:]
def git(path, *args):
    return subprocess.check_output(['git', '-C', path, *args], text=True).strip()
adapter_root = Path(bench) / 'packages/opencorvus/script/benchmark/workbuddy'
tracked_adapter_files = sorted(
    path for path in adapter_root.rglob('*')
    if path.is_file() and '__pycache__' not in path.parts and path.suffix not in {'.pyc'}
)
adapter_files = []
for path in tracked_adapter_files:
    data = path.read_bytes()
    adapter_files.append({
        'path': path.relative_to(Path(bench)).as_posix(),
        'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(),
    })
image_inspect = json.loads(Path(image_inspect_path).read_text())[0]
bundle = Path(bundle_path)
receipt = {
    'schema_version': 1,
    'bench_commit': bench_commit,
    'workbuddy_upstream_commit': git(workbuddy, 'rev-parse', 'HEAD'),
    'workbuddy_overlay_diff_sha256': hashlib.sha256(
        subprocess.check_output(['git', '-C', workbuddy, 'diff', '--binary'])
    ).hexdigest(),
    'opencorvus_runtime_commit': git(runtime, 'rev-parse', 'HEAD'),
    'runtime_bundle_sha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
    'adapter_files': adapter_files,
    'image': {
        'tag': image,
        'id': image_inspect.get('Id'),
        'repo_digests': image_inspect.get('RepoDigests') or [],
        'size': image_inspect.get('Size'),
        'created': image_inspect.get('Created'),
    },
    'credential_projection': {
        'type': 'ephemeral_docker_volume',
        'volume': provider_volume,
        'mountpoint': provider_mountpoint,
        'files': ['auth.json', 'models.json', 'source-receipt.json'],
    },
}
Path(output).write_text(json.dumps(receipt, indent=2) + '\n')
PY

docker pull "$workbuddy_provider_utility_image" >/dev/null
tar -C /var/lib/opencorvus-benchmark/provider-data -cf - auth.json models.json | \
  docker run --rm -i --mount "type=volume,source=$provider_volume,target=/target" \
    "$workbuddy_provider_utility_image" tar -C /target -xf -
tar -C "$control_root" -cf - source-receipt.json | \
  docker run --rm -i --mount "type=volume,source=$provider_volume,target=/target" \
    "$workbuddy_provider_utility_image" tar -C /target -xf -
docker run --rm --mount "type=volume,source=$provider_volume,target=/target" \
  "$workbuddy_provider_utility_image" sh -ceu \
    'chmod 600 /target/auth.json /target/models.json; chmod 644 /target/source-receipt.json; test "$(find /target -mindepth 1 -maxdepth 1 -type f | wc -l)" -eq 3; test -s /target/auth.json; test -s /target/models.json; test -s /target/source-receipt.json'
workbuddy_clear_cleanup_pending "$control_root"

echo "chain-proof payload prepared"
echo "image=$image"
echo "payload=$payload_root"
echo "provider_projection=ephemeral_docker_volume:$provider_volume"
