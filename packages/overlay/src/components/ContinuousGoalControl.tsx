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
import { ApiError, captureApiAuthority, isApiAuthorityCurrent } from "../services/api"
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
  onFocusComposer?: () => void
  selectionEpoch?: number
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
  const [mode, setMode] = createSignal<"details" | "create" | "complete" | null>(null)
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
  let root: HTMLElement | undefined
  let noticeState = ""
  const number = (value: number) => new Intl.NumberFormat(localeTag()).format(value)
  const currentReason = () => {
    const value = goal()?.reason
    return value && systemReasons.has(value) ? t(`continuous_goal.reason.${value}`) : value
  }
  const owns = (key: string) => source()?.key === key
  const initialLoading = () => projection.state === "pending"
  const disabled = () => busy() || initialLoading() || !source() || !!projection.error

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

  function open(next: "details" | "create" | "complete") {
    const current = goal()
    setEditing(next === "create" ? undefined : current)
    setObjective(next === "create" ? "" : (current?.objective ?? ""))
    setTokens(next === "create" ? "" : current?.tokenBudget === undefined ? "" : String(current.tokenBudget))
    setTurns(next === "create" ? "" : current?.turnBudget === undefined ? "" : String(current.turnBudget))
    setReason("")
    setResume(false)
    setFailure(undefined)
    setValidation("")
    attempt = undefined
    setMode(next)
  }
  function requestID(input: unknown) {
    const key = JSON.stringify([source()?.key, input])
    if (attempt?.key !== key) attempt = { key, requestID: randomUUID() }
    return attempt!.requestID
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
        void mutate({
          objective: objective().trim(),
          ...(tokenBudget !== undefined ? { tokenBudget } : {}),
          ...(turnBudget !== undefined ? { turnBudget } : {}),
        })
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
          <Button type="button" variant="ghost" size="sm" tone="neutral" onClick={() => open("create")}>
            {t("continuous_goal.learn")}
          </Button>
        </div>
        <GoalGuideSteps />
        <Button type="button" variant="outline" size="sm" tone="accent" onClick={props.onFocusComposer}>
          {t("continuous_goal.home.begin")}
          <Icon name="arrow-up" size="compact" />
        </Button>
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
          !props.owner
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
            <Show when={source() && (editing()?.status !== "complete" || mode() === "create")}>
              <Button type="submit" form={formID} variant="solid" size="sm" tone="accent" disabled={disabled()}>
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
          when={props.owner}
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
            <p class="continuous-goal__scope">{t(`continuous_goal.scope.${props.owner!.kind}`)}</p>
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
              </Feedback>
            </Show>
          </form>
        </Show>
      </Dialog>
    </section>
  )
}
