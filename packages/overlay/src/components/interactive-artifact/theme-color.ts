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

export function artifactVegaConfig(
  theme: ArtifactVisualTheme,
  source: Record<string, unknown> = {},
): Record<string, unknown> {
  const defaults = {
    autosize: { type: "fit", contains: "padding" },
    background: "transparent",
    font: theme.font,
    range: { category: theme.palette },
    axis: {
      domain: false,
      gridColor: theme.border,
      gridOpacity: 0.58,
      labelColor: theme.muted,
      labelFont: theme.font,
      labelFontSize: 11,
      labelPadding: 8,
      tickColor: theme.border,
      tickSize: 4,
      titleColor: theme.muted,
      titleFont: theme.font,
      titleFontSize: 11,
      titleFontWeight: 500,
      titlePadding: 12,
    },
    legend: {
      labelColor: theme.muted,
      labelFont: theme.font,
      labelFontSize: 11,
      symbolSize: 70,
      titleColor: theme.textStrong,
      titleFont: theme.font,
      titleFontSize: 11,
      titleFontWeight: 600,
    },
    line: { strokeWidth: 2.5 },
    point: { filled: true, size: 64 },
    bar: { cornerRadiusTopLeft: 4, cornerRadiusTopRight: 4 },
    title: {
      anchor: "start",
      color: theme.textStrong,
      font: theme.font,
      fontSize: 14,
      fontWeight: 600,
      offset: 14,
    },
    view: { stroke: "transparent" },
  }
  const merge = (key: "axis" | "legend" | "title" | "view") => ({
    ...(source[key] && typeof source[key] === "object" && !Array.isArray(source[key])
      ? (source[key] as Record<string, unknown>)
      : {}),
    ...(defaults[key] as Record<string, unknown>),
  })
  return {
    ...source,
    ...defaults,
    axis: merge("axis"),
    legend: merge("legend"),
    title: merge("title"),
    view: merge("view"),
  }
}
