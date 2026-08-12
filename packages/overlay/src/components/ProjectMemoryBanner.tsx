import { Show, createSignal } from "solid-js"
import { appStore } from "../store/app"
import { acknowledgeProjectMemoryNotice, organizeProjectMemory } from "../services/project-memory"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { AppLog } from "../utils/log"

export function ProjectMemoryBanner() {
  const [busy, setBusy] = createSignal(false)
  const notice = () => {
    const current = appStore.projectMemory?.notice
    return current && !current.acknowledged ? current : undefined
  }

  async function run(action: "organize" | "acknowledge") {
    const current = notice()
    if (!current || busy()) return
    setBusy(true)
    try {
      if (action === "organize") await organizeProjectMemory()
      else await acknowledgeProjectMemoryNotice(current.generation)
    } catch (error) {
      AppLog.error("project-memory", "Project MEMORY.MD action failed", { error: String(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Show when={notice()} keyed>
      {(current) => (
        <div class="memory-banner" role="alert" aria-live="assertive" data-status={current.status}>
          <span class="memory-banner__dot" aria-hidden="true" />
          <span class="memory-banner__content">
            <strong>{t("memory.banner_title")}</strong>
            <span>{current.message}</span>
          </span>
          <Button type="button" variant="solid" size="sm" tone="neutral" disabled={busy()} onClick={() => void run("organize")}>
            {t("memory.banner_organize")}
          </Button>
          <Button type="button" variant="ghost" size="sm" tone="neutral" disabled={busy()} onClick={() => void run("acknowledge")}>
            {t("memory.banner_dismiss")}
          </Button>
        </div>
      )}
    </Show>
  )
}
