// ── externalUrl ──
// The one gate every externally-opened URL passes through.
//
// The desktop host hands a URL to the OS opener, which decides what a scheme
// means and refuses what it does not recognise. A browser has no such backstop:
// `window.open("javascript:…")` runs that code in the opener's origin, and a
// `data:` URL can carry a whole document. So the browser host validates before
// it opens, and it validates here rather than at each call site — the MCP App
// bridge in particular hands over URLs authored by the app being displayed.
//
// Credentials embedded in the authority (`https://user:pass@host`) are refused
// too: they are a phishing shape, and browsers strip or warn on them anyway.

/**
 * Parse a URL that a host may open externally.
 *
 * @throws if the value is not a credential-free `http:` / `https:` URL.
 */
export function externalUrl(value: string): URL {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw) throw new Error("An external URL is required")

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Not a valid URL: ${raw}`)
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Only http(s) URLs can be opened externally, received ${url.protocol}`)
  }
  if (url.username || url.password) {
    throw new Error("An external URL must not carry embedded credentials")
  }
  return url
}
