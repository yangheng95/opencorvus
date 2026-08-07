export function collectText(result: { text?: string; steps: Array<{ text?: string }> }) {
  const direct = result.text?.trim() || ""
  if (direct) return direct
  return result.steps
    .map((step) => step.text?.trim() || "")
    .filter(Boolean)
    .join("\n\n")
}

export function summarizeToolUsage(steps: Array<{ toolCalls?: unknown[] }>) {
  const map: Record<string, number> = {}
  for (const step of steps) {
    const calls = Array.isArray(step.toolCalls) ? step.toolCalls : []
    for (const call of calls) {
      if (!call || typeof call !== "object" || !("toolName" in call)) continue
      const name = String((call as { toolName?: unknown }).toolName || "")
      if (!name) continue
      map[name] = (map[name] ?? 0) + 1
    }
  }
  return map
}

export function countToolCalls(steps: Array<{ toolCalls?: unknown[] }>) {
  return steps.reduce((sum, step) => sum + (Array.isArray(step.toolCalls) ? step.toolCalls.length : 0), 0)
}

export function ensureMeaningfulSummary(summary: string, defaultTitle: string): string {
  if (!summary) return defaultTitle
  const trimmed = summary.trim()
  if (trimmed.length < 5) return defaultTitle
  if (/^#+\s/.test(trimmed)) return defaultTitle
  if (/^[./\\]/.test(trimmed) && !trimmed.includes(" ")) return defaultTitle
  return trimmed
}

function headingLevel(line: string) {
  const match = line.trim().match(/^(#{1,6})\s+/)
  return match ? match[1].length : 0
}

export function sectionBody(text: string, names: string[], options?: { respectHeadingLevel?: boolean }) {
  const lines = text.split(/\r?\n/)
  const respectHeadingLevel = options?.respectHeadingLevel === true
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const title = line.trim().replace(/^#{1,6}\s*/, "")
    if (!names.some((name) => title.localeCompare(name, "en", { sensitivity: "accent" }) === 0)) continue
    const body: string[] = []
    const level = headingLevel(line)
    for (let j = i + 1; j < lines.length; j++) {
      const nextLevel = headingLevel(lines[j])
      if (respectHeadingLevel && level > 0) {
        if (nextLevel > 0 && nextLevel <= level) break
      } else if (nextLevel > 0) {
        break
      }
      body.push(lines[j])
    }
    return body.join("\n").trim()
  }
  return ""
}

export function parseListSection(text: string, names: string[], options?: { respectHeadingLevel?: boolean }) {
  return sectionBody(text, names, options)
    .split(/\r?\n/)
    .flatMap((line) => {
      const value = line
        .trim()
        .replace(/^[-*\u2022]\s+/, "")
        .replace(/^\d+[.)\u3001]\s+/, "")
      return value ? [value] : []
    })
}

export function parseNamedPairs(text: string) {
  return text.split(/\r?\n/).flatMap((line) => {
    const value = line
      .trim()
      .replace(/^[-*\u2022]\s+/, "")
      .replace(/^\d+[.)\u3001]\s+/, "")
    if (!value) return []
    const pair = value.split(/[:\uFF1A]/)
    if (pair.length < 2) return []
    return [
      {
        question: pair[0].trim(),
        assumption: pair.slice(1).join(":").trim(),
      },
    ]
  })
}

export function firstContentLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => !!line && !/^#{1,6}\s+/.test(line)) || ""
  )
}

export function splitBlocks(text: string) {
  const lines = text.split(/\r?\n/)
  const blocks: string[][] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const numbered = /^\d+[.)\u3001]\s+/.test(line)
    const bulleted = /^[-*\u2022]\s+/.test(line)
    const current = blocks[blocks.length - 1]
    const currentNumbered = current ? /^\d+[.)\u3001]\s+/.test(current[0] || "") : false
    if (numbered || (bulleted && !currentNumbered)) {
      blocks.push([line])
      continue
    }
    if (blocks.length === 0) {
      blocks.push([line])
      continue
    }
    blocks[blocks.length - 1].push(line)
  }
  return blocks
}
