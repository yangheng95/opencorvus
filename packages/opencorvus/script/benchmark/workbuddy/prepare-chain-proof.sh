#!/usr/bin/env bash
set -euo pipefail

workbuddy_root=/var/lib/opencorvus-benchmark/source/workbuddy-bench
active_runner=/var/lib/opencorvus-benchmark/opencorvus-runner
runtime_source=/var/lib/opencorvus-benchmark/source/opencorvus-workbuddy-runtime-e8cdd1be
control_root=/var/lib/opencorvus-benchmark/control-workbuddy-luna-mission-base-code-v20260825-chain-proof
bench_root=/mnt/d/myhexin-local/opencorvus-bench
bench_commit="${OPENCORVUS_BENCH_COMMIT:?OPENCORVUS_BENCH_COMMIT must be supplied by the Windows worktree owner}"
adapter_root="$bench_root/packages/opencorvus/script/benchmark/workbuddy"
image_context="$control_root/harness-image"
payload_root="$image_context/payload"
official_commit=625b2233093ae4f23e76be28c1f341d41cc70373
runtime_commit=e8cdd1be4d280399bbb953562000b430f4e59fe7
image=workbuddy-bench/harness/opencorvus:chain-proof-r1

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
  cp -al "$active_runner/node_modules" "$runtime_source/node_modules"
fi
test "$(git -C "$runtime_source" rev-parse HEAD)" = "$runtime_commit"
while IFS= read -r source_modules; do
  relative="${source_modules#"$active_runner"/}"
  target_modules="$runtime_source/$relative"
  if [ ! -e "$target_modules" ]; then
    mkdir -p "$(dirname "$target_modules")"
    cp -al "$source_modules" "$target_modules"
  fi
done < <(find "$active_runner/packages" -mindepth 2 -maxdepth 4 -type d -name node_modules -print)

if [ ! -f "$runtime_source/packages/opencorvus/dist/binary/opencorvus-linux-x64/opencorvus-bundle.tar.gz" ]; then
  cd "$runtime_source"
  PATH=/var/lib/opencorvus-benchmark/bun/bin:$PATH \
    /var/lib/opencorvus-benchmark/bun/bin/bun run script/package-linux-binary.ts
fi

mkdir -p "$payload_root/bin" "$payload_root/share/workbuddybench-code"
tar -xzf "$runtime_source/packages/opencorvus/dist/binary/opencorvus-linux-x64/opencorvus-bundle.tar.gz" \
  -C "$payload_root"
install -m 0644 "$adapter_root/configs/harnesses/opencorvus/docker/Dockerfile" \
  "$image_context/Dockerfile"
install -m 0755 "$adapter_root/run_opencorvus_trial.py" \
  "$payload_root/bin/run-opencorvus-workbuddy.py"
install -m 0644 "$adapter_root/workbuddybench-code.SKILL.md" \
  "$payload_root/share/workbuddybench-code/SKILL.md"

docker_exe='/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe'
test -x "$docker_exe"
image_context_windows="$(wslpath -w "$image_context")"
"$docker_exe" build --pull=false -f "$image_context_windows\\Dockerfile" -t "$image" "$image_context_windows"
"$docker_exe" image inspect "$image" > "$control_root/image-inspect.json"

python3 - "$control_root/source-receipt.json" "$bench_root" "$bench_commit" "$workbuddy_root" "$runtime_source" "$image" "$control_root/image-inspect.json" <<'PY'
import hashlib
import json
import subprocess
import sys
from pathlib import Path

output, bench, bench_commit, workbuddy, runtime, image, image_inspect_path = sys.argv[1:]
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
bundle = Path(runtime) / 'packages/opencorvus/dist/binary/opencorvus-linux-x64/opencorvus-bundle.tar.gz'
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
}
Path(output).write_text(json.dumps(receipt, indent=2) + '\n')
PY

echo "chain-proof payload prepared"
echo "image=$image"
echo "payload=$payload_root"
