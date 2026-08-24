#!/usr/bin/env bash
set -euo pipefail

runner_root=/var/lib/opencorvus-benchmark/opencorvus-runner
evidence_root=/var/lib/opencorvus-benchmark/evidence-sol-mission-base-v20260823-r1
control_root=/var/lib/opencorvus-benchmark/control-sol-mission-base-v20260823-r1
dashboard_root=/mnt/d/myhexin-local/opencorvus-benchmark-results/sol-mission-base-v20260823-r1

cd "$runner_root"
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/codex/automation-workbuddy-benchmark)"
mkdir -p "$evidence_root" "$control_root" "$dashboard_root"
chmod 0700 "$evidence_root" "$control_root"
exec 9>"$control_root/supervisor.lock"
flock -n 9 || exit 1
packages/opencorvus/script/benchmark/external-agent/install-automationbench-restricted-shells.sh

. packages/opencorvus/script/benchmark/external-agent/load-automationbench-environment.sh

exec >>"$control_root/supervisor.log" 2>&1

batch_is_complete() {
  local batch_index="$1"
  test -s "$evidence_root/evidence-catalog.json" || return 1
  /root/.bun/bin/bun -e '
    const catalog = await Bun.file(process.argv[1]).json()
    const batchIndex = Number(process.argv[2])
    process.exit(catalog.batches?.some((batch) =>
      batch.batch_index === batchIndex && batch.audit?.passed === true && batch.audit?.status === "completed"
    ) ? 0 : 1)
  ' "$evidence_root/evidence-catalog.json" "$batch_index"
}

active_coordinator=""
terminate_supervisor() {
  trap - INT TERM HUP
  if [[ -n "$active_coordinator" ]]; then
    kill -TERM "$active_coordinator" 2>/dev/null || true
    wait "$active_coordinator" 2>/dev/null || true
  fi
  exit 130
}
trap terminate_supervisor INT TERM HUP

for batch_index in {1..10}; do
  if batch_is_complete "$batch_index"; then
    continue
  fi
  printf '{"event":"sol_base_batch_start","batch_index":%s,"started_at":%s}\n' \
    "$batch_index" "$(date +%s%3N)"
  /root/.bun/bin/bun \
    packages/opencorvus/script/benchmark/external-agent/run-automationbench-batch.ts \
    --python /var/lib/opencorvus-benchmark/evaluator-venv/bin/python \
    --source-data /var/lib/opencorvus-benchmark/provider-data \
    --output "$evidence_root" \
    --restricted-shell /var/lib/opencorvus-benchmark/restricted-agent-shell-base \
    --control-root "$control_root" \
    --dashboard "$dashboard_root/index.html" \
    --batch-index "$batch_index" \
    --repetition 1 \
    --model openai/gpt-5.6-sol \
    --profiles base \
    --inactivity-ms 600000 &
  active_coordinator=$!
  wait "$active_coordinator"
  active_coordinator=""
  printf '{"event":"sol_base_batch_complete","batch_index":%s,"completed_at":%s}\n' \
    "$batch_index" "$(date +%s%3N)"
done

/root/.bun/bin/bun \
  packages/opencorvus/script/benchmark/external-agent/verify-automationbench-evidence.ts \
  --root "$evidence_root" \
  --source-data /var/lib/opencorvus-benchmark/provider-data \
  --python /var/lib/opencorvus-benchmark/evaluator-venv/bin/python \
  --restricted-shell /var/lib/opencorvus-benchmark/restricted-agent-shell-base \
  --model openai/gpt-5.6-sol \
  --profiles base \
  --repetition 1 \
  --mode final
