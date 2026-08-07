const OPENCORVUS_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*opencorvus\.ai$/

let allowedOrigins: readonly string[] = []

export function configureCorsOrigins(input: readonly string[] = []) {
  allowedOrigins = input
}

export function isAllowedCorsOrigin(input: string | undefined) {
  if (!input) return true
  if (input.startsWith("http://localhost:")) return true
  if (input.startsWith("http://127.0.0.1:")) return true
  if (input === "tauri://localhost" || input === "http://tauri.localhost" || input === "https://tauri.localhost")
    return true
  if (OPENCORVUS_ORIGIN.test(input)) return true
  return allowedOrigins.includes(input)
}

export function isAllowedRequestOrigin(input: string | undefined, host: string | undefined) {
  if (!input) return true
  if (host && sameHost(input, host)) return true
  return isAllowedCorsOrigin(input)
}

function sameHost(origin: string, host: string) {
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
