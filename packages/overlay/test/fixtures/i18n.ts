import { readFileSync } from "node:fs"
import { join } from "node:path"
import { setLocaleData } from "../../src/utils/i18n"

const OVERLAY_ROOT = join(import.meta.dir, "..", "..")

export function installRealOverlayI18n(): void {
  const enUS = JSON.parse(readFileSync(join(OVERLAY_ROOT, "src/i18n/en-US.json"), "utf8")) as Record<string, unknown>
  const zhCN = JSON.parse(readFileSync(join(OVERLAY_ROOT, "src/i18n/zh-CN.json"), "utf8")) as Record<string, unknown>
  setLocaleData("en-US", enUS)
  setLocaleData("zh-CN", zhCN)
}
