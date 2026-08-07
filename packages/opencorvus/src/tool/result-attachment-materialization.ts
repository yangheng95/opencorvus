import { AttachmentStore } from "@/storage/attachment-store"
import { inlineBase64DataUrlMatch, redactInlinePayloads } from "@/util/inline-base64"
import { decodeDataUrlBase64Bytes } from "@/session/text-mime"

type MaterializationContext = {
  projectID: string | (() => string)
  resolvedProjectID?: string
  references: Map<string, string>
  memo: WeakMap<object, unknown>
  ancestors: WeakSet<object>
}

function inlineDataUrl(input: string, match: RegExpExecArray): string {
  const payload =
    input
      .slice(match.index + match[0].length)
      .match(/^[A-Za-z0-9+/_-]*={0,2}/)?.[0] ?? ""
  return input.slice(match.index, match.index + match[0].length + payload.length)
}

async function materializeString(input: string, context: MaterializationContext): Promise<string> {
  let output = input
  for (;;) {
    const match = inlineBase64DataUrlMatch(output)
    if (!match) return output
    const dataUrl = inlineDataUrl(output, match)
    let reference = context.references.get(dataUrl)
    if (!reference) {
      const mime = match[0].slice("data:".length).split(";", 1)[0]
      if (!mime) {
        throw new Error("Tool result inline base64 data URL must declare a media type")
      }
      const bytes = decodeDataUrlBase64Bytes(dataUrl, "materializeToolResultInlineAttachments")
      context.resolvedProjectID ??=
        typeof context.projectID === "function" ? context.projectID() : context.projectID
      reference = (await AttachmentStore.write(context.resolvedProjectID, bytes, mime)).url
      context.references.set(dataUrl, reference)
    }
    output = output.slice(0, match.index) + reference + output.slice(match.index + dataUrl.length)
  }
}

async function materializeValue(value: unknown, context: MaterializationContext): Promise<unknown> {
  if (typeof value === "string") return materializeString(value, context)
  if (!value || typeof value !== "object") return value
  if (context.ancestors.has(value)) {
    throw new Error("Tool result metadata must not contain cyclic values")
  }
  const memoized = context.memo.get(value)
  if (memoized !== undefined) return memoized
  context.ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const output: unknown[] = []
      context.memo.set(value, output)
      for (const item of value) output.push(await materializeValue(item, context))
      return output
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      const toJSON = (value as { toJSON?: unknown }).toJSON
      if (typeof toJSON !== "function") {
        throw new Error("Tool result metadata must contain only JSON-serializable values")
      }
      return materializeValue(toJSON.call(value), context)
    }
    const record = value as Record<string, unknown>
    if (
      typeof record.url === "string" &&
      record.url.startsWith("data:") &&
      typeof record.mime === "string"
    ) {
      const declaredMime = record.mime.toLowerCase()
      const match = inlineBase64DataUrlMatch(record.url)
      const encodedMime = match?.[0].slice("data:".length).split(";", 1)[0]?.toLowerCase()
      if (!match || !encodedMime || encodedMime !== declaredMime) {
        throw new Error(
          `Tool result attachment MIME ${record.mime} does not match its inline data URL media type`,
        )
      }
    }
    const output: Record<string, unknown> = {}
    context.memo.set(value, output)
    for (const [key, item] of Object.entries(record)) {
      output[key] = await materializeValue(item, context)
    }
    return output
  } finally {
    context.ancestors.delete(value)
  }
}

function redactValue(value: unknown, memo: WeakMap<object, unknown>, ancestors: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactInlinePayloads(value)
  }
  if (!value || typeof value !== "object") return value
  if (ancestors.has(value)) throw new Error("Tool diagnostic metadata must not contain cyclic values")
  const memoized = memo.get(value)
  if (memoized !== undefined) return memoized
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const output: unknown[] = []
      memo.set(value, output)
      for (const item of value) output.push(redactValue(item, memo, ancestors))
      return output
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      const toJSON = (value as { toJSON?: unknown }).toJSON
      if (typeof toJSON !== "function") {
        throw new Error("Tool diagnostic metadata must contain only JSON-serializable values")
      }
      return redactValue(toJSON.call(value), memo, ancestors)
    }
    const output: Record<string, unknown> = {}
    memo.set(value, output)
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = redactValue(item, memo, ancestors)
    }
    return output
  } finally {
    ancestors.delete(value)
  }
}

export function redactToolDiagnosticValue<T>(value: T): T {
  return redactValue(value, new WeakMap(), new WeakSet()) as T
}

function cloneInputValue(value: unknown, memo: WeakMap<object, unknown>, ancestors: WeakSet<object>): unknown {
  if (!value || typeof value !== "object") return value
  if (ancestors.has(value)) throw new Error("Tool input must not contain cyclic values")
  const memoized = memo.get(value)
  if (memoized !== undefined) return memoized
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const output: unknown[] = []
      memo.set(value, output)
      for (const item of value) output.push(cloneInputValue(item, memo, ancestors))
      return output
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      const toJSON = (value as { toJSON?: unknown }).toJSON
      if (typeof toJSON !== "function") throw new Error("Tool input must contain only JSON-serializable values")
      return cloneInputValue(toJSON.call(value), memo, ancestors)
    }
    const output: Record<string, unknown> = {}
    memo.set(value, output)
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = cloneInputValue(item, memo, ancestors)
    }
    return output
  } finally {
    ancestors.delete(value)
  }
}

/**
 * Clone the exact executed tool input without treating source text as a binary-result producer.
 * Binary result attachments use the separate content-addressed materialization boundary below.
 */
export function cloneToolInputForPersistence<T>(value: T): T {
  return cloneInputValue(value, new WeakMap(), new WeakSet()) as T
}

/**
 * Materialize inline binary data URLs emitted inside tool output or metadata.
 *
 * Tool results are a producer boundary: binary bytes become content-addressed
 * AttachmentStore objects before Session.updatePart persists the result. The
 * surrounding text remains intact and contains the durable attachment URL.
 */
export async function materializeToolResultInlineAttachments<T>(input: {
  projectID: string | (() => string)
  value: T
}): Promise<T> {
  return materializeValue(input.value, {
    projectID: input.projectID,
    references: new Map(),
    memo: new WeakMap(),
    ancestors: new WeakSet(),
  }) as Promise<T>
}
