import {
  streamText as streamTextBase,
  Output,
  type StreamTextOnChunkCallback,
  type StreamTextOnErrorCallback,
  type StreamTextOnFinishCallback,
  type StreamTextOnStepFinishCallback,
  type StepResult,
  type ToolSet,
} from "ai"

import { Env } from "@/env"
import { abortableIterable } from "@/util/stream-activity"
import { createToolCallRepair } from "@/session/repair-hint"
import { Log } from "@/util/log"

// Single source for tool-call repair across every production streamText
// caller that registers tools (rule 8). Installing it here makes per-call
// omission structurally impossible for src/.
// Out of scope on purpose: one-off diagnostic scripts under
// script/cache-probe/ (e.g. trace-aisdk-wire.ts) deliberately import the
// raw SDK because their job is to observe UNWRAPPED wire behaviour;
// wrapping them would defeat the probe.
const repairLog = Log.create({ service: "llm-repair" })

type StreamTextOnAbortCallback<TOOLS extends ToolSet> = (event: {
  readonly steps: StepResult<TOOLS>[]
}) => PromiseLike<void> | void

export type TextHooks<TOOLS extends ToolSet = ToolSet> = {
  onAbort?: StreamTextOnAbortCallback<TOOLS>
  onChunk?: StreamTextOnChunkCallback<TOOLS>
  onError?: StreamTextOnErrorCallback
  onFinish?: StreamTextOnFinishCallback<TOOLS>
  onStepFinish?: StreamTextOnStepFinishCallback<TOOLS>
}

const DEFAULT_TIMEOUT_MS = 5_000

function timeoutMs(value?: number | false) {
  if (value === false) return undefined
  if (typeof value === "number" && value > 0) return value
  const env = Number.parseInt(Env.get("OPENCORVUS_LLM_TIMEOUT_MS") ?? "", 10)
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_TIMEOUT_MS
}

function retries(value?: number) {
  // Retries are now owned by withLLMActivity (packages/opencorvus/src/llm/activity.ts).
  // The AI SDK's `maxRetries` is set to 0 here so the SDK does NOT also retry —
  // double-retry was the cause of confused terminal events / mismatched
  // attempt counters / quota exhaustion noise across the layered retry stack
  // (see LLM activity redesign contract). The `value`
  // parameter is preserved on the input type for forward-compat but is
  // intentionally ignored — callers that want retries should configure
  // their LLMActivityPolicy.maxRetries instead.
  void value
  return 0
}

function signal(signal?: AbortSignal, timeout?: number | false) {
  const ms = timeoutMs(timeout)
  if (!ms) return signal
  const next = AbortSignal.timeout(ms)
  if (!signal) return next
  return AbortSignal.any([signal, next])
}

export function streamText<
  TOOLS extends ToolSet = ToolSet,
  STRUCTURED_OUTPUT extends Output.Output = Output.Output<string, string, never>,
>(
  input: Parameters<typeof streamTextBase<TOOLS, STRUCTURED_OUTPUT>>[0] & {
    timeoutMs?: number | false
    retries?: number
  },
) {
  const { timeoutMs: timeout, retries: count, abortSignal, ...rest } = input
  const composed = signal(abortSignal, timeout)
  type StreamTextInput = Parameters<typeof streamTextBase<TOOLS, STRUCTURED_OUTPUT>>[0]
  type StreamTextInputWithRepair = StreamTextInput & {
    experimental_repairToolCall?: ReturnType<typeof createToolCallRepair>
  }
  const restInput = rest as StreamTextInputWithRepair
  const repairToolCall =
    restInput.experimental_repairToolCall ??
    createToolCallRepair((restInput.tools ?? {}) as Parameters<typeof createToolCallRepair>[0], repairLog)
  const result = streamTextBase({
    ...restInput,
    abortSignal: composed,
    maxRetries: retries(count),
    // Caller-supplied repair wins (none currently); otherwise the single
    // wrapper-level repair covers this call. `tools` is read off the same
    // input so name-normalization keeps working.
    experimental_repairToolCall: repairToolCall,
  } as StreamTextInput)
  // The AI SDK's fullStream/textStream are AsyncIterableStreams whose
  // backing reader.read() can park indefinitely on a stalled upstream
  // socket; the abortSignal closes the connection but does not reject the
  // pending read. Wrap each iterable so consumers' for-await loops throw
  // an AbortError as soon as `composed` flips, no matter what the SDK /
  // Bun fetch reader does internally. Other properties (usage, response,
  // toAIStreamResponse, …) pass through unchanged via Proxy.
  if (!composed) return result
  return new Proxy(result, {
    get(target, prop, receiver) {
      if (prop === "fullStream") return abortableIterable(target.fullStream, composed)
      if (prop === "textStream") return abortableIterable(target.textStream, composed)
      return Reflect.get(target, prop, receiver)
    },
  })
}
