export interface BrowserPreviewUrlDependencies {
  activeTaskID: () => string
  openBrowserPanel: () => void
  refreshBrowserPanel: () => void
  selectTarget: (input: { taskID: string; url: string }) => Promise<unknown>
}

export async function openBrowserPreviewUrlFromMessage(
  url: string,
  dependencies: BrowserPreviewUrlDependencies,
): Promise<boolean> {
  const taskID = dependencies.activeTaskID()
  if (!taskID) return false
  await dependencies.selectTarget({ taskID, url })
  dependencies.openBrowserPanel()
  dependencies.refreshBrowserPanel()
  return true
}

export async function handleBrowserPreviewLinkActivation(input: {
  previewUrl: string
  href: string
  canOpenExternalUrl: boolean
  openBrowserPreview: (url: string) => Promise<boolean>
  nativeOpen: (url: string) => Promise<unknown>
}): Promise<"browser-preview" | "native-open" | "ignored"> {
  if (input.previewUrl && (await input.openBrowserPreview(input.previewUrl))) return "browser-preview"
  if (!input.canOpenExternalUrl) return "ignored"
  await input.nativeOpen(input.href)
  return "native-open"
}
