// ── Time utilities ──
// plus localeTag dependency from i18n module.

import { localeTag, t } from "./i18n"

function timeLocaleOptions(includeSeconds = true): Intl.DateTimeFormatOptions {
  return includeSeconds
    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" }
}

export function stamp(ts: number): string {
  if (!ts) return ""
  const d = new Date(ts)
  return d.toLocaleTimeString(localeTag(), timeLocaleOptions())
}

export function shortStamp(ts: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleTimeString(localeTag(), timeLocaleOptions(false))
}

export function detailStamp(ts: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleString(localeTag(), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Compact month/day/time label for dense conversation chrome. The complete
 * year and relative time remain available through `fullStampWithRelative`. */
export function compactDetailStamp(ts: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleString(localeTag(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function preciseStamp(ts: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleString(localeTag(), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return t("time.duration.hour_minute_second", { hours: h, minutes: m % 60, seconds: s % 60 })
  if (m > 0) return t("time.duration.minute_second", { minutes: m, seconds: s % 60 })
  return t("time.duration.second", { seconds: s })
}

// Relative time ("3m ago", "2h ago", "yesterday") suitable for hover
// tooltips next to absolute timestamps. Buckets are coarse on purpose —
// the operator scanning a long conversation only needs to know "recent
// vs. stale", not exact deltas. Falls back to the absolute detailStamp
// for events older than a week so very-old cards have a readable date.
export function relativeTime(ts: number, now: number = Date.now()): string {
  if (!ts || ts <= 0) return ""
  const delta = Math.max(0, now - ts)
  const sec = Math.round(delta / 1000)
  if (sec < 5) return t("time.relative.just_now")
  if (sec < 60) return t("time.relative.seconds_ago", { value: sec })
  const min = Math.round(sec / 60)
  if (min < 60) return t("time.relative.minutes_ago", { value: min })
  const hour = Math.round(min / 60)
  if (hour < 24) return t("time.relative.hours_ago", { value: hour })
  const day = Math.round(hour / 24)
  if (day < 7) return t("time.relative.days_ago", { value: day })
  return detailStamp(ts)
}

// Combined absolute + relative tooltip — useful for any element that
// already shows a short stamp() and wants to surface the full picture
// when the operator hovers. Format: "2026-04-29 12:34 — 3m ago".
export function fullStampWithRelative(ts: number): string {
  if (!ts || ts <= 0) return ""
  const abs = detailStamp(ts)
  const rel = relativeTime(ts)
  if (!abs) return rel
  if (!rel || rel === abs) return abs
  return `${abs} — ${rel}`
}
