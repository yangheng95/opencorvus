/**
 * Provider-side LLM helpers reused by `session/llm.ts`.
 *
 * As of Phase E of structured-output systemic fix record
 * this module no longer exposes its own `streamText` entry point. The earlier
 * `ProviderLLM.stream()` was a parallel agent-level stream wrapper that
 * carried its own `toolChoice` typedef (limited to the string forms
 * `auto / required / none`), creating a dual-source risk vs `LLM.stream`'s
 * widened `{ type: "tool", toolName: string }` form. The function had
 * already been migrated away from by every agent (task-agent, decompose,
 * architect, planner — all now route through `SessionPrompt.prompt` →
 * `SessionLoop` → `LLM.stream`), so it was dead code that could only drift
 * out of sync with the canonical session stream. Rule 2 (delete旧) +
 * rule 22 (no dual sources) → remove.
 *
 * What this module still owns:
 *
 *   - `wrapModel(language, model, options)` — wraps a `LanguageModelV3`
 *     with the message-transform middleware that normalises messages for
 *     the target provider (Anthropic empty-content filtering, modality
 *     pruning, cache markers, …). Used by `session/llm.ts:241`.
 *
 *   - `baseHeaders(model, stickyKey?)` — default request headers. Used by
 *     `session/llm.ts:170`.
 */
import { wrapLanguageModel } from "ai"
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider"
import { Provider } from "./provider"
import { ProviderTransform } from "./transform"
import { applyVendorHeaders } from "./vendor-headers"

export namespace ProviderLLM {
  /**
   * Wrap a LanguageModelV3 with the message-transform middleware that
   * normalizes messages for the target provider (Anthropic empty-content
   * filtering, unsupported modality removal, cache markers, etc.).
   */
  export function wrapModel(
    language: Awaited<ReturnType<typeof Provider.getLanguage>>,
    model: Provider.Model,
    options: Record<string, any>,
  ) {
    if (!isLanguageModelV3(language)) return language
    return wrapLanguageModel({
      model: language,
      middleware: [
        {
          specificationVersion: "v3",
          async transformParams(args: any) {
            if (args.type === "stream") {
              args.params.prompt = await ProviderTransform.message(args.params.prompt, model, options)
            }
            return args.params
          },
          async wrapGenerate({ doGenerate, params }) {
            return normalizeGeneratedLocalToolCalls(await doGenerate(), params)
          },
          async wrapStream({ doStream, params }) {
            const result = await doStream()
            return {
              ...result,
              stream: normalizeLocalToolCallStream(result.stream, params),
            }
          },
        },
      ],
    })
  }

  function isLanguageModelV3(language: Awaited<ReturnType<typeof Provider.getLanguage>>): language is LanguageModelV3 {
    return typeof language === "object" && language !== null && language.specificationVersion === "v3"
  }

  function localFunctionToolNames(params: LanguageModelV3CallOptions): Set<string> {
    return new Set((params.tools ?? []).filter((tool) => tool.type === "function").map((tool) => tool.name))
  }

  function normalizeGeneratedLocalToolCalls(
    result: LanguageModelV3GenerateResult,
    params: LanguageModelV3CallOptions,
  ): LanguageModelV3GenerateResult {
    const localTools = localFunctionToolNames(params)
    if (localTools.size === 0) return result
    const content = result.content.map((part) => normalizeLocalToolCallPart(part, localTools))
    if (content.every((part, index) => part === result.content[index])) return result
    return { ...result, content }
  }

  function normalizeLocalToolCallStream(
    stream: LanguageModelV3StreamResult["stream"],
    params: LanguageModelV3CallOptions,
  ): LanguageModelV3StreamResult["stream"] {
    const localTools = localFunctionToolNames(params)
    if (localTools.size === 0) return stream
    return stream.pipeThrough(
      new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
        transform(chunk, controller) {
          controller.enqueue(normalizeLocalToolCallPart(chunk, localTools))
        },
      }),
    )
  }

  function normalizeLocalToolCallPart<T extends LanguageModelV3Content | LanguageModelV3StreamPart>(
    part: T,
    localTools: Set<string>,
  ): T {
    if (part.type !== "tool-call" && part.type !== "tool-input-start") return part
    if (!localTools.has(part.toolName)) return part
    if (part.providerExecuted !== true) return part
    const { providerExecuted: _providerExecuted, ...normalized } = part
    return normalized as T
  }

  /**
   * Compute default request headers for a model.
   * Does NOT include opencorvus project/session headers — those are session-specific.
   *
   * @param stickyKey optional stable identifier reserved for provider header rules.
   */
  export function baseHeaders(model: Provider.Model, stickyKey?: string): Record<string, string> {
    const headers: Record<string, string> = { ...model.headers }
    applyVendorHeaders(headers, model, stickyKey)
    return headers
  }
}
