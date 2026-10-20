import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  createUniqueId,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js"
import { appStore } from "../store/app"
import { ApiError, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import {
  createContinuousGoal,
  loadContinuousGoal,
  updateContinuousGoal,
  type ContinuousGoal,
  type ContinuousGoalTarget,
  type ContinuousGoalCreateInput,
  type ContinuousGoalUpdateInput,
} from "../services/continuous-goal"
import { formatErrorDetails } from "../services/diagnostics"
import { composerDraftText, composerQuotation, setComposerDraft } from "../services/composer-draft"
import { randomUUID } from "../utils/random-id"
import { localeTag, t } from "../utils/i18n"
import { Badge, type BadgeTone } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Checkbox } from "./ui/Checkbox"
import { Dialog } from "./ui/Dialog"
import { Feedback } from "./ui/Feedback"
import { Icon } from "./ui/Icon"
import { TextField } from "./ui/TextField"

const REFRESH_MS = 5_000
const guideSteps = ["start", "define", "manage"] as const

export type GoalLaunchContext = { authority: ApiAuthority; selectionEpoch: number; composerDraftKey?: string }
export type GoalFormRequest = {
  sessionID: string
  authority: ApiAuthority
  selectionEpoch: number
  input: ContinuousGoalCreateInput
}

function GoalGuideSteps() {
  return (
    <ol class="continuous-goal__steps">
      <For each={guideSteps}>
        {(step) => (
          <li>
            <strong>{t(`continuous_goal.guide.${step}.title`)}</strong>
            <span>{t(`continuous_goal.guide.${step}.body`)}</span>
          </li>
        )}
      </For>
    </ol>
  )
}
const tones: Record<ContinuousGoal["status"], BadgeTone> = {
  active: "accent",
  paused: "neutral",
  blocked: "warn",
  complete: "ok",
  budget_limited: "warn",
}
const systemReasons = new Set([
  "owner_unavailable",
  "owner_cancelled",
  "owner_archived",
  "mission_closed",
  "token_budget",
  "turn_budget",
])

function needsBudgetIncrease(goal: ContinuousGoal): boolean {
  return (
    (goal.tokenBudget !== undefined && goal.tokensUsed >= goal.tokenBudget) ||
    (goal.turnBudget !== undefined && goal.turnsAccepted >= goal.turnBudget)
  )
}

function errorSummary(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { name?: string; data?: { code?: string } } | undefined
    if (body?.name === "ContinuousGoalError" && body.data?.code) return t(`continuous_goal.error.${body.data.code}`)
  }
  return t("continuous_goal.error.request")
}

/** One HTTP projection and one form lifetime for the exact selected owner. */
export function ContinuousGoalControl(props: {
  owner?: ContinuousGoalTarget
  compact?: boolean
  home?: boolean
  onStartGoal?: (input: ContinuousGoalCreateInput, context: GoalLaunchContext) => Promise<void>
  starting?: boolean
  createRequest?: GoalFormRequest
  onCreateHandled?: () => void
  selectionEpoch?: number
  composerDraftKey?: string
  hasStagedAttachments?: boolean
}) {
  const formID = `continuous-goal-${createUniqueId()}`
  const source = createMemo(
    () => {
      const target = props.owner
      const authority = captureApiAuthority()
      if (!target || !appStore.connected) return undefined
      return {
        target,
        authority,
        key: JSON.stringify([authority.revision, props.selectionEpoch, target.kind, target.id, target.directory]),
      }
    },
    undefined,
    { equals: (a, b) => a?.key === b?.key },
  )
  const [projection, { refetch }] = createResource(source, async ({ target, authority, key }) => ({
    key,
    value: await loadContinuousGoal(target, authority),
  }))
  const goal = () => {
    if (projection.error) return undefined
    const current = projection()
    return current?.key === source()?.key ? current?.value : undefined
  }
  const [mode, setMode] = createSignal<"details" | "create" | "complete" | "about" | null>(null)
  const [editing, setEditing] = createSignal<ContinuousGoal>()
  const [objective, setObjective] = createSignal("")
  const [tokens, setTokens] = createSignal("")
  const [turns, setTurns] = createSignal("")
  const [reason, setReason] = createSignal("")
  const [resume, setResume] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [failure, setFailure] = createSignal<unknown>()
  const [validation, setValidation] = createSignal("")
  const [notice, setNotice] = createSignal("")
  let attempt: { key: string; requestID: string } | undefined
  let createDraft: { key: string; text: string } | undefined
  let launchOwner: GoalLaunchContext | undefined
  let disposed = false
  let root: HTMLElement | undefined
  let noticeState = ""
  const number = (value: number) => new Intl.NumberFormat(localeTag()).format(value)
  const currentReason = () => {
    const value = goal()?.reason
    return value && systemReasons.has(value) ? t(`continuous_goal.reason.${value}`) : value
  }
  const owns = (key: string) => !disposed && source()?.key === key
  const initialLoading = () => projection.state === "pending"
  const disabled = () => busy() || initialLoading() || !source() || !!projection.error
  const pendingComposerContext = () => !!props.hasStagedAttachments || !!composerQuotation(props.composerDraftKey)
  const ownsLaunch = () => !disposed && !!launchOwner && isApiAuthorityCurrent(launchOwner.authority) &&
    launchOwner.selectionEpoch === props.selectionEpoch && launchOwner.composerDraftKey === props.composerDraftKey
  const hasForm = () => !!props.owner || (props.home && mode() === "create")

  onCleanup(() => {
    disposed = true
    launchOwner = undefined
  })
  createEffect(() => {
    const revision = captureApiAuthority().revision
    const selectionEpoch = props.selectionEpoch
    const draftKey = props.composerDraftKey
    if (props.home && launchOwner && (launchOwner.authority.revision !== revision ||
      launchOwner.selectionEpoch !== selectionEpoch || launchOwner.composerDraftKey !== draftKey)) {
      setMode(null)
    }
  })

  createEffect(
    on(
      () => source()?.key,
      () => {
        setMode(null)
        setEditing(undefined)
        setFailure(undefined)
        setValidation("")
        setNotice("")
        setBusy(false)
        attempt = undefined
        createDraft = undefined
      },
    ),
  )
  createEffect(() => {
    const current = source()
    if (!current) return
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        root?.getBoundingClientRect().height &&
        owns(current.key) &&
        isApiAuthorityCurrent(current.authority) &&
        !busy()
      )
        void refetch()
    }
    const timer = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    onCleanup(() => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    })
  })

  createEffect(() => {
    const current = goal()
    if (current && noticeState && `${current.id}:${current.status}` !== noticeState) setNotice("")
  })

  function open(next: "details" | "create" | "complete" | "about") {
    if (props.home && next === "create") {
      if (props.selectionEpoch === undefined) throw new Error("Home Goal form requires its workspace selection epoch")
      launchOwner = {
        authority: captureApiAuthority(), selectionEpoch: props.selectionEpoch, composerDraftKey: props.composerDraftKey,
      }
    } else launchOwner = undefined
    const current = goal()
    createDraft = next === "create" && props.composerDraftKey
      ? { key: props.composerDraftKey, text: composerDraftText(props.composerDraftKey) }
      : undefined
    setEditing(next === "create" ? undefined : current)
    setObjective(next === "create" ? (createDraft?.text ?? "") : (current?.objective ?? ""))
    setTokens(next === "create" ? "" : current?.tokenBudget === undefined ? "" : String(current.tokenBudget))
    setTurns(next === "create" ? "" : current?.turnBudget === undefined ? "" : String(current.turnBudget))
    setReason("")
    setResume(false)
    setFailure(undefined)
    setValidation("")
    attempt = undefined
    setMode(next)
  }
  createEffect(() => {
    const requested = props.createRequest
    if (!requested) return
    if (!isApiAuthorityCurrent(requested.authority) || requested.selectionEpoch !== props.selectionEpoch) {
      props.onCreateHandled?.()
      return
    }
    const current = source()
    if (current?.target.kind !== "chat" || current.target.id !== requested.sessionID) return
    open("create")
    const { requestID: submittedRequestID, ...input } = requested.input
    setObjective(input.objective)
    setTokens(input.tokenBudget === undefined ? "" : String(input.tokenBudget))
    setTurns(input.turnBudget === undefined ? "" : String(input.turnBudget))
    attempt = { key: JSON.stringify([current.key, input]), requestID: submittedRequestID }
    props.onCreateHandled?.()
    void mutate(input)
  })
  function requestID(input: unknown) {
    const owner = props.home
      ? [launchOwner?.authority.revision, launchOwner?.selectionEpoch, launchOwner?.composerDraftKey]
      : source()?.key
    const key = JSON.stringify([owner, input])
    if (attempt?.key !== key) attempt = { key, requestID: randomUUID() }
    return attempt!.requestID
  }
  async function launch(input: ContinuousGoalCreateInput) {
    const owner = launchOwner
    if (!owner || !ownsLaunch() || busy() || props.starting || !props.onStartGoal) return
    setBusy(true)
    setFailure(undefined)
    setValidation("")
    try {
      await props.onStartGoal(input, owner)
    } catch (error) {
      if (ownsLaunch()) setFailure(error)
    } finally {
      if (!disposed && launchOwner === owner) setBusy(false)
    }
  }
  async function mutate(
    input: Omit<ContinuousGoalCreateInput, "requestID"> | Omit<ContinuousGoalUpdateInput, "requestID">,
  ) {
    const current = source()
    if (!current || busy()) return
    setBusy(true)
    setFailure(undefined)
    setValidation("")
    setNotice("")
    try {
      const body = { ...input, requestID: requestID(input) }
      const saved =
        "goalID" in body
          ? await updateContinuousGoal(current.target, body, current.authority)
          : await createContinuousGoal(current.target, body, current.authority)
      if (!owns(current.key)) return
      if ("objective" in body && createDraft && !pendingComposerContext() && composerDraftText(createDraft.key) === createDraft.text) {
        setComposerDraft(createDraft.key, "")
      }
      createDraft = undefined
      attempt = undefined
      setMode(null)
      noticeState = `${saved.id}:${saved.status}`
      setNotice(`continuous_goal.saved.${saved.status}`)
      await refetch()
    } catch (error) {
      if (!owns(current.key)) return
      setFailure(error)
      void refetch()
    } finally {
      if (owns(current.key)) setBusy(false)
    }
  }
  function changeStatus(status: "active" | "paused") {
    const current = goal()
    if (!current) return
    if (status === "active" && (current.status === "budget_limited" || needsBudgetIncrease(current))) {
      open("details")
      setResume(true)
      return
    }
    void mutate({
      goalID: current.id,
      expectedRevision: current.revision,
      status,
      reason: t(status === "active" ? "continuous_goal.intent.resume" : "continuous_goal.intent.pause"),
    })
  }
  function budget(value: string, previous?: number): number | undefined {
    if (!value.trim()) {
      if (previous !== undefined) throw new Error("continuous_goal.validation.keep_budget")
      return undefined
    }
    const result = Number(value)
    if (!Number.isSafeInteger(result) || result <= 0) throw new Error("continuous_goal.validation.budget")
    return result
  }
  function save() {
    try {
      const existing = editing()
      if (mode() === "complete") {
        if (!existing || !reason().trim()) throw new Error("continuous_goal.validation.reason")
        void mutate({
          goalID: existing.id,
          expectedRevision: existing.revision,
          status: "complete",
          reason: reason().trim(),
        })
        return
      }
      const tokenBudget = budget(tokens(), existing?.tokenBudget)
      const turnBudget = budget(turns(), existing?.turnBudget)
      if (!existing) {
        if (!objective().trim()) throw new Error("continuous_goal.validation.objective")
        const input = {
          objective: objective().trim(),
          ...(tokenBudget !== undefined ? { tokenBudget } : {}),
          ...(turnBudget !== undefined ? { turnBudget } : {}),
        }
        if (props.home) void launch({ ...input, requestID: requestID(input) })
        else void mutate(input)
        return
      }
      const status =
        resume() || existing.status === "budget_limited"
          ? "active"
          : (existing.status as "active" | "paused" | "blocked" | "complete")
      if (
        status === "active" &&
        ((tokenBudget !== undefined && tokenBudget <= (goal()?.tokensUsed ?? existing.tokensUsed)) ||
          (turnBudget !== undefined && turnBudget <= (goal()?.turnsAccepted ?? existing.turnsAccepted)))
      )
        throw new Error("continuous_goal.validation.remaining")
      void mutate({
        goalID: existing.id,
        expectedRevision: existing.revision,
        status,
        reason:
          status === existing.status && (status === "paused" || status === "blocked")
            ? existing.reason
            : t(resume() ? "continuous_goal.intent.budget_resume" : "continuous_goal.intent.budget"),
        ...(tokenBudget !== undefined ? { tokenBudget } : {}),
        ...(turnBudget !== undefined ? { turnBudget } : {}),
      })
    } catch (error) {
      setValidation(error instanceof Error ? error.message : String(error))
    }
  }
  const error = () => failure() ?? projection.error
  const canReviewCurrentRevision = () =>
    error() instanceof ApiError &&
    (error() as ApiError).body &&
    ((error() as ApiError).body as { data?: { code?: string } }).data?.code === "revision_conflict" &&
    editing()?.id === goal()?.id &&
    goal()?.status !== "complete"

  return (
    <section
      ref={root}
      class="continuous-goal"
      classList={{ "continuous-goal--compact": props.compact, "continuous-goal--home": props.home }}
      aria-label={t("continuous_goal.title")}
      data-ui="continuous-goal-control"
    >
      <Show when={props.home}>
        <div class="continuous-goal__welcome">
          <div class="continuous-goal__welcome-icon" aria-hidden="true">
            <Icon name="goals" size="large" />
          </div>
          <div>
            <h2>{t("continuous_goal.home.title")}</h2>
            <p>{t("continuous_goal.home.body")}</p>
          </div>
        </div>
        <div class="continuous-goal__home-actions">
          <Button
            type="button"
            variant="solid"
            size="md"
            tone="accent"
            disabled={!appStore.connected || props.starting || busy()}
            onClick={() => open("create")}
          >
            <Icon name="goals" size="compact" />
            {t(props.starting ? "continuous_goal.home.starting" : "continuous_goal.create")}
          </Button>
          <Button type="button" variant="ghost" size="sm" tone="neutral" disabled={busy() || props.starting} onClick={() => open("about")}>
            {t("continuous_goal.home.how")}
          </Button>
        </div>
      </Show>
      <Show when={!props.home}>
        <div class="continuous-goal__row">
          <Icon name="goals" size="standard" />
          <strong class="continuous-goal__name">{t("continuous_goal.title")}</strong>
          <Show
            when={goal()}
            fallback={
              <span class="continuous-goal__empty">
                {initialLoading()
                  ? t("continuous_goal.loading")
                  : props.owner
                    ? t("continuous_goal.empty")
                    : t("continuous_goal.choose_owner")}
              </span>
            }
          >
            {(current) => (
              <>
                <Badge tone={tones[current().status]} size="sm" aria-live="polite">
                  {t(`continuous_goal.status.${current().status}`)}
                </Badge>
                <span class="continuous-goal__objective" title={current().objective}>
                  {current().objective}
                </span>
                <span class="continuous-goal__usage" title={t("continuous_goal.usage_hint")}>
                  {number(current().tokensUsed)}
                  {current().tokenBudget === undefined ? "" : ` / ${number(current().tokenBudget!)}`}{" "}
                  {t("continuous_goal.tokens_short")} · {number(current().turnsAccepted)}
                  {current().turnBudget === undefined ? "" : ` / ${number(current().turnBudget!)}`}{" "}
                  {t("continuous_goal.turns_short")}
                </span>
                <Show when={current().status !== "complete"}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    tone="neutral"
                    disabled={disabled()}
                    onClick={() => changeStatus(current().status === "active" ? "paused" : "active")}
                  >
                    {t(
                      current().status === "active"
                        ? "continuous_goal.pause"
                        : current().status === "budget_limited" || needsBudgetIncrease(current())
                          ? "continuous_goal.adjust_resume"
                          : "continuous_goal.resume",
                    )}
                  </Button>
                </Show>
              </>
            )}
          </Show>
          <Button
            type="button"
            variant={goal() || !props.owner ? "ghost" : "outline"}
            size="sm"
            tone={goal() || !props.owner ? "neutral" : "accent"}
            disabled={busy() || initialLoading() || !!projection.error}
            onClick={() => open(goal() ? "details" : "create")}
            data-ui="continuous-goal-settings"
          >
            {t(goal() ? "continuous_goal.details" : props.owner ? "continuous_goal.create" : "continuous_goal.learn")}
          </Button>
        </div>
      </Show>
      <Show when={goal() && goal()!.status !== "active" && currentReason()}>
        <p class="continuous-goal__reason">{currentReason()}</p>
      </Show>
      <Show when={notice()}>
        <span class="continuous-goal__notice" role="status">
          {t(notice())}
        </span>
      </Show>
      <Show when={error() && !mode()}>
        <Feedback
          tone="error"
          title={errorSummary(error())}
          details={formatErrorDetails(error())}
          actions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tone="neutral"
              disabled={!source() || busy()}
              onClick={() => {
                setFailure(undefined)
                void refetch()
              }}
            >
              {t("common.retry")}
            </Button>
          }
        >
          {t("continuous_goal.error.inline")}
        </Feedback>
      </Show>
      <Dialog
        wide
        open={mode() !== null}
        title={t(
          !hasForm()
            ? "continuous_goal.learn"
            : mode() === "complete"
              ? "continuous_goal.complete_title"
              : mode() === "create"
                ? "continuous_goal.create_title"
                : "continuous_goal.details_title",
        )}
        onClose={() => {
          if (!busy()) setMode(null)
        }}
        backdropClose={!busy()}
        class="continuous-goal-dialog"
        formClass="continuous-goal-dialog__frame"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tone="neutral"
              disabled={busy()}
              onClick={() => setMode(null)}
            >
              {t("common.close")}
            </Button>
            <Show when={hasForm() && (source() || props.home) && (editing()?.status !== "complete" || mode() === "create")}>
              <Button type="submit" form={formID} variant="solid" size="sm" tone="accent"
                disabled={props.home ? busy() || props.starting || !appStore.connected || !ownsLaunch() : disabled()}>
                {t(
                  busy()
                    ? "continuous_goal.saving"
                    : mode() === "create"
                      ? "continuous_goal.create"
                      : mode() === "complete"
                        ? "continuous_goal.mark_complete"
                        : resume() || editing()?.status === "budget_limited"
                          ? "continuous_goal.save_resume"
                          : "common.save",
                )}
              </Button>
            </Show>
          </>
        }
      >
        <Show
          when={hasForm()}
          fallback={
            <div class="continuous-goal__intro">
              <p>{t("continuous_goal.about")}</p>
              <GoalGuideSteps />
              <p>{t("continuous_goal.pause_hint")}</p>
            </div>
          }
        >
          <form
            id={formID}
            class="continuous-goal__form"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <p class="continuous-goal__scope">{t(props.owner ? `continuous_goal.scope.${props.owner.kind}` : "continuous_goal.scope.new_chat")}</p>
            <Show
              when={mode() === "create"}
              fallback={
                <div class="continuous-goal__definition">
                  <Badge tone={tones[goal()?.status ?? editing()?.status ?? "paused"]}>
                    {t(`continuous_goal.status.${goal()?.status ?? editing()?.status ?? "paused"}`)}
                  </Badge>
                  <p tabIndex={0} aria-label={t("continuous_goal.objective")}>
                    {objective()}
                  </p>
                  <Show when={currentReason()}>
                    <p class="continuous-goal__evidence">{currentReason()}</p>
                  </Show>
                  <Show when={goal()?.updatedAt}>
                    <small>
                      {t("continuous_goal.updated", {
                        time: new Intl.DateTimeFormat(localeTag(), { dateStyle: "medium", timeStyle: "short" }).format(
                          goal()!.updatedAt,
                        ),
                      })}
                    </small>
                  </Show>
                </div>
              }
            >
              <p>{t("continuous_goal.about")}</p>
              <p class="continuous-goal__hint">{t("continuous_goal.activation_hint")}</p>
              <Show when={pendingComposerContext()}>
                <p class="continuous-goal__hint">{t("continuous_goal.pending_context_hint")}</p>
              </Show>
              <TextField.Root as="label" variant="multiline">
                <TextField.Label>{t("continuous_goal.objective")}</TextField.Label>
                <TextField.TextArea
                  value={objective()}
                  onInput={(e) => setObjective(e.currentTarget.value)}
                  required
                  maxLength={16000}
                  rows={4}
                  disabled={busy()}
                  placeholder={t("continuous_goal.objective_placeholder")}
                />
                <TextField.Description>{t("continuous_goal.objective_hint")}</TextField.Description>
              </TextField.Root>
            </Show>
            <Show
              when={mode() === "complete"}
              fallback={
                <>
                  <Show when={editing()}>
                    <div class="continuous-goal__totals">
                      <span>
                        {t("continuous_goal.tokens_used", {
                          count: number(goal()?.tokensUsed ?? editing()!.tokensUsed),
                        })}
                      </span>
                      <span>
                        {t("continuous_goal.turns_used", {
                          count: number(goal()?.turnsAccepted ?? editing()!.turnsAccepted),
                        })}
                      </span>
                    </div>
                  </Show>
                  <div class="continuous-goal__budgets">
                    <TextField.Root as="label">
                      <TextField.Label>{t("continuous_goal.token_budget")}</TextField.Label>
                      <TextField.Input
                        type="number"
                        min="1"
                        step="1"
                        value={tokens()}
                        disabled={busy() || editing()?.status === "complete"}
                        onInput={(e) => setTokens(e.currentTarget.value)}
                        placeholder={t("continuous_goal.unlimited")}
                      />
                      <TextField.Description>{t("continuous_goal.token_hint")}</TextField.Description>
                    </TextField.Root>
                    <TextField.Root as="label">
                      <TextField.Label>{t("continuous_goal.turn_budget")}</TextField.Label>
                      <TextField.Input
                        type="number"
                        min="1"
                        step="1"
                        value={turns()}
                        disabled={busy() || editing()?.status === "complete"}
                        onInput={(e) => setTurns(e.currentTarget.value)}
                        placeholder={t("continuous_goal.unlimited")}
                      />
                      <TextField.Description>{t("continuous_goal.turn_hint")}</TextField.Description>
                    </TextField.Root>
                  </div>
                  <p class="continuous-goal__hint">{t("continuous_goal.budget_hint")}</p>
                  <Show when={editing() && ["paused", "blocked"].includes(editing()!.status)}>
                    <Checkbox checked={resume()} onChange={setResume} disabled={busy()}>
                      {t("continuous_goal.resume_on_save")}
                    </Checkbox>
                  </Show>
                  <Show when={editing()?.status !== "complete"}>
                    <p class="continuous-goal__hint">{t("continuous_goal.pause_hint")}</p>
                  </Show>
                  <Show when={editing()}>
                    <div class="continuous-goal__secondary">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        tone="neutral"
                        disabled={busy()}
                        onClick={() => open(editing()!.status === "complete" ? "create" : "complete")}
                      >
                        {t(editing()!.status === "complete" ? "continuous_goal.new" : "continuous_goal.mark_complete")}
                      </Button>
                    </div>
                  </Show>
                </>
              }
            >
              <TextField.Root as="label" variant="multiline">
                <TextField.Label>{t("continuous_goal.evidence")}</TextField.Label>
                <TextField.TextArea
                  value={reason()}
                  onInput={(e) => setReason(e.currentTarget.value)}
                  required
                  maxLength={4000}
                  rows={4}
                  disabled={busy()}
                  placeholder={t("continuous_goal.evidence_placeholder")}
                />
                <TextField.Description>{t("continuous_goal.complete_hint")}</TextField.Description>
              </TextField.Root>
            </Show>
            <Show when={validation()}>
              <Feedback tone="error" title={t("continuous_goal.validation.title")}>
                {t(validation())}
              </Feedback>
            </Show>
            <Show when={error()}>
              <Feedback
                tone="error"
                title={errorSummary(error())}
                details={formatErrorDetails(error())}
                actions={
                  <Show when={canReviewCurrentRevision()}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      disabled={busy() || projection.loading}
                      onClick={() => {
                        setEditing(goal()!)
                        setFailure(undefined)
                        attempt = undefined
                      }}
                    >
                      {t("continuous_goal.review_current")}
                    </Button>
                  </Show>
                }
              >
                {t("continuous_goal.error.review")}
                <Show when={canReviewCurrentRevision() && goal()}>
                  {(current) => (
                    <div class="continuous-goal__current-limits">
                      <strong>{t("continuous_goal.current_limits")}</strong>
                      <dl class="continuous-goal__budgets">
                        <div>
                          <dt>{t("continuous_goal.token_budget")}</dt>
                          <dd>
                            {current().tokenBudget === undefined ? t("continuous_goal.unlimited") : number(current().tokenBudget!)}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("continuous_goal.turn_budget")}</dt>
                          <dd>
                            {current().turnBudget === undefined ? t("continuous_goal.unlimited") : number(current().turnBudget!)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </Show>
              </Feedback>
            </Show>
          </form>
        </Show>
      </Dialog>
    </section>
  )
}
