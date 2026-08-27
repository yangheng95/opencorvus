#!/usr/bin/env bash
set -euo pipefail

runner_root=/var/lib/opencorvus-benchmark/opencorvus-runner
evidence_root=/var/lib/opencorvus-benchmark/evidence-luna-mission-base-v20260822-r3
control_root=/var/lib/opencorvus-benchmark/control-luna-mission-base-v20260822-r3
dashboard_root=/mnt/d/myhexin-local/opencorvus-benchmark-results/luna-mission-base-v20260822-r3
case_set=packages/opencorvus/script/benchmark/external-agent/automationbench-case-set-600.json

cd "$runner_root"
runner_status="$(git status --porcelain)"
runner_head="$(git rev-parse HEAD)"
runner_origin="$(git rev-parse origin/codex/automation-workbuddy-benchmark)"
test -z "$runner_status"
test "$runner_head" = "$runner_origin"
test -s "$evidence_root/evidence-catalog.json"
test -s "$case_set"
mkdir -p "$control_root" "$dashboard_root"
chmod 0700 "$evidence_root" "$control_root"
exec 9>"$control_root/supervisor.lock"
flock -n 9 || exit 1
packages/opencorvus/script/benchmark/external-agent/install-automationbench-restricted-shells.sh

. packages/opencorvus/script/benchmark/external-agent/load-automationbench-environment.sh

exec >>"$control_root/supervisor-cases-51-600.log" 2>&1

batch_is_complete() {
  local batch_index="$1"
  /root/.bun/bin/bun -e '
    const { automationBenchBatchPlanMatches } = await import(
      "./packages/opencorvus/script/benchmark/external-agent/contract.ts"
    )
    const catalog = await Bun.file(process.argv[1]).json()
    const batchIndex = Number(process.argv[2])
    const root = process.argv[3]
    for (const batch of catalog.batches ?? []) {
      if (
        batch.batch_index !== batchIndex ||
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
        repetition: 1,
        trial_concurrency: 5,
        schedule_mode: "rolling_case_slots_v1",
        profiles: ["base"],
        case_count: 5,
      })) process.exit(0)
    }
    process.exit(1)
  ' "$evidence_root/evidence-catalog.json" "$batch_index" "$evidence_root"
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

pending_batches=()
run_pending_batches() {
  local failed=0
  local batch_indices
  batch_indices="$(IFS=,; printf '%s' "${pending_batches[*]}")"
  printf '{"event":"luna_base_unique_batch_group_start","batch_indices":"%s","started_at":%s}\n' \
    "$batch_indices" "$(date +%s%3N)"
  /root/.bun/bin/bun \
    packages/opencorvus/script/benchmark/external-agent/run-automationbench-batch.ts \
    --python /var/lib/opencorvus-benchmark/evaluator-venv/bin/python \
    --source-data /var/lib/opencorvus-benchmark/provider-data \
    --output "$evidence_root" \
    --restricted-shell /var/lib/opencorvus-benchmark/restricted-agent-shell \
    --control-root "$control_root" \
    --dashboard "$dashboard_root/index.html" \
    --case-set "$case_set" \
    --batch-index "$batch_indices" \
    --repetition 1 \
    --model openai/gpt-5.6-luna \
    --profiles base \
    --queue-concurrency 10 \
    --inactivity-ms 600000 &
  active_coordinator="$!"
  if wait "$active_coordinator"; then
    printf '{"event":"luna_base_unique_batch_group_complete","batch_indices":"%s","completed_at":%s}\n' \
      "$batch_indices" "$(date +%s%3N)"
  else
    failed=1
  fi
  active_coordinator=""
  pending_batches=()
  return "$failed"
}

for batch_index in {11..120}; do
  if batch_is_complete "$batch_index"; then
    continue
  fi
  pending_batches+=("$batch_index")
done
if [[ "${#pending_batches[@]}" -gt 0 ]]; then
  if ! run_pending_batches; then
    exit 1
  fi
fi

/root/.bun/bin/bun \
  packages/opencorvus/script/benchmark/external-agent/verify-automationbench-evidence.ts \
  --root "$evidence_root" \
  --source-data /var/lib/opencorvus-benchmark/provider-data \
  --python /var/lib/opencorvus-benchmark/evaluator-venv/bin/python \
  --restricted-shell /var/lib/opencorvus-benchmark/restricted-agent-shell \
  --case-set "$case_set" \
  --model openai/gpt-5.6-luna \
  --profiles base \
  --repetition 1 \
  --mode final
