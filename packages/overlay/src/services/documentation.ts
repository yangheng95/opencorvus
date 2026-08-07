import { nativeOpen } from "../utils/native"

export type DocumentationEntryID = "quickstart" | "sdk"

const DOCUMENTATION_BASE_URL = "https://opencorvus.ai/docs"

const DOCUMENTATION_ENTRY_PATHS: Record<DocumentationEntryID, string> = {
  quickstart: "start/quickstart/",
  sdk: "reference/sdk/",
}

function localePrefix(locale: string): string {
  return locale === "zh-CN" ? "zh-cn/" : ""
}

export function documentationEntryUrl(id: DocumentationEntryID, locale: string): string {
  const path = DOCUMENTATION_ENTRY_PATHS[id]
  return `${DOCUMENTATION_BASE_URL}/${localePrefix(locale)}${path}`
}

export async function openDocumentationEntry(id: DocumentationEntryID, locale: string): Promise<boolean> {
  return nativeOpen(documentationEntryUrl(id, locale))
}
