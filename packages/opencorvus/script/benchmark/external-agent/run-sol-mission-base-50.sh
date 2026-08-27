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
    const { automationBenchBatchPlanMatches } = await import(
      "./packages/opencorvus/script/benchmark/external-agent/contract.ts"
    )
    const catalog = await Bun.file(process.argv[1]).json()
    const batchIndex = Number(process.argv[2])
    for (const batch of catalog.batches ?? []) {
      if (
        batch.batch_index !== batchIndex ||
        batch.audit?.passed !== true ||
        batch.audit?.status !== "completed" ||
        typeof batch.plan !== "string"
      ) continue
      const plan = await Bun.file(`${process.argv[3]}/${batch.plan}`).json()
      if (automationBenchBatchPlanMatches(plan, {
        schema_version: 2,
        batch_index: batchIndex,
        model: "openai/gpt-5.6-sol",
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
for batch_index in {1..10}; do
  if batch_is_complete "$batch_index"; then
    continue
  fi
  pending_batches+=("$batch_index")
done
if [[ "${#pending_batches[@]}" -gt 0 ]]; then
  batch_indices="$(IFS=,; printf '%s' "${pending_batches[*]}")"
  printf '{"event":"sol_base_queue_start","batch_indices":"%s","started_at":%s}\n' \
    "$batch_indices" "$(date +%s%3N)"
  /root/.bun/bin/bun \
    packages/opencorvus/script/benchmark/external-agent/run-automationbench-batch.ts \
    --python /var/lib/opencorvus-benchmark/evaluator-venv/bin/python \
    --source-data /var/lib/opencorvus-benchmark/provider-data \
    --output "$evidence_root" \
    --restricted-shell /var/lib/opencorvus-benchmark/restricted-agent-shell-base \
    --control-root "$control_root" \
    --dashboard "$dashboard_root/index.html" \
    --batch-index "$batch_indices" \
    --repetition 1 \
    --model openai/gpt-5.6-sol \
    --profiles base \
    --queue-concurrency 5 \
    --inactivity-ms 600000 &
  active_coordinator=$!
  if ! wait "$active_coordinator"; then
    exit 1
  fi
  active_coordinator=""
  printf '{"event":"sol_base_queue_complete","batch_indices":"%s","completed_at":%s}\n' \
    "$batch_indices" "$(date +%s%3N)"
fi

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
