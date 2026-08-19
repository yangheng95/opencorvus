import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { t } from "../../utils/i18n"
import {
  executeExpertSquadEvolutionMutation,
  loadExpertSquadEvolutionHistory,
  loadExpertSquadEvolutionHistoryDetail,
  type ExpertSquadEvolutionHistory,
  type ExpertSquadEvolutionHistoryCandidate,
  type ExpertSquadEvolutionHistoryComparison,
  type ExpertSquadEvolutionHistoryDetail,
  type ExpertSquadEvolutionFeedbackRevision,
  type ExpertSquadEvolutionHistoryRecord,
  type ExpertSquadEvolutionMutationIntent,
  type ExpertSquadInstallationScope,
} from "../../services/expert-squad"
import { showAppDialog } from "../../services/app-dialog"
import { Badge, type BadgeTone } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { SettingsRow, SettingsState } from "./layout"

interface ExpertSquadEvolutionPanelProps {
  directory: string
  namespace: string
  id: string
  installationScope: ExpertSquadInstallationScope
  onMutation: () => Promise<void>
}

interface EvolutionSelection {
  key: string
  record: ExpertSquadEvolutionHistoryRecord
  candidate?: ExpertSquadEvolutionHistoryCandidate
  comparison?: ExpertSquadEvolutionHistoryComparison
}

function digest(value: string): string {
  return value.slice(0, 12)
}

function evidenceLocator(locator: { source: string }): string {
  return JSON.stringify(locator)
}

function number(value: number | null, digits = 3): string {
  return value === null ? "—" : value.toFixed(digits)
}

function rate(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function recommendationTone(value: ExpertSquadEvolutionHistoryComparison["recommendation"]): BadgeTone {
  if (value === "promote") return "accent"
  if (value === "retain") return "bad"
  return "muted"
}

function recommendationLabel(value: ExpertSquadEvolutionHistoryComparison["recommendation"]): string {
  const labels = {
    promote: t("expert_squad.evolution_recommendation_promote"),
    retain: t("expert_squad.evolution_recommendation_retain"),
    inconclusive: t("expert_squad.evolution_recommendation_inconclusive"),
  } satisfies Record<ExpertSquadEvolutionHistoryComparison["recommendation"], string>
  return labels[value]
}

function selectionKey(
  record: ExpertSquadEvolutionHistoryRecord,
  candidate?: ExpertSquadEvolutionHistoryCandidate,
  comparison?: ExpertSquadEvolutionHistoryComparison,
): string {
  const artifact = comparison?.artifact ?? candidate?.artifact ?? record.campaign.artifact
  return `${artifact.task_id}:${artifact.locator.artifact_id}:${artifact.locator.catalog_revision}`
}

function selections(records: ExpertSquadEvolutionHistoryRecord[]): EvolutionSelection[] {
  return records.flatMap((record) => {
    if (record.candidates.length === 0) return [{ key: selectionKey(record), record }]
    return record.candidates.flatMap((candidate) => {
      if (candidate.comparisons.length === 0)
        return [{ key: selectionKey(record, candidate), record, candidate }]
      return candidate.comparisons.map((comparison) => ({
        key: selectionKey(record, candidate, comparison),
        record,
        candidate,
        comparison,
      }))
    })
  })
}

export default function ExpertSquadEvolutionPanel(props: ExpertSquadEvolutionPanelProps) {
  const [history, setHistory] = createSignal<ExpertSquadEvolutionHistory | null>(null)
  const [detail, setDetail] = createSignal<ExpertSquadEvolutionHistoryDetail | null>(null)
  const [selectedKey, setSelectedKey] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [loadingMore, setLoadingMore] = createSignal(false)
  const [detailLoading, setDetailLoading] = createSignal(false)
  const [mutationBusy, setMutationBusy] = createSignal("")
  const [error, setError] = createSignal("")
  let loadSequence = 0
  let detailSequence = 0

  const entries = createMemo(() => selections(history()?.records ?? []))
  const selected = createMemo(() => entries().find((entry) => entry.key === selectedKey()) ?? entries()[0])

  async function loadDetail(entry: EvolutionSelection, expectedSequence = loadSequence): Promise<void> {
    const currentHistory = history()
    if (!currentHistory || !entry.candidate || !entry.comparison) {
      setDetail(null)
      return
    }
    const sequence = ++detailSequence
    setDetailLoading(true)
    try {
      const next = await loadExpertSquadEvolutionHistoryDetail({
        directory: props.directory,
        namespace: props.namespace,
        id: props.id,
        installationScope: props.installationScope,
        campaignTaskID: entry.record.campaign.artifact.task_id,
        campaignLocator: entry.record.campaign.artifact.locator,
        candidateLocator: entry.candidate.artifact.locator,
        comparisonLocator: entry.comparison.artifact.locator,
        catalogRevisionUpper: currentHistory.catalog_revision_upper,
      })
      if (sequence === detailSequence && expectedSequence === loadSequence) setDetail(next)
    } catch (cause) {
      if (sequence === detailSequence && expectedSequence === loadSequence)
        setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (sequence === detailSequence && expectedSequence === loadSequence) setDetailLoading(false)
    }
  }

  async function refresh(preferredKey = selectedKey()): Promise<void> {
    const sequence = ++loadSequence
    detailSequence++
    setLoading(true)
    setDetailLoading(false)
    setError("")
    try {
      const next = await loadExpertSquadEvolutionHistory({
        directory: props.directory,
        namespace: props.namespace,
        id: props.id,
        installationScope: props.installationScope,
        limit: 20,
      })
      if (sequence !== loadSequence) return
      setHistory(next)
      const nextEntries = selections(next.records)
      const nextSelection = nextEntries.find((entry) => entry.key === preferredKey) ?? nextEntries[0]
      setSelectedKey(nextSelection?.key ?? "")
      setDetail(null)
      if (nextSelection) await loadDetail(nextSelection, sequence)
    } catch (cause) {
      if (sequence === loadSequence) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (sequence === loadSequence) setLoading(false)
    }
  }

  async function loadMore(): Promise<void> {
    const current = history()
    if (!current?.next_cursor || loadingMore()) return
    setLoadingMore(true)
    setError("")
    try {
      const next = await loadExpertSquadEvolutionHistory({
        directory: props.directory,
        namespace: props.namespace,
        id: props.id,
        installationScope: props.installationScope,
        limit: 20,
        cursor: current.next_cursor,
      })
      setHistory({ ...next, records: [...current.records, ...next.records] })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoadingMore(false)
    }
  }

  createEffect<string>((previous) => {
    const key = [props.directory, props.namespace, props.id, props.installationScope].join("\n")
    if (key === previous) return previous
    setHistory(null)
    setDetail(null)
    setSelectedKey("")
    void refresh("")
    return key
  }, "")

  async function selectEntry(entry: EvolutionSelection): Promise<void> {
    if (entry.key === selectedKey() && (detail() || !entry.comparison)) return
    setSelectedKey(entry.key)
    setDetail(null)
    setError("")
    await loadDetail(entry)
  }

  async function applyMutation(input: {
    taskID: string
    sessionID: string
    confirmationText: string
    intent: ExpertSquadEvolutionMutationIntent
    busyKey: string
    preferredKey?: string
  }): Promise<void> {
    if (mutationBusy()) return
    const restoring = input.intent.operation === "restoration"
    const dialog = await showAppDialog({
      title: restoring ? t("expert_squad.evolution_restore_title") : t("expert_squad.evolution_promote_title"),
      message: input.confirmationText,
      cancel: true,
      okLabel: restoring ? t("expert_squad.evolution_restore") : t("expert_squad.evolution_promote"),
      okTone: restoring ? "danger" : "accent",
    })
    if (!dialog.confirmed) return
    setMutationBusy(input.busyKey)
    setError("")
    try {
      await executeExpertSquadEvolutionMutation({
        directory: props.directory,
        taskID: input.taskID,
        sessionID: input.sessionID,
        confirmationText: input.confirmationText,
        intent: input.intent,
      })
      await props.onMutation()
      await refresh(input.preferredKey ?? selectedKey())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setMutationBusy("")
    }
  }

  async function runMutation(
    entry: EvolutionSelection,
    confirmationText: string,
    intent: ExpertSquadEvolutionMutationIntent,
  ): Promise<void> {
    if (!entry.comparison) return
    await applyMutation({
      taskID: entry.comparison.artifact.task_id,
      sessionID: entry.comparison.artifact.root_session_id,
      confirmationText,
      intent,
      busyKey: `${intent.operation}:${entry.key}`,
      preferredKey: entry.key,
    })
  }

  function feedbackKey(revision: ExpertSquadEvolutionFeedbackRevision): string {
    return `${revision.artifact.task_id}:${revision.artifact.locator.artifact_id}`
  }

  return (
    <div class="expert-squad-evolution" data-ui="expert-squad-evolution">
      <header class="expert-squad-evolution-head">
        <div>
          <strong>{t("expert_squad.evolution_title")}</strong>
          <span>{t("expert_squad.evolution_intro")}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          title={t("common.refresh")}
          aria-label={t("common.refresh")}
          disabled={loading() || !!mutationBusy()}
          onClick={() => void refresh()}
        >
          <Icon name={loading() ? "loading" : "refresh"} />
        </Button>
      </header>

      <Show when={error() && Boolean(history())}>
        <SettingsState tone="error" data-ui="expert-squad-evolution-error">{error()}</SettingsState>
      </Show>

      <Show when={history()}>
        {(current) => (
          <>
            <div class="expert-squad-evolution-authority">
              <div><span>{t("expert_squad.evolution_installed_revision")}</span><strong>{current().authority.installed_revision.version}</strong></div>
              <div><span>{t("expert_squad.evolution_package_digest")}</span><strong title={current().authority.installed_revision.package_digest}>{digest(current().authority.installed_revision.package_digest)}</strong></div>
              <div><span>{t("expert_squad.evolution_catalog_revision")}</span><strong>{current().catalog_revision_upper}</strong></div>
            </div>
            <Show when={current().revisions.length > 1}>
              <section class="expert-squad-evolution-revisions" data-ui="expert-squad-evolution-revisions">
                <header>
                  <strong>{t("expert_squad.evolution_revisions")}</strong>
                  <span>{t("expert_squad.evolution_revisions_intro")}</span>
                </header>
                <For each={current().revisions}>
                  {(choice) => (
                    <div class="expert-squad-evolution-revision" data-installed={choice.installed ? "true" : "false"}>
                      <strong>{choice.version ?? t("expert_squad.evolution_revision_unnamed")}</strong>
                      <code title={choice.package_digest}>{digest(choice.package_digest)}</code>
                      <Show
                        when={!choice.installed && choice.switch_intent}
                        fallback={
                          <Badge tone={choice.installed ? "accent" : "muted"}>
                            {choice.installed
                              ? t("expert_squad.evolution_revision_installed")
                              : t("expert_squad.evolution_revision_unreachable")}
                          </Badge>
                        }
                      >
                        {(intent) => (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            tone="accent"
                            disabled={!!mutationBusy()}
                            onClick={() =>
                              void applyMutation({
                                taskID: choice.authorization_root!.task_id,
                                sessionID: choice.authorization_root!.root_session_id,
                                confirmationText: intent().confirmation_text,
                                intent: intent().request,
                                busyKey: `switch:${choice.package_digest}`,
                              })
                            }
                          >
                            <Show when={mutationBusy() === `switch:${choice.package_digest}`}>
                              <Icon name="loading" />
                            </Show>
                            {t("expert_squad.evolution_revision_switch")}
                          </Button>
                        )}
                      </Show>
                    </div>
                  )}
                </For>
              </section>
            </Show>

            <Show when={current().integrity_issues.length > 0}>
              <div class="expert-squad-evolution-issues">
                <strong>{t("expert_squad.evolution_integrity_issues")}: {current().integrity_issues.length}</strong>
                <For each={current().integrity_issues}>
                  {(issue) => <code>{JSON.stringify(issue)}</code>}
                </For>
              </div>
            </Show>
          </>
        )}
      </Show>

      <Show when={(history()?.feedback_revisions.length ?? 0) > 0}>
        <section class="expert-squad-evolution-feedback" data-ui="expert-squad-evolution-feedback">
          <header>
            <strong>{t("expert_squad.evolution_feedback_revisions")}</strong>
            <span>{t("expert_squad.evolution_feedback_intro")}</span>
          </header>
          <For each={history()?.feedback_revisions ?? []}>
            {(revision) => (
              <article class="expert-squad-evolution-record">
                <div class="expert-squad-evolution-record-title">
                  <strong>{revision.feedback}</strong>
                  <Badge tone={revision.installed ? "accent" : revision.acceptance_intent ? "warn" : "muted"}>
                    {revision.installed
                      ? t("expert_squad.evolution_feedback_installed")
                      : revision.acceptance_intent
                        ? t("expert_squad.evolution_feedback_pending")
                        : t("expert_squad.evolution_feedback_superseded")}
                  </Badge>
                </div>
                <span>{revision.hypothesis}</span>
                <span>
                  {t("expert_squad.evolution_feedback_changed_files")}: {revision.changed_paths.join(", ")}
                </span>
                <div class="expert-squad-evolution-actions">
                  <Show when={revision.acceptance_intent}>
                    {(acceptance) => (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        tone="accent"
                        disabled={!!mutationBusy()}
                        onClick={() =>
                          void applyMutation({
                            taskID: revision.artifact.task_id,
                            sessionID: revision.artifact.root_session_id,
                            confirmationText: acceptance().confirmation_text,
                            intent: acceptance().request,
                            busyKey: `feedback_revision:${feedbackKey(revision)}`,
                          })
                        }
                      >
                        <Show when={mutationBusy() === `feedback_revision:${feedbackKey(revision)}`}>
                          <Icon name="loading" />
                        </Show>
                        {t("expert_squad.evolution_feedback_accept")}
                      </Button>
                    )}
                  </Show>
                  <For each={revision.restoration_intents}>
                    {(restoration) => (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        tone="neutral"
                        disabled={!!mutationBusy()}
                        title={restoration.request.restorePackageDigest}
                        onClick={() =>
                          void applyMutation({
                            taskID: revision.artifact.task_id,
                            sessionID: revision.artifact.root_session_id,
                            confirmationText: restoration.confirmation_text,
                            intent: restoration.request,
                            busyKey: `restoration:${feedbackKey(revision)}`,
                          })
                        }
                      >
                        <Show when={mutationBusy() === `restoration:${feedbackKey(revision)}`}>
                          <Icon name="loading" />
                        </Show>
                        {t("expert_squad.evolution_restore")} {digest(restoration.request.restorePackageDigest)}
                      </Button>
                    )}
                  </For>
                </div>
              </article>
            )}
          </For>
        </section>
      </Show>

      <Show when={!error() || Boolean(history())} fallback={
        <SettingsState tone="error" actions={
          <Button type="button" variant="outline" size="sm" tone="neutral" onClick={() => void refresh()}>
            <Icon name="refresh" />{t("common.retry")}
          </Button>
        }>{error()}</SettingsState>
      }>
      <Show
        when={!loading() && entries().length > 0}
        fallback={
          <Show when={!loading()} fallback={<SettingsState>{t("expert_squad.evolution_loading")}</SettingsState>}>
            {/* Feedback revisions render above and are history too, so the
                empty state must not claim there is none. */}
            <Show when={(history()?.feedback_revisions.length ?? 0) === 0}>
              <SettingsState title={t("expert_squad.evolution_empty_title")}>{t("expert_squad.evolution_empty_body")}</SettingsState>
            </Show>
          </Show>
        }
      >
        <div class="expert-squad-evolution-layout">
          <div class="expert-squad-evolution-records" aria-label={t("expert_squad.evolution_campaigns")}>
            <For each={entries()}>
              {(entry) => (
                <article class="expert-squad-evolution-record" classList={{ "is-selected": selectedKey() === entry.key }}>
                  <SettingsRow
                    as="button"
                    customContent
                    interactive
                    class="expert-squad-evolution-record-select"
                    onClick={() => void selectEntry(entry)}
                  >
                    <div class="expert-squad-evolution-record-title">
                      <strong>{entry.record.campaign.candidate_hypothesis}</strong>
                      <Show
                        when={entry.comparison}
                        fallback={<Badge tone="muted">{entry.candidate ? t("expert_squad.evolution_trials_running") : t("expert_squad.evolution_campaign_frozen")}</Badge>}
                      >
                        {(comparison) => <Badge tone={recommendationTone(comparison().recommendation)}>{recommendationLabel(comparison().recommendation)}</Badge>}
                      </Show>
                    </div>
                    <span>{t("expert_squad.evolution_context")}: {digest(entry.record.context.context_sha256)} · {entry.record.context.dataset_partition}</span>
                    <div class="expert-squad-evolution-metrics">
                      <span>{t("expert_squad.evolution_candidates")}: {entry.record.candidates.length}</span>
                      <span>{t("expert_squad.evolution_score")}: {entry.comparison ? number(entry.comparison.aggregate_score) : "—"}</span>
                      <span>{t("expert_squad.evolution_evidence")}: {entry.comparison ? `${entry.comparison.completeness.present_evaluations}/${entry.comparison.completeness.expected_slots}` : `${entry.candidate?.evaluations.length ?? 0}`}</span>
                    </div>
                  </SettingsRow>
                  <Show when={entry.comparison}>
                    {(comparison) => (
                      <div class="expert-squad-evolution-actions">
                        <Show when={comparison().promotion_intent}>
                          {(promotion) => (
                            <Button type="button" variant="outline" size="sm" tone="accent" disabled={!!mutationBusy()} onClick={() => void runMutation(entry, promotion().confirmation_text, promotion().request)}>
                              <Show when={mutationBusy() === `promotion:${entry.key}`}><Icon name="loading" /></Show>
                              {t("expert_squad.evolution_promote")}
                            </Button>
                          )}
                        </Show>
                        <For each={comparison().restoration_intents}>
                          {(restoration) => (
                            <Button type="button" variant="ghost" size="sm" tone="neutral" disabled={!!mutationBusy()} title={restoration.request.restorePackageDigest} onClick={() => void runMutation(entry, restoration.confirmation_text, restoration.request)}>
                              <Show when={mutationBusy() === `restoration:${entry.key}`}><Icon name="loading" /></Show>
                              {t("expert_squad.evolution_restore")} {digest(restoration.request.restorePackageDigest)}
                            </Button>
                          )}
                        </For>
                      </div>
                    )}
                  </Show>
                </article>
              )}
            </For>
            <Show when={history()?.next_cursor}>
              <Button type="button" variant="outline" size="sm" tone="neutral" disabled={loadingMore()} onClick={() => void loadMore()}>
                <Show when={loadingMore()}><Icon name="loading" /></Show>
                {t("expert_squad.evolution_load_more")}
              </Button>
            </Show>
          </div>

          <section class="expert-squad-evolution-detail" data-ui="expert-squad-evolution-detail">
            <Show when={selected()}>
              {(entry) => (
                <>
                  <header>
                    <div>
                      <strong>{entry().record.campaign.candidate_hypothesis}</strong>
                      <span>{entry().record.context.model} · {digest(entry().record.context.environment_digest)}</span>
                    </div>
                    <Badge tone={entry().record.graph_issues.length ? "bad" : "muted"}>{entry().record.graph_issues.length ? t("expert_squad.evolution_integrity_issues") : t("expert_squad.evolution_campaign_frozen")}</Badge>
                  </header>
                  <div class="expert-squad-evolution-facts">
                    <span>{t("expert_squad.evolution_baseline")}: {digest(entry().record.campaign.baseline_revision.package_digest)}</span>
                    <span>{t("expert_squad.evolution_dataset")}: {entry().record.context.dataset_partition} · {digest(entry().record.context.dataset_digest)}</span>
                    <span>{t("expert_squad.evolution_budget")}: {entry().record.context.budget.max_runs} runs · {entry().record.context.budget.max_cost}</span>
                  </div>
                  <Show when={[
                    ...entry().record.graph_issues,
                    ...(entry().candidate?.graph_issues ?? []),
                    ...(entry().comparison?.graph_issues ?? []),
                  ].length > 0}>
                    <div class="expert-squad-evolution-issues">
                      <strong>{t("expert_squad.evolution_integrity_issues")}</strong>
                      <For each={[
                        ...entry().record.graph_issues,
                        ...(entry().candidate?.graph_issues ?? []),
                        ...(entry().comparison?.graph_issues ?? []),
                      ]}>
                        {(issue) => <code>{JSON.stringify(issue)}</code>}
                      </For>
                    </div>
                  </Show>
                  <Show when={entry().candidate}>
                    {(candidate) => (
                      <div class="expert-squad-evolution-section">
                        <strong>{t("expert_squad.evolution_candidate")}: {candidate().candidate_revision.version}</strong>
                        <span>{candidate().hypothesis}</span>
                        <span>{t("expert_squad.evolution_changed_paths")}: {candidate().changed_paths.join(" · ")}</span>
                        <span>{t("expert_squad.evolution_preserved_runs")}: {candidate().runs.length} · {t("expert_squad.evolution_preserved_evaluations")}: {candidate().evaluations.length}</span>
                      </div>
                    )}
                  </Show>
                  <Show when={entry().comparison}>
                    {(comparison) => (
                      <>
                        <div class="expert-squad-evolution-section">
                          <strong>{t("expert_squad.evolution_comparison")}</strong>
                          <div class="expert-squad-evolution-facts">
                            <span>{t("expert_squad.evolution_score")}: {number(comparison().aggregate_score)}</span>
                            <span>{t("expert_squad.evolution_confidence")}: {comparison().confidence}</span>
                            <span>{t("expert_squad.evolution_cost_delta")}: {number(comparison().cost_delta)}</span>
                            <span>{t("expert_squad.evolution_token_delta")}: {number(comparison().token_delta, 0)}</span>
                            <span>{t("expert_squad.evolution_duration_delta")}: {number(comparison().activity_duration_ms_delta, 0)} ms</span>
                            <span>{t("expert_squad.evolution_failure_rate")}: {rate(comparison().outcome_rates.baseline.failure)} → {rate(comparison().outcome_rates.candidate.failure)}</span>
                            <span>{t("expert_squad.evolution_unavailable_rate")}: {rate(comparison().outcome_rates.baseline.unavailable)} → {rate(comparison().outcome_rates.candidate.unavailable)}</span>
                          </div>
                          <For each={comparison().paired_deltas}>
                            {(delta) => (
                              <div class="expert-squad-evolution-delta">
                                <strong>{delta.scorer_id}</strong>
                                <span>μ {number(delta.mean)} · median {number(delta.median)} · variance {number(delta.variance)}</span>
                                <span>CI {Math.round(delta.confidence_interval.confidence * 100)}% [{number(delta.confidence_interval.lower)}, {number(delta.confidence_interval.upper)}] · W/T/L {delta.win_tie_loss.wins}/{delta.win_tie_loss.ties}/{delta.win_tie_loss.losses}</span>
                              </div>
                            )}
                          </For>
                          <span>{t("expert_squad.evolution_regressions")}: {comparison().regressions.join(" · ") || "—"}</span>
                          <span>{t("expert_squad.evolution_unavailable_dimensions")}: {comparison().unavailable_dimensions.join(" · ") || "—"}</span>
                          <span>{t("expert_squad.evolution_unknowns")}: {comparison().unknowns.join(" · ") || "—"}</span>
                          <span>{t("expert_squad.evolution_visual_review")}: {comparison().visual_review.status}</span>
                          <span>{t("expert_squad.evolution_evidence")}: {comparison().visual_review.evidence.map(evidenceLocator).join(" · ") || "—"}</span>
                          <span>{t("expert_squad.evolution_reward_review")}: {comparison().reward_hacking_review.findings.join(" · ") || "—"}</span>
                          <span>{t("expert_squad.evolution_evidence")}: {comparison().reward_hacking_review.evidence.map(evidenceLocator).join(" · ") || "—"}</span>
                        </div>
                        <Show when={comparison().receipts.length > 0}>
                          <div class="expert-squad-evolution-section">
                            <strong>{t("expert_squad.evolution_receipts")}</strong>
                            <For each={comparison().receipts}>
                              {(item) => (
                                <div class="expert-squad-evolution-receipt">
                                  <strong>{item.receipt.operation}</strong>
                                  <span>{item.receipt.before_digest} → {item.receipt.after_digest}</span>
                                  <span>{t("expert_squad.evolution_authorization")}: {item.receipt.authorization.message_id} · {new Date(item.receipt.authorization.time_created).toLocaleString()}</span>
                                  <span>{t("expert_squad.evolution_manager_receipt")}: {item.receipt.manager_receipt.operation}</span>
                                  <span>{t("expert_squad.evolution_evidence")}: {item.receipt.evidence.map(evidenceLocator).join(" · ")}</span>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
                      </>
                    )}
                  </Show>
                  <Show when={detailLoading()}><SettingsState>{t("expert_squad.evolution_detail_loading")}</SettingsState></Show>
                  <Show when={!detailLoading() && detail()}>
                    {(current) => (
                      <div class="expert-squad-evolution-section">
                        <strong>{t("expert_squad.evolution_evidence_matrix")}</strong>
                        <div class="expert-squad-evolution-slot-list">
                          <For each={current().slots}>
                            {(slot) => (
                              <div class="expert-squad-evolution-slot">
                                <strong>{slot.case_id}</strong>
                                <Badge tone={slot.arm === "candidate" ? "accent" : "muted"}>{slot.arm}</Badge>
                                <span>#{slot.repetition + 1}</span>
                                <span>{slot.run ? t("expert_squad.evolution_run_present") : t("expert_squad.evolution_run_missing")}</span>
                                <span>{slot.evaluation ? t("expert_squad.evolution_evaluation_present") : t("expert_squad.evolution_evaluation_missing")}</span>
                                <For each={slot.scorer_results}>
                                  {(result) => (
                                    <span>
                                      {result.scorer_id}: {result.status}
                                      {result.status === "measured" ? ` · ${result.value}` : ""}
                                      {result.status === "unavailable" ? ` · ${result.reason}` : ""}
                                      {result.status === "missing" ? "" : ` · ${result.evidence.map(evidenceLocator).join(" · ")}`}
                                    </span>
                                  )}
                                </For>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </Show>
                </>
              )}
            </Show>
          </section>
        </div>
      </Show>
      </Show>
    </div>
  )
}
