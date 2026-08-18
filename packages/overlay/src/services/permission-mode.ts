// Authorization-mode read/write shared by the settings Permissions group and
// the composer's permission icon control. The write path is serialized through
// a single tail so two surfaces racing on the same config key cannot land out
// of order, and a generation guard drops responses that lost their Project.

import { appStore, setAppStore } from "../store/app"
import { t } from "../utils/i18n"
import { patchConfig, patchGlobalConfig } from "./config"
import { activeProjectDirectory } from "./project-directory"
import { formatErrorDetails, reportError } from "./diagnostics"

export type PermissionMode = "ask" | "full_access"

export function currentPermissionMode(): PermissionMode {
  return (appStore.config as { permission_mode?: PermissionMode } | undefined)?.permission_mode === "ask"
    ? "ask"
    : "full_access"
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

let permissionWriteTail = Promise.resolve()
let permissionWriteGeneration = 0

export function setPermissionMode(mode: PermissionMode): void {
  const directory = activeProjectDirectory().trim()
  const generation = ++permissionWriteGeneration
  const ownsResponse = () => permissionWriteGeneration === generation && activeProjectDirectory().trim() === directory
  permissionWriteTail = permissionWriteTail.then(async () => {
    try {
      const diff = { permission_mode: mode }
      if (directory) {
        await patchConfig(diff, {
          directory,
          isCurrentDirectory: (candidate) => activeProjectDirectory().trim() === candidate,
          ownsResponse,
        })
      } else {
        const saved = await patchGlobalConfig(diff, { ownsResponse })
        if (ownsResponse()) setAppStore("config", saved)
      }
    } catch (error) {
      if (!ownsResponse()) return
      reportError({
        id: "permissions:mode",
        title: t("permissions.title"),
        message: errorMessage(error),
        details: formatErrorDetails(error),
      })
    }
  })
}
