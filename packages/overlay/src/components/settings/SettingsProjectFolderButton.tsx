import { createSignal } from "solid-js"
import { formatErrorDetails, reportError } from "../../services/diagnostics"
import { browseDirectory } from "../../services/workspace"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"

export function createSettingsProjectFolderPicker(options: {
  directory: () => string
  projectScopeTrigger: () => HTMLElement | undefined
  active?: () => boolean
}) {
  const [choosing, setChoosing] = createSignal(false)
  const isActive = () => options.active?.() ?? true

  async function choose(origin: HTMLButtonElement) {
    if (choosing() || options.directory() || !isActive()) return
    setChoosing(true)
    try {
      await browseDirectory()
    } catch (error) {
      reportError({
        id: "settings-project-folder",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      })
    } finally {
      setChoosing(false)
    }
    if (document.activeElement !== origin && document.activeElement !== document.body) return
    const target = options.directory() ? options.projectScopeTrigger() : origin
    if (isActive() && target?.isConnected) target.focus({ preventScroll: true })
  }

  return { choosing, choose }
}

export function SettingsProjectFolderButton(props: {
  picker: ReturnType<typeof createSettingsProjectFolderPicker>
  primary?: boolean
}) {
  return (
    <Button
      type="button"
      variant={props.primary ? "solid" : "outline"}
      size="md"
      tone={props.primary ? "accent" : "neutral"}
      aria-disabled={props.picker.choosing() || undefined}
      onClick={(event) => void props.picker.choose(event.currentTarget)}
    >
      {t("workspace.no_directory")}
    </Button>
  )
}
