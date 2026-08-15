export const ATTACHMENT_ROUTE_PREFIX = "/attachment"

/** Parse a canonical AttachmentStore URL without loading the storage/runtime graph. */
export function attachmentNameFromUrl(url: string): { projectID: string; name: string } | undefined {
  const prefix = `${ATTACHMENT_ROUTE_PREFIX}/`
  if (!url.startsWith(prefix)) return undefined
  const rest = url.slice(prefix.length)
  const slash = rest.indexOf("/")
  if (slash <= 0) return undefined
  const projectID = rest.slice(0, slash)
  const name = rest.slice(slash + 1)
  if (!projectID || !name || /[/\\?#]/.test(name)) return undefined
  return { projectID, name }
}
