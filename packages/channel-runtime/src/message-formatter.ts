const CHANNEL_DEBUG_TOOL_INPUT_ENV = "OPENCORVUS_CHANNEL_DEBUG_TOOL_INPUT"
export const BOT_MESSAGE_LIMIT = 3900

type Env = Record<string, string | undefined>

export type ToolInput = {
  command?: string
  filePath?: string
  name?: string
  action?: string
  title?: string
  window_id?: number
  key?: string
  x?: number
  y?: number
  button?: string
  text?: string
  ms?: number
  direction?: string
  amount?: number
  startX?: number
  startY?: number
  endX?: number
  endY?: number
}

function bool(input: string | undefined) {
  if (!input) return false
  const value = input.trim().toLowerCase()
  return value === "1" || value === "true" || value === "yes" || value === "on"
}

function inputData(input: unknown): ToolInput {
  if (!input || typeof input !== "object") return {}
  return input as ToolInput
}

export function toolInputDebug(env: Env = process.env) {
  return bool(env[CHANNEL_DEBUG_TOOL_INPUT_ENV])
}

export function polishText(text: string): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim()
  if (!normalized) return ""
  return normalized
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
}

export function splitText(text: string, limit = BOT_MESSAGE_LIMIT): string[] {
  if (text.length <= limit) return [text]

  const out: string[] = []
  const blocks = text.split(/\n{2,}/)
  let chunk = ""

  for (const block of blocks) {
    const joined = chunk ? `${chunk}\n\n${block}` : block
    if (joined.length <= limit) {
      chunk = joined
      continue
    }

    if (chunk) {
      out.push(chunk)
      chunk = ""
    }

    if (block.length <= limit) {
      chunk = block
      continue
    }

    for (const line of block.split("\n")) {
      const next = chunk ? `${chunk}\n${line}` : line
      if (next.length <= limit) {
        chunk = next
        continue
      }

      if (chunk) {
        out.push(chunk)
        chunk = ""
      }

      if (line.length <= limit) {
        chunk = line
        continue
      }

      let index = 0
      while (index < line.length) {
        const part = line.slice(index, index + limit)
        if (part.length === limit) {
          out.push(part)
          index += limit
          continue
        }
        chunk = part
        index = line.length
      }
    }
  }

  if (chunk) out.push(chunk)
  return out
}

/** Format a brief status message for important tool completions */
export function formatToolStatus(tool: string, input: unknown, env: Env = process.env): string | null {
  const data = inputData(input)
  const debug = toolInputDebug(env)
  switch (tool) {
    case "bash": {
      if (!debug) return "`$ bash`"
      const cmd = data.command ?? ""
      const short = cmd.length > 80 ? cmd.slice(0, 80) + "..." : cmd
      return `\`$ ${short}\``
    }
    case "edit":
      if (!debug) return "`edit`"
      return `\`edit ${data.filePath ?? "file"}\``
    case "write":
      if (!debug) return "`write`"
      return `\`write ${data.filePath ?? "file"}\``
    case "skill":
      if (!debug) return "`skill`"
      return `\`skill: ${data.name ?? "?"}\``
    case "screen": {
      const action = data.action
      if (action === "bind_window" && !debug) return "`screen.bind_window`"
      if (action === "bind_window") {
        const target = data.title ?? (typeof data.window_id === "number" ? `#${data.window_id}` : "?")
        return `\`screen.bind_window: ${target}\``
      }
      if (action === "list_windows") return "`screen.list_windows`"
      if (action === "screenshot") return "`screen.screenshot`"
      if (action) return `\`screen.${action}\``
      return "`screen`"
    }
    case "input": {
      const action = data.action
      if (!action) return "`input`"
      if (!debug) return `\`input.${action}\``
      if (action === "key") return `\`input.key: ${data.key ?? "?"}\``
      if (action === "click") return `\`input.click: (${data.x ?? "?"}, ${data.y ?? "?"}) ${data.button ?? "left"}\``
      if (action === "type") return `\`input.type: ${Math.min(String(data.text ?? "").length, 999)} chars\``
      if (action === "wait") return `\`input.wait: ${data.ms ?? "?"}ms\``
      if (action === "scroll") return `\`input.scroll: ${data.direction ?? "?"} ${data.amount ?? ""}\``
      if (action === "drag")
        return `\`input.drag: (${data.startX ?? "?"}, ${data.startY ?? "?"}) -> (${data.endX ?? "?"}, ${data.endY ?? "?"})\``
      if (action === "move") return `\`input.move: (${data.x ?? "?"}, ${data.y ?? "?"})\``
      return "`input`"
    }
    default:
      return null
  }
}
