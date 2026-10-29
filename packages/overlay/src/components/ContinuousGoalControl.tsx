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
  listenContinuousGoalRefresh,
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
import { Disclosure } from "./ui/Disclosure"
import { Feedback } from "./ui/Feedback"
import { Icon } from "./ui/Icon"
import { TextField } from "./ui/TextField"

const REFRESH_MS = 5_000
const CREATE_ACTION_LABEL_KEY = "continuous_goal.start"
const guideSteps = ["start", "define", "manage"] as const

export type GoalLaunchContext = { authority: ApiAuthority; selectionEpoch: number; composerDraftKey?: string }
export type GoalFormRequest = {
  sessionID: string
  authority: ApiAuthority
  selectionEpoch: number
  input: ContinuousGoalCreateInput
}

type GoalCreationDraft = {
  scope: string
  key?: string
  text: string
  objective: string
  tokens: string
  turns: string
  budgetOptionsOpen: boolean
}

function GoalGuideSteps() {
  return (
    <ol class="continuous-goal__steps">
      <For each={guideSteps}>
        {(step) => (
          <li>
            <strong>{t(`continuous_goal.guide.${step}.title`)}</strong>
            <span>{t(`continuous_goal.guide.${step}.body`, { createLabel: t("continuous_goal.title"), submitLabel: t(CREATE_ACTION_LABEL_KEY) })}</span>
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
  "model_not_configured",
  "model_unavailable",
  "user_paused",
  "user_resumed",
  "budget_updated",
  "budget_updated_and_resumed",
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
  ownerLabel?: string
  compact?: boolean
  home?: boolean
  openRequest: number
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
  const [guideReturn, setGuideReturn] = createSignal<"details" | "create" | "complete">()
  const [editing, setEditing] = createSignal<ContinuousGoal>()
  const [createDraft, setCreateDraft] = createSignal<GoalCreationDraft>()
  const [editedTokens, setEditedTokens] = createSignal("")
  const [editedTurns, setEditedTurns] = createSignal("")
  const [editedBudgetOptionsOpen, setEditedBudgetOptionsOpen] = createSignal(false)
  const creating = () => mode() === "create" || (mode() === "about" && guideReturn() === "create")
  const objective = () => creating() ? createDraft()?.objective ?? "" : editing()?.objective ?? ""
  const tokens = () => creating() ? createDraft()?.tokens ?? "" : editedTokens()
  const turns = () => creating() ? createDraft()?.turns ?? "" : editedTurns()
  const budgetOptionsOpen = () => creating() ? createDraft()?.budgetOptionsOpen ?? false : editedBudgetOptionsOpen()
  const updateCreateDraft = (fields: Partial<Pick<GoalCreationDraft, "objective" | "tokens" | "turns" | "budgetOptionsOpen">>) =>
    setCreateDraft((current) => current && { ...current, ...fields })
  const setObjective = (value: string) => updateCreateDraft({ objective: value })
  const setTokens = (value: string) => creating() ? updateCreateDraft({ tokens: value }) : setEditedTokens(value)
  const setTurns = (value: string) => creating() ? updateCreateDraft({ turns: value }) : setEditedTurns(value)
  const setBudgetOptionsOpen = (value: boolean) => creating()
    ? updateCreateDraft({ budgetOptionsOpen: value })
    : setEditedBudgetOptionsOpen(value)
  const [reason, setReason] = createSignal("")
  const [resume, setResume] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [failure, setFailure] = createSignal<unknown>()
  const [validation, setValidation] = createSignal("")
  const [notice, setNotice] = createSignal("")
  let attempt: { key: string; requestID: string } | undefined
  let launchOwner: GoalLaunchContext | undefined
  let disposed = false
  let root: HTMLElement | undefined
  let dialog: HTMLElement | undefined
  let objectiveField: HTMLTextAreaElement | undefined
  let completionField: HTMLTextAreaElement | undefined
  let detailsObjective: HTMLParagraphElement | undefined
  let closeControl: HTMLButtonElement | undefined
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
  const hasForm = () => mode() !== "about" && (!!props.owner || (props.home && mode() === "create"))

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
      setGuideReturn(undefined)
    }
  })

  createEffect(
    on(
      () => source()?.key,
      () => {
        setMode(null)
        setGuideReturn(undefined)
        setEditing(undefined)
        setFailure(undefined)
        setValidation("")
        setNotice("")
        setBusy(false)
        attempt = undefined
        setCreateDraft(undefined)
      },
    ),
  )
  createEffect(() => {
    const current = source()
    if (!current) return
    let refreshPending = false
    const flushRefresh = () => {
      if (
        refreshPending &&
        !projection.loading &&
        document.visibilityState === "visible" &&
        root?.parentElement?.getBoundingClientRect().height &&
        owns(current.key) &&
        isApiAuthorityCurrent(current.authority) &&
        !busy()
      ) {
        refreshPending = false
        void refetch()
      }
    }
    const refresh = () => {
      if (!owns(current.key) || !isApiAuthorityCurrent(current.authority)) return
      refreshPending = true
      flushRefresh()
    }
    // Let the current read settle before admitting one queued background read.
    // Replacing a slow first read repeatedly leaves the form waiting forever.
    createEffect(() => {
      const loading = projection.loading
      const mutating = busy()
      if (!loading && !mutating) flushRefresh()
    })
    const timer = window.setInterval(refresh, REFRESH_MS)
    let refreshQueued = false
    const stopRefresh = listenContinuousGoalRefresh(current.target, current.authority, () => {
      if (refreshQueued) return
      refreshQueued = true
      queueMicrotask(() => {
        refreshQueued = false
        refresh()
      })
    })
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    onCleanup(() => {
      refreshPending = false
      window.clearInterval(timer)
      stopRefresh()
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    })
  })

  createEffect(() => {
    const current = goal()
    if (current && noticeState && `${current.id}:${current.status}` !== noticeState) setNotice("")
  })

  function open(next: "details" | "create" | "complete" | "about") {
    const focusOwner = document.activeElement
    const transfer = mode() !== null && mode() !== next && dialog?.contains(focusOwner)
      ? { sourceKey: source()?.key, epoch: props.selectionEpoch, authority: captureApiAuthority() }
      : undefined
    const returning = mode() === "about" && guideReturn() === next
    if (next === "about") {
      const previous = mode()
      setGuideReturn(hasForm() && previous && previous !== "about" ? previous : undefined)
    } else if (!returning) {
      if (props.home && next === "create") {
        if (props.selectionEpoch === undefined) throw new Error("Home Goal form requires its workspace selection epoch")
        launchOwner = {
          authority: captureApiAuthority(), selectionEpoch: props.selectionEpoch, composerDraftKey: props.composerDraftKey,
        }
      } else launchOwner = undefined
      const current = goal()
      if (next === "create") {
        const key = props.composerDraftKey
        const text = key ? composerDraftText(key) : ""
        const scope = JSON.stringify([captureApiAuthority().revision, props.selectionEpoch, source()?.key, current?.id, key, text])
        setEditing(undefined)
        if (createDraft()?.scope !== scope) {
          setCreateDraft({ scope, key, text, objective: text, tokens: "", turns: "", budgetOptionsOpen: false })
        }
      } else {
        setEditing(current)
        setEditedTokens(current?.tokenBudget === undefined ? "" : String(current.tokenBudget))
        setEditedTurns(current?.turnBudget === undefined ? "" : String(current.turnBudget))
        setEditedBudgetOptionsOpen(current?.status !== "complete")
      }
      setReason("")
      setResume(false)
      setFailure(undefined)
      setValidation("")
      attempt = undefined
    }
    if (next !== "about") setGuideReturn(undefined)
    setMode(next)
    if (!transfer) return
    queueMicrotask(() => {
      if (
        disposed || mode() !== next || source()?.key !== transfer.sourceKey ||
        props.selectionEpoch !== transfer.epoch || !isApiAuthorityCurrent(transfer.authority) || !dialog?.isConnected
      ) return
      const active = document.activeElement
      if (active !== document.body && active !== focusOwner) return
      const target = next === "create" ? objectiveField
        : next === "complete" ? completionField
          : next === "details" ? detailsObjective : closeControl
      if (
        !target?.isConnected || !dialog.contains(target) || !target.getClientRects().length ||
        target.closest('[hidden], [inert], [aria-hidden="true"]') || target.matches(':disabled, [aria-disabled="true"]')
      ) return
      target.focus()
    })
  }
  let handledOpenRequest = props.openRequest
  createEffect(() => {
    const request = props.openRequest
    if (request === handledOpenRequest || initialLoading()) return
    handledOpenRequest = request
    if (busy() || props.starting) return
    open(goal() && goal()!.status !== "complete" ? "details" : "create")
  })
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
      const draft = "objective" in body ? createDraft() : undefined
      if (draft?.key && !pendingComposerContext() && composerDraftText(draft.key) === draft.text) {
        setComposerDraft(draft.key, "")
      }
      if ("objective" in body) setCreateDraft(undefined)
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
      reason: status === "active" ? "user_resumed" : "user_paused",
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
        resume()
          ? "active"
          : existing.status === "budget_limited"
            ? "paused"
            : existing.status
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
            : status === "paused"
              ? "user_paused"
              : resume() ? "budget_updated_and_resumed" : "budget_updated",
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
      classList={{
        "continuous-goal--compact": props.compact,
        "continuous-goal--complete": goal()?.status === "complete",
        "continuous-goal--idle": !goal() && (!error() || !!mode()),
      }}
      aria-label={t("continuous_goal.title")}
      data-ui="continuous-goal-control"
    >
      <Show when={!props.home && goal()}>
        <div class="continuous-goal__row">
          <Icon name="goals" size="standard" />
          <strong class="continuous-goal__name">{t("continuous_goal.title")}</strong>
          <Show when={goal()}>
            {(current) => (
              <>
                <Badge tone={tones[current().status]} size="sm" aria-live="polite">
                  {t(`continuous_goal.status.${current().status}`)}
                </Badge>
                <span class="continuous-goal__objective" title={current().objective}>
                  {current().objective}
                </span>
                <Show when={current().status !== "complete"}>
                  <span class="continuous-goal__usage" title={t("continuous_goal.usage_hint")}>
                    {number(current().tokensUsed)}
                    {current().tokenBudget === undefined ? "" : ` / ${number(current().tokenBudget!)}`}{" "}
                    {t("continuous_goal.tokens_short")} · {number(current().turnsAccepted)}
                    {current().turnBudget === undefined ? "" : ` / ${number(current().turnBudget!)}`}{" "}
                    {t("continuous_goal.turns_short")}
                  </span>
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
            variant="ghost"
            size="sm"
            tone="neutral"
            disabled={busy() || initialLoading() || !!projection.error}
            onClick={() => open("details")}
            data-ui="continuous-goal-settings"
          >
            {t("continuous_goal.details")}
          </Button>
        </div>
      </Show>
      <Show when={goal() && goal()!.status !== "active" && goal()!.status !== "complete" && currentReason()}>
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
        ref={(element) => { dialog = element }}
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
          if (!busy()) {
            setMode(null)
            setGuideReturn(undefined)
          }
        }}
        backdropClose={!busy()}
        class="continuous-goal-dialog"
        formClass="continuous-goal-dialog__frame"
        footer={
          <>
            <Show when={mode() !== "about"}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tone="neutral"
                disabled={busy()}
                onClick={() => open("about")}
              >
                {t("continuous_goal.learn")}
              </Button>
            </Show>
            <Show when={mode() === "about" && guideReturn()}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tone="neutral"
                disabled={busy()}
                onClick={() => open(guideReturn()!)}
              >
                {t("continuous_goal.back_to_form")}
              </Button>
            </Show>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tone="neutral"
              disabled={busy()}
              onClick={() => {
                setMode(null)
                setGuideReturn(undefined)
              }}
              ref={(element) => { closeControl = element }}
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
                      ? CREATE_ACTION_LABEL_KEY
                      : mode() === "complete"
                        ? "continuous_goal.mark_complete"
                        : resume()
                          ? "continuous_goal.save_resume"
                          : editing()?.status === "budget_limited"
                            ? "continuous_goal.save_paused"
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
            <Show when={props.owner}>
              <p class="continuous-goal__scope">
                {t(props.owner ? `continuous_goal.scope.${props.owner.kind}` : "continuous_goal.scope.new_chat")}
                <Show when={props.owner && props.ownerLabel}>
                  <strong class="continuous-goal__scope-owner">{props.ownerLabel}</strong>
                </Show>
              </p>
            </Show>
            <Show
              when={mode() === "create"}
              fallback={
                <div class="continuous-goal__definition">
                  <Badge tone={tones[goal()?.status ?? editing()?.status ?? "paused"]}>
                    {t(`continuous_goal.status.${goal()?.status ?? editing()?.status ?? "paused"}`)}
                  </Badge>
                  <p ref={(element) => { detailsObjective = element }} tabIndex={0} aria-label={t("continuous_goal.objective")}>
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
              <p class="continuous-goal__create-intro">{t(props.home ? "continuous_goal.home_intro" : "continuous_goal.create_intro")}</p>
              <Show when={pendingComposerContext()}>
                <p class="continuous-goal__hint">{t("continuous_goal.pending_context_hint")}</p>
              </Show>
              <TextField.Root as="label" variant="multiline">
                <TextField.Label>{t("continuous_goal.objective")}</TextField.Label>
                <TextField.TextArea
                  ref={(element) => { objectiveField = element }}
                  value={objective()}
                  onInvalid={(e) => e.currentTarget.setCustomValidity(t("continuous_goal.validation.objective"))}
                  onInput={(e) => {
                    e.currentTarget.setCustomValidity("")
                    setValidation("")
                    setObjective(e.currentTarget.value)
                  }}
                  required
                  maxLength={16000}
                  rows={3}
                  disabled={busy()}
                  placeholder={t("continuous_goal.objective_placeholder")}
                />
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
                    <p class="continuous-goal__hint">{t("continuous_goal.usage_hint")}</p>
                  </Show>
                  <Disclosure.Root
                    class="continuous-goal__budget-options"
                    open={budgetOptionsOpen()}
                    onOpenChange={setBudgetOptionsOpen}
                    size="md"
                  >
                    <Disclosure.Trigger>
                      {t("continuous_goal.budget_options")}
                      <span class="continuous-goal__budget-summary">
                        {t(tokens() || turns() ? "continuous_goal.budget_configured" : "continuous_goal.unlimited")}
                      </span>
                    </Disclosure.Trigger>
                    <Disclosure.Content>
                      <div class="continuous-goal__budgets">
                        <TextField.Root as="label">
                          <TextField.Label>{t("continuous_goal.token_budget")}</TextField.Label>
                          <TextField.Input
                            type="number"
                            min="1"
                            step="1"
                            value={tokens()}
                            disabled={busy() || editing()?.status === "complete"}
                            onInvalid={(e) => {
                              setBudgetOptionsOpen(true)
                              e.currentTarget.setCustomValidity(t("continuous_goal.validation.budget"))
                            }}
                            onInput={(e) => {
                              e.currentTarget.setCustomValidity("")
                              setValidation("")
                              setTokens(e.currentTarget.value)
                            }}
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
                            onInvalid={(e) => {
                              setBudgetOptionsOpen(true)
                              e.currentTarget.setCustomValidity(t("continuous_goal.validation.budget"))
                            }}
                            onInput={(e) => {
                              e.currentTarget.setCustomValidity("")
                              setValidation("")
                              setTurns(e.currentTarget.value)
                            }}
                            placeholder={t("continuous_goal.unlimited")}
                          />
                          <TextField.Description>{t("continuous_goal.turn_hint")}</TextField.Description>
                        </TextField.Root>
                      </div>
                      <p class="continuous-goal__hint">{t(mode() === "create" ? "continuous_goal.create_budget_hint" : "continuous_goal.budget_hint")}</p>
                      <Show when={mode() === "create"}>
                        <p class="continuous-goal__hint">{t("continuous_goal.objective_hint")}</p>
                      </Show>
                      <p class="continuous-goal__hint">{t("continuous_goal.pause_hint")}</p>
                    </Disclosure.Content>
                  </Disclosure.Root>
                  <Show when={editing() && ["paused", "blocked", "budget_limited"].includes(editing()!.status)}>
                    <Checkbox checked={resume()} onChange={setResume} disabled={busy()}>
                      {t("continuous_goal.resume_on_save")}
                    </Checkbox>
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
                  ref={(element) => { completionField = element }}
                  value={reason()}
                  onInvalid={(e) => e.currentTarget.setCustomValidity(t("continuous_goal.validation.reason"))}
                  onInput={(e) => {
                    e.currentTarget.setCustomValidity("")
                    setValidation("")
                    setReason(e.currentTarget.value)
                  }}
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
