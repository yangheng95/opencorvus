import type { ZodType } from "zod"
import { type TextHooks } from "./api"

type Call = {
  toolName?: string
  raw: string
  input?: unknown
}

function objectValue(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined
}

async function callAbort(hook: TextHooks | undefined, event: Parameters<NonNullable<TextHooks["onAbort"]>>[0]) {
  await hook?.onAbort?.(event)
}

async function callChunk(hook: TextHooks | undefined, event: Parameters<NonNullable<TextHooks["onChunk"]>>[0]) {
  await hook?.onChunk?.(event)
}

async function callError(hook: TextHooks | undefined, event: Parameters<NonNullable<TextHooks["onError"]>>[0]) {
  await hook?.onError?.(event)
}

async function callFinish(hook: TextHooks | undefined, event: Parameters<NonNullable<TextHooks["onFinish"]>>[0]) {
  await hook?.onFinish?.(event)
}

async function callStepFinish(
  hook: TextHooks | undefined,
  event: Parameters<NonNullable<TextHooks["onStepFinish"]>>[0],
) {
  await hook?.onStepFinish?.(event)
}

export function mergeTextHooks(...items: Array<TextHooks | undefined>): TextHooks {
  const hooks = items.filter((item) => !!item)
  if (hooks.length === 0) return {}
  return {
    onAbort: async (event) => {
      for (const hook of hooks) await callAbort(hook, event)
    },
    onChunk: async (event) => {
      for (const hook of hooks) await callChunk(hook, event)
    },
    onError: async (event) => {
      for (const hook of hooks) await callError(hook, event)
    },
    onFinish: async (event) => {
      for (const hook of hooks) await callFinish(hook, event)
    },
    onStepFinish: async (event) => {
      for (const hook of hooks) await callStepFinish(hook, event)
    },
  }
}

export function createToolInputCapture() {
  const calls = new Map<string, Call>()
  return {
    hooks: {
      onChunk: async ({ chunk }) => {
        const value = objectValue(chunk)
        const type = stringValue(value?.type)
        if (!type) return
        if (type === "tool-input-start") {
          const id = stringValue(value?.id)
          if (!id) return
          calls.set(id, {
            toolName: stringValue(value?.toolName),
            raw: "",
          })
          return
        }
        if (type === "tool-input-delta") {
          const id = stringValue(value?.id)
          const delta = stringValue(value?.delta)
          if (!id || delta === undefined) return
          const current = calls.get(id) ?? { raw: "" }
          calls.set(id, {
            ...current,
            raw: current.raw + delta,
          })
          return
        }
        if (type !== "tool-call") return
        const id = stringValue(value?.toolCallId)
        if (!id) return
        const current = calls.get(id) ?? { raw: "" }
        calls.set(id, {
          ...current,
          toolName: stringValue(value?.toolName) ?? current.toolName,
          input: value?.input,
        })
      },
    } satisfies TextHooks,
    recover<T>(toolName: string, schema: ZodType<T>) {
      const matches = [...calls.values()].reverse().filter((item) => item.toolName === toolName)
      for (const item of matches) {
        if (item.input !== undefined) {
          const parsed = schema.safeParse(item.input)
          if (parsed.success) return parsed.data
        }
        const raw = item.raw.trim()
        if (!raw) continue
        try {
          const parsed = schema.safeParse(JSON.parse(raw))
          if (parsed.success) return parsed.data
        } catch {}
      }
    },
  }
}

export function createTrackedToolCapture<T>(
  toolName: string,
  schema: ZodType<T>,
  onCapture?: (value: T) => void | Promise<void>,
) {
  const base = createToolInputCapture()
  let captured: T | undefined
  let notified = false
  let total = 0
  const usage: Record<string, number> = {}

  const read = () => {
    if (captured) return captured
    const next = base.recover(toolName, schema)
    if (!next) return
    captured = next
    return captured
  }

  return {
    hooks: mergeTextHooks(base.hooks, {
      onChunk: async (event) => {
        const value = objectValue(event.chunk)
        if (stringValue(value?.type) === "tool-call") {
          const name = stringValue(value?.toolName)
          if (name) {
            usage[name] = (usage[name] ?? 0) + 1
            total += 1
          }
        }
        const next = read()
        if (!next || notified) return
        notified = true
        await onCapture?.(next)
      },
    }),
    recover() {
      return read()
    },
    toolCallCount() {
      return total
    },
    toolUsage() {
      return { ...usage }
    },
  }
}
