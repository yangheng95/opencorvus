#!/usr/bin/env bash
set -euo pipefail

runner_root=/var/lib/opencorvus-benchmark/opencorvus-runner
evidence_root=/var/lib/opencorvus-benchmark/evidence-luna-mission-base-v20260822-r3
control_root=/var/lib/opencorvus-benchmark/control-luna-mission-base-v20260822-r3
dashboard_root=/mnt/d/myhexin-local/opencorvus-benchmark-results/luna-mission-base-v20260822-r3
target_repetitions=12

cd "$runner_root"
runner_status="$(git status --porcelain)"
runner_head="$(git rev-parse HEAD)"
runner_origin="$(git rev-parse origin/codex/automation-workbuddy-benchmark)"
test -z "$runner_status"
test "$runner_head" = "$runner_origin"
test -s "$evidence_root/evidence-catalog.json"
mkdir -p "$control_root" "$dashboard_root"
chmod 0700 "$evidence_root" "$control_root"
exec 9>"$control_root/supervisor.lock"
flock -n 9 || exit 1

set -a
. /var/lib/opencorvus-benchmark/provider-data/exa.env
set +a
export HTTP_PROXY=http://172.26.64.1:17892
export HTTPS_PROXY=http://172.26.64.1:17892
export ALL_PROXY=http://172.26.64.1:17892
export NO_PROXY=127.0.0.1,localhost

exec >>"$control_root/supervisor-600.log" 2>&1

batch_is_complete() {
  local repetition="$1"
  local batch_index="$2"
  /root/.bun/bin/bun -e '
    const { automationBenchBatchPlanMatches } = await import(
      "./packages/opencorvus/script/benchmark/external-agent/contract.ts"
    )
    const catalog = await Bun.file(process.argv[1]).json()
    const repetition = Number(process.argv[2])
    const batchIndex = Number(process.argv[3])
    const root = process.argv[4]
    for (const batch of catalog.batches ?? []) {
      if (
        batch.batch_index !== batchIndex ||
        batch.repetition !== repetition ||
        batch.audit?.passed !== true ||
        batch.audit?.status !== "completed" ||
        typeof batch.plan !== "string"
      ) continue
      const plan = await Bun.file(`${root}/${batch.plan}`).json()
      if (automationBenchBatchPlanMatches(plan, {
        schema_version: 2,
        batch_index: batchIndex,
        model: "openai/gpt-5.6-luna",
        launch_mode: "mission",
        repetition,
        trial_concurrency: 5,
        schedule_mode: "rolling_case_slots_v1",
        profiles: ["base"],
        case_count: 5,
      })) process.exit(0)
    }
    process.exit(1)
  ' "$evidence_root/evidence-catalog.json" "$repetition" "$batch_index" "$evidence_root"
}

active_coordinator=""
terminate_supervisor() {
  trap - INT TERM
  if [[ -n "$active_coordinator" ]]; then
    kill -TERM "$active_coordinator" 2>/dev/null || true
    wait "$active_coordinator" 2>/dev/null || true
  fi
  exit 130
}
trap terminate_supervisor INT TERM

# Repetition 1 is the immutable completed r3 baseline. Continue only repetitions 2 through 12.
for repetition in {2..12}; do
  for batch_index in {1..10}; do
    if batch_is_complete "$repetition" "$batch_index"; then
      continue
    fi
    printf '{"event":"luna_base_600_batch_start","repetition":%s,"batch_index":%s,"started_at":%s}\n' \
      "$repetition" "$batch_index" "$(date +%s%3N)"
    /root/.bun/bin/bun \
      packages/opencorvus/script/benchmark/external-agent/run-automationbench-batch.ts \
      --python /var/lib/opencorvus-benchmark/evaluator-venv/bin/python \
      --source-data /var/lib/opencorvus-benchmark/provider-data \
      --output "$evidence_root" \
      --restricted-shell /var/lib/opencorvus-benchmark/restricted-agent-shell \
      --control-root "$control_root" \
      --dashboard "$dashboard_root/index.html" \
      --batch-index "$batch_index" \
      --repetition "$repetition" \
      --repetitions "$target_repetitions" \
      --model openai/gpt-5.6-luna \
      --profiles base \
      --inactivity-ms 600000 &
    active_coordinator=$!
    wait "$active_coordinator"
    active_coordinator=""
    printf '{"event":"luna_base_600_batch_complete","repetition":%s,"batch_index":%s,"completed_at":%s}\n' \
      "$repetition" "$batch_index" "$(date +%s%3N)"
  done
done

/root/.bun/bin/bun \
  packages/opencorvus/script/benchmark/external-agent/verify-automationbench-evidence.ts \
  --root "$evidence_root" \
  --source-data /var/lib/opencorvus-benchmark/provider-data \
  --python /var/lib/opencorvus-benchmark/evaluator-venv/bin/python \
  --restricted-shell /var/lib/opencorvus-benchmark/restricted-agent-shell \
  --model openai/gpt-5.6-luna \
  --profiles base \
  --repetitions "$target_repetitions" \
  --mode final
