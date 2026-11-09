import { Show, createMemo, createSignal } from "solid-js"
import { appStore } from "../store/app"
import { settingsStore } from "../store/settings"
import { captureApiAuthority, type ApiAuthority } from "../services/api"
import { acknowledgeProjectMemoryNotice, organizeProjectMemory } from "../services/project-memory"
import { activeProjectDirectory } from "../services/project-directory"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"
import { formatErrorDetails } from "../utils/error-details"
import { AppLog } from "../utils/log"

type NoticeAction = "organize" | "acknowledge"

interface NoticeOwner {
  authority: ApiAuthority
  directory: string
  directoryEpoch: number
  generation: string
}

type NoticeActionState = { owner: NoticeOwner; action: NoticeAction } & (
  | { kind: "pending" }
  | { kind: "failed"; cause: unknown }
)

export function ProjectMemoryBanner() {
  const view = createMemo(() => {
    const projection = appStore.projectMemory
    if (!projection || !appStore.connected) return undefined
    const { directory, directoryEpoch, authorityRevision } = projection
    const authority = captureApiAuthority()
    if (directory !== activeProjectDirectory() || directoryEpoch !== settingsStore.directoryEpoch || authorityRevision !== authority.revision)
      return undefined
    const notice = projection.document.notice
    if (!notice || notice.acknowledged) return undefined
    return { notice, owner: { directory, directoryEpoch, authority, generation: notice.generation } }
  })
  const owner = createMemo(() => view()?.owner, undefined, {
    equals: (a, b) => a === b || !!a && !!b && a.directory === b.directory &&
      a.directoryEpoch === b.directoryEpoch && a.authority.revision === b.authority.revision && a.generation === b.generation,
  })
  const [actionState, setActionState] = createSignal<NoticeActionState>()
  const currentAction = () => {
    const state = actionState()
    return state?.owner === owner() ? state : undefined
  }
  const busyAction = () => {
    const state = currentAction()
    return state?.kind === "pending" ? state.action : undefined
  }
  const failure = () => {
    const state = currentAction()
    return state?.kind === "failed" ? state : undefined
  }

  async function run(current: NoticeOwner, action: NoticeAction) {
    if (owner() !== current || busyAction()) return
    const pending = { owner: current, action, kind: "pending" as const }
    setActionState(pending)
    const options = { directory: current.directory, authority: current.authority }
    try {
      if (action === "organize") await organizeProjectMemory(options)
      else await acknowledgeProjectMemoryNotice(current.generation, options)
    } catch (cause) {
      AppLog.error("project-memory", "Project MEMORY.MD action failed", { error: String(cause) })
      if (owner() === current && actionState() === pending) setActionState({ owner: current, action, kind: "failed", cause })
    } finally {
      if (actionState() === pending) setActionState(undefined)
    }
  }

  return (
    <Show when={owner()} keyed>
      {(current) => (
        <div class="memory-banner" role="alert" aria-live="assertive" data-status={view()?.notice.status}>
          <span class="memory-banner__dot" aria-hidden="true" />
          <div class="memory-banner__content">
            <strong>{t("memory.banner_title")}</strong>
            <span>{view()?.notice.message}</span>
            <Show when={failure()}>
              {(failed) => (
                <Feedback tone="error" details={formatErrorDetails(failed().cause)}>
                  {t(failed().action === "acknowledge" ? "memory.banner_dismiss_failed" : "memory.banner_organize_failed")}
                </Feedback>
              )}
            </Show>
          </div>
          <Button
            type="button" variant="solid" size="sm" tone="neutral"
            aria-disabled={!!busyAction() || undefined}
            aria-busy={busyAction() === "organize" || undefined}
            onClick={() => void run(current, "organize")}
          >
            {busyAction() === "organize" ? t("memory.banner_organizing") : t("memory.banner_organize")}
          </Button>
          <Button
            type="button" variant="ghost" size="sm" tone="neutral"
            aria-disabled={!!busyAction() || undefined}
            aria-busy={busyAction() === "acknowledge" || undefined}
            onClick={() => void run(current, "acknowledge")}
          >
            {busyAction() === "acknowledge" ? t("memory.banner_dismissing") : t("memory.banner_dismiss")}
          </Button>
        </div>
      )}
    </Show>
  )
}
