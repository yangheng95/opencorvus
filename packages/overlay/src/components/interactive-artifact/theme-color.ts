export function requiredThemeColor(element: Element, token: `--${string}`): string {
  const value = getComputedStyle(element).getPropertyValue(token).trim()
  if (!value) throw new Error(`Interactive artifact theme token is missing: ${token}`)
  return value
}

export type ArtifactVisualTheme = {
  accent: string
  background: string
  border: string
  danger: string
  font: string
  good: string
  muted: string
  palette: string[]
  surface: string
  text: string
  textStrong: string
  warning: string
}

export function artifactVisualTheme(element: Element): ArtifactVisualTheme {
  const required = (token: `--${string}`) => requiredThemeColor(element, token)
  const accent = required("--accent")
  const good = required("--good")
  const warning = required("--warn")
  const danger = required("--bad")
  const muted = required("--text-soft")
  return {
    accent,
    background: required("--surface-inset"),
    border: required("--border"),
    danger,
    font: required("--font"),
    good,
    muted,
    palette: [accent, good, warning, danger, muted],
    surface: required("--surface"),
    text: required("--text"),
    textStrong: required("--text-strong"),
    warning,
  }
}
