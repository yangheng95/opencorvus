const HTTP_URL_REGEX = /\bhttps?:\/\/[^\s<>"'`)\]]+/i

/** Derive the provider-neutral HTTP(S) URL task signal. */
export function deriveUrlSignals(text: string | undefined): {
  request_contains_url: boolean
} {
  const raw = text ?? ""
  return {
    request_contains_url: HTTP_URL_REGEX.test(raw),
  }
}
