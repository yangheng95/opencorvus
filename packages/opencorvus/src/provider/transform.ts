import type { ModelMessage } from "ai"
import { mergeDeep, unique } from "remeda"
import type { JSONSchema7 } from "@ai-sdk/provider"
import type { JSONSchema } from "zod/v4/core"
import type { ProviderModel } from "./model-schema"
import type { ModelsDev } from "./models"
import { iife } from "@/util/iife"
import { Flag } from "@/flag/flag"
import { AttachmentStore } from "@/storage/attachment-store"
import { prepareModelImageInput } from "@/session/model-image-input"
import { decodeDataUrlBase64Bytes, decodeRawBase64Payload } from "@/session/text-mime"
import { normalizeVendorMessages } from "./vendor-messages"
import { GLM_EVALUATION_TEMPERATURE, THINKING_MODEL_TOP_P } from "./sampling"
import { requiresOpenAIStrictToolSchema } from "./strict-tool-schema"

type Modality = NonNullable<ModelsDev.Model["modalities"]>["input"][number]

function mimeToModality(mime: string): Modality | undefined {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("video/")) return "video"
  if (mime === "application/pdf") return "pdf"
  return undefined
}

export namespace ProviderTransform {
  export const OUTPUT_TOKEN_MAX = Flag.OPENCORVUS_EXPERIMENTAL_OUTPUT_TOKEN_MAX || 64_000
  export type ToolChoice = "auto" | "required" | "none" | { type: "tool"; toolName: string }
  export type ToolResultAttachmentTransport =
    | {
        contentType: "image-data"
        adapter: "native"
      }
    | {
        contentType: "file-data"
        adapter: "openai-responses"
      }
    | {
        contentType: "unsupported"
        reason: string
      }

  const NATIVE_TOOL_RESULT_MEDIA_ADAPTERS = new Set([
    "@ai-sdk/amazon-bedrock",
    "@ai-sdk/anthropic",
    "@ai-sdk/gateway",
    "@ai-sdk/google",
    "@ai-sdk/google-vertex",
    "@ai-sdk/google-vertex/anthropic",
    "@ai-sdk/openai",
    "@openrouter/ai-sdk-provider",
  ])

  const OPENAI_RESPONSES_FILE_MIMES = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/csv",
    "text/tsv",
    "text/x-iif",
    "application/x-iif",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/rtf",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.apple.pages",
    "application/vnd.google-apps.document",
    "application/vnd.apple.iwork",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "application/vnd.apple.keynote",
    "application/vnd.google-apps.presentation",
    "application/javascript",
    "application/typescript",
    "text/xml",
    "text/x-shellscript",
    "text/x-rst",
    "text/x-makefile",
    "text/x-lisp",
    "text/x-asm",
    "text/vbscript",
    "text/css",
    "message/rfc822",
    "application/x-sql",
    "application/x-scala",
    "application/x-rust",
    "application/x-powershell",
    "text/x-diff",
    "text/x-patch",
    "application/x-patch",
    "text/plain",
    "text/markdown",
    "text/x-java",
    "text/x-script.python",
    "text/x-python",
    "text/x-c",
    "text/x-c++",
    "text/x-golang",
    "text/html",
    "text/x-php",
    "application/x-php",
    "application/x-httpd-php",
    "application/x-httpd-php-source",
    "text/x-ruby",
    "text/x-sh",
    "text/x-bash",
    "application/x-bash",
    "text/x-zsh",
    "text/x-tex",
    "text/x-csharp",
    "application/json",
    "text/x-typescript",
    "text/javascript",
    "text/x-go",
    "text/x-rust",
    "text/x-scala",
    "text/x-kotlin",
    "text/x-swift",
    "text/x-lua",
    "text/x-r",
    "text/x-R",
    "text/x-julia",
    "text/x-perl",
    "text/x-objectivec",
    "text/x-objectivec++",
    "text/x-erlang",
    "text/x-elixir",
    "text/x-haskell",
    "text/x-clojure",
    "text/x-groovy",
    "text/x-dart",
    "text/x-awk",
    "application/x-awk",
    "text/jsx",
    "text/tsx",
    "text/x-handlebars",
    "text/x-mustache",
    "text/x-ejs",
    "text/x-jinja2",
    "text/x-liquid",
    "text/x-erb",
    "text/x-twig",
    "text/x-pug",
    "text/x-jade",
    "text/x-tmpl",
    "text/x-cmake",
    "text/x-dockerfile",
    "text/x-gradle",
    "text/x-ini",
    "text/x-properties",
    "text/x-protobuf",
    "application/x-protobuf",
    "text/x-sql",
    "text/x-sass",
    "text/x-scss",
    "text/x-less",
    "text/x-hcl",
    "text/x-terraform",
    "application/x-terraform",
    "text/x-toml",
    "application/x-toml",
    "application/graphql",
    "application/x-graphql",
    "text/x-graphql",
    "application/x-ndjson",
    "application/json5",
    "application/x-json5",
    "text/x-yaml",
    "application/toml",
    "application/x-yaml",
    "application/yaml",
    "text/x-astro",
    "text/srt",
    "application/x-subrip",
    "text/x-subrip",
    "text/vtt",
    "text/x-vcard",
    "text/calendar",
  ])

  /**
   * Identifies the one typed AI SDK (Artificial Intelligence Software
   * Development Kit) content part that the configured provider adapter can
   * preserve for a tool-result attachment.
   *
   * Images keep their dedicated `image-data` semantics and model capability
   * check. Files use `file-data` only on the exact OpenAI Responses route and
   * for MIME (Multipurpose Internet Mail Extensions) types accepted by the
   * OpenAI file-input contract. Generic OpenAI-compatible, Anthropic,
   * Bedrock, Gateway, and OpenRouter adapters are deliberately not inferred
   * from package or model names.
   */
  export function toolResultAttachmentTransport(model: ProviderModel, mime: string): ToolResultAttachmentTransport {
    const modality = mimeToModality(mime)
    if (modality === "image") {
      if (!model.capabilities.input.image) {
        return {
          contentType: "unsupported",
          reason: `model ${model.id} does not declare image input capability`,
        }
      }

      if (NATIVE_TOOL_RESULT_MEDIA_ADAPTERS.has(model.api.npm)) {
        return {
          contentType: "image-data",
          adapter: "native",
        }
      }

      return {
        contentType: "unsupported",
        reason: `provider adapter ${model.api.npm} has no verified typed image tool-result transport`,
      }
    }

    const normalizedMime = mime.split(";", 1)[0].trim().toLowerCase()
    if (
      model.providerID === "openai" &&
      model.api.npm === "@ai-sdk/openai" &&
      OPENAI_RESPONSES_FILE_MIMES.has(normalizedMime)
    ) {
      return {
        contentType: "file-data",
        adapter: "openai-responses",
      }
    }

    return {
      contentType: "unsupported",
      reason: `provider ${model.providerID} adapter ${model.api.npm} has no verified file-data transport for MIME ${mime}`,
    }
  }

  // Maps npm package to the key the AI SDK expects for providerOptions
  function sdkKey(npm: string): string | undefined {
    switch (npm) {
      case "@ai-sdk/openai":
      case "@ai-sdk/azure":
        return "openai"
      case "@ai-sdk/amazon-bedrock":
        return "bedrock"
      case "@ai-sdk/anthropic":
      case "@ai-sdk/google-vertex/anthropic":
        return "anthropic"
      case "@ai-sdk/google-vertex":
      case "@ai-sdk/google":
        return "google"
      case "@ai-sdk/gateway":
        return "gateway"
      case "@openrouter/ai-sdk-provider":
        return "openrouter"
    }
    return undefined
  }

  /**
   * Apply vendor-specific message normalization. Implementation lives in
   * provider/vendor-messages.ts — see that file for the per-vendor rules
   * and the pre-vs-terminal staging model.
   */
  function normalizeMessages(msgs: ModelMessage[], model: ProviderModel): ModelMessage[] {
    return normalizeVendorMessages(msgs, model)
  }

  function applyCaching(msgs: ModelMessage[], model: ProviderModel): ModelMessage[] {
    // Anthropic allows up to 4 cache_control breakpoints per request. Layout:
    //   1. system[0]        — env/model header (stable per session)
    //   2. system[last]     — last system message; covers the WHOLE system
    //                          tail (skills, instructions, structured-output
    //                          rules) at 1h TTL. Without this breakpoint the
    //                          stable middle of system would only get the
    //                          5m TTL coverage from breakpoint #3.
    //   3. messages[-2]     — second-to-last user/assistant message at 5m
    //   4. messages[-1]     — last user/assistant message at 5m
    // When system has only 1-2 entries, the system slice naturally collapses
    // (deduped via a Set below) so we don't waste budget.
    const allSystem = msgs.filter((msg) => msg.role === "system")
    const systemEdges =
      allSystem.length === 0
        ? []
        : allSystem.length === 1
          ? [allSystem[0]]
          : [allSystem[0], allSystem[allSystem.length - 1]]
    const final = msgs.filter((msg) => msg.role !== "system").slice(-2)

    // System messages use 1h TTL — they are stable across tool-loop steps and
    // often across multiple invocations within the same task.  Non-system
    // (conversation tail) messages use the default 5m TTL.
    const systemOptions = {
      anthropic: {
        cacheControl: { type: "ephemeral", ttl: "1h" },
      },
      openrouter: {
        cacheControl: { type: "ephemeral" },
      },
      bedrock: {
        cachePoint: { type: "default" },
      },
      openaiCompatible: {
        cache_control: { type: "ephemeral" },
      },
    }

    const tailOptions = {
      anthropic: {
        cacheControl: { type: "ephemeral" },
      },
      openrouter: {
        cacheControl: { type: "ephemeral" },
      },
      bedrock: {
        cachePoint: { type: "default" },
      },
      openaiCompatible: {
        cache_control: { type: "ephemeral" },
      },
    }

    const systemSet = new Set<ModelMessage>(systemEdges)
    const optionsByMessage = new Map<ModelMessage, Record<string, any>>()
    for (const msg of unique([...systemEdges, ...final])) {
      optionsByMessage.set(msg, systemSet.has(msg) ? systemOptions : tailOptions)
    }

    return msgs.map((msg) => {
      const opts = optionsByMessage.get(msg)
      if (!opts) return msg
      const useMessageLevelOptions = model.providerID === "anthropic" || model.providerID.includes("bedrock")
      const shouldUseContentOptions = !useMessageLevelOptions && Array.isArray(msg.content) && msg.content.length > 0

      if (shouldUseContentOptions) {
        const lastContent = msg.content[msg.content.length - 1]
        if (lastContent && typeof lastContent === "object" && "providerOptions" in lastContent) {
          const nextContent = [...msg.content]
          nextContent[nextContent.length - 1] = {
            ...lastContent,
            providerOptions: mergeDeep(lastContent.providerOptions ?? {}, opts),
          }
          return { ...msg, content: nextContent } as ModelMessage
        }
      }

      return { ...msg, providerOptions: mergeDeep(msg.providerOptions ?? {}, opts) } as ModelMessage
    })
  }

  function unsupportedParts(msgs: ModelMessage[], model: ProviderModel): ModelMessage[] {
    return msgs.map((msg) => {
      if (msg.role !== "user" || !Array.isArray(msg.content)) return msg

      const filtered = msg.content.map((part) => {
        if (part.type !== "file" && part.type !== "image") return part

        if (part.type === "image") {
          const imageStr = part.image.toString()
          if (imageStr.startsWith("data:")) {
            decodeDataUrlBase64Bytes(imageStr, "ProviderTransform image input")
          }
        }

        const mime =
          part.type === "image"
            ? ((part as { mediaType?: string }).mediaType ?? part.image.toString().split(";")[0].replace("data:", ""))
            : (part.mediaType ?? (part as { mime?: string }).mime)
        if (!mime) return part
        const filename = part.type === "file" ? part.filename : undefined
        const modality = mimeToModality(mime)
        if (!modality) return part
        if (model.capabilities.input[modality]) return part

        const name = filename ? `"${filename}"` : modality
        return {
          type: "text" as const,
          text: `ERROR: Cannot read ${name} (this model does not support ${modality} input). Inform the user.`,
        }
      })

      return { ...msg, content: filtered }
    })
  }

  function filePartMime(part: { mediaType?: unknown; mime?: unknown }): string | undefined {
    if (typeof part.mediaType === "string" && part.mediaType.length > 0) return part.mediaType
    if (typeof part.mime === "string" && part.mime.length > 0) return part.mime
    return undefined
  }

  async function inlineLocalFilePart(part: unknown): Promise<{ part: unknown; note?: string }> {
    if (!part || typeof part !== "object" || Array.isArray(part)) return { part }
    const record = part as Record<string, unknown>
    if (record.type !== "file") return { part }
    const mime = filePartMime(record)
    if (!mime) return { part }
    const mediaType = mime

    // AI SDK v6 `file` part shape contract diverges by field:
    //   - `data`: openai-compatible adapter ALWAYS prepends `data:<mediaType>;base64,`
    //     itself when serializing to image_url. Feeding it a full data URL
    //     here double-wraps; some OpenAI-compatible gateways reject it as "Non-base64 digit
    //     found". Inline must be RAW base64 payload only.
    //   - `url`: adapter forwards verbatim. Full data URL is correct.
    const ref = (value: unknown): string | undefined =>
      typeof value === "string" && value.length > 0 && !value.startsWith("data:") ? value : undefined

    async function modelDataUrlFromReference(
      localRef: string,
    ): Promise<{ dataUrl: string; note?: string } | undefined> {
      const located = AttachmentStore.nameFromUrl(localRef)
      if (!located) return undefined
      const bytes = await AttachmentStore.read(located.projectID, located.name)
      const prepared = await prepareModelImageInput({
        mime: mediaType,
        bytes,
        source: typeof record.filename === "string" ? record.filename : localRef,
      })
      return {
        dataUrl: `data:${prepared.mime};base64,${prepared.bytes.toString("base64")}`,
        ...(prepared.note ? { note: prepared.note } : {}),
      }
    }

    const source = typeof record.filename === "string" ? record.filename : "inline file data URL"
    const dataUrlFromBytes = async (bytes: Buffer): Promise<{ dataUrl: string; note?: string }> => {
      if (!mediaType.startsWith("image/")) return { dataUrl: `data:${mediaType};base64,${bytes.toString("base64")}` }
      const prepared = await prepareModelImageInput({
        mime: mediaType,
        bytes,
        source,
      })
      return {
        dataUrl: `data:${prepared.mime};base64,${prepared.bytes.toString("base64")}`,
        ...(prepared.note ? { note: prepared.note } : {}),
      }
    }

    if (typeof record.data === "string" && record.data.startsWith("data:")) {
      const prepared = await dataUrlFromBytes(
        decodeDataUrlBase64Bytes(record.data, `ProviderTransform file.data ${source}`),
      )
      return {
        part: {
          ...record,
          data: prepared.dataUrl.replace(/^data:[^;]+;base64,/, ""),
          mediaType: prepared.dataUrl.slice("data:".length, prepared.dataUrl.indexOf(";base64,")),
        },
        ...(prepared.note ? { note: prepared.note } : {}),
      }
    }
    if (typeof record.url === "string" && record.url.startsWith("data:")) {
      const prepared = await dataUrlFromBytes(
        decodeDataUrlBase64Bytes(record.url, `ProviderTransform file.url ${source}`),
      )
      return {
        part: {
          ...record,
          url: prepared.dataUrl,
          mediaType: prepared.dataUrl.slice("data:".length, prepared.dataUrl.indexOf(";base64,")),
        },
        ...(prepared.note ? { note: prepared.note } : {}),
      }
    }

    const dataRef = ref(record.data)
    if (dataRef) {
      const prepared = await modelDataUrlFromReference(dataRef)
      if (prepared) {
        return {
          part: { ...record, data: prepared.dataUrl.replace(/^data:[^;]+;base64,/, "") },
          ...(prepared.note ? { note: prepared.note } : {}),
        }
      }
      if (!/^https?:\/\//i.test(dataRef)) {
        const raw = await dataUrlFromBytes(decodeRawBase64Payload(dataRef, `ProviderTransform file.data ${source}`))
        return {
          part: {
            ...record,
            data: raw.dataUrl.replace(/^data:[^;]+;base64,/, ""),
            mediaType: raw.dataUrl.slice("data:".length, raw.dataUrl.indexOf(";base64,")),
          },
          ...(raw.note ? { note: raw.note } : {}),
        }
      }
    }
    const urlRef = ref(record.url)
    if (urlRef) {
      const prepared = await modelDataUrlFromReference(urlRef)
      if (prepared) {
        return {
          part: { ...record, url: prepared.dataUrl },
          ...(prepared.note ? { note: prepared.note } : {}),
        }
      }
    }
    return { part }
  }

  async function inlineLocalAttachments(msgs: ModelMessage[]): Promise<ModelMessage[]> {
    const out: ModelMessage[] = []
    for (const msg of msgs) {
      if (!Array.isArray(msg.content)) {
        out.push(msg)
        continue
      }
      const content: unknown[] = []
      let changed = false
      for (const part of msg.content) {
        const next = await inlineLocalFilePart(part)
        changed ||= next.part !== part || typeof next.note === "string"
        content.push(next.part)
        if (next.note) content.push({ type: "text", text: next.note })
      }
      out.push(changed ? ({ ...msg, content } as ModelMessage) : msg)
    }
    return out
  }

  export async function message(msgs: ModelMessage[], model: ProviderModel, _options: Record<string, unknown>) {
    msgs = unsupportedParts(msgs, model)
    msgs = await inlineLocalAttachments(msgs)
    msgs = normalizeMessages(msgs, model)
    if (
      (model.providerID === "anthropic" ||
        model.api.id.includes("anthropic") ||
        model.api.id.includes("claude") ||
        model.id.includes("anthropic") ||
        model.id.includes("claude") ||
        model.api.npm === "@ai-sdk/anthropic") &&
      model.api.npm !== "@ai-sdk/gateway"
    ) {
      msgs = applyCaching(msgs, model)
    }

    // Remap providerOptions keys from stored providerID to expected SDK key
    const key = sdkKey(model.api.npm)
    if (key && key !== model.providerID && model.api.npm !== "@ai-sdk/azure") {
      const remap = (opts: Record<string, any> | undefined) => {
        if (!opts) return opts
        if (!(model.providerID in opts)) return opts
        const result = { ...opts }
        result[key] = result[model.providerID]
        delete result[model.providerID]
        return result
      }

      msgs = msgs.map((msg) => {
        if (!Array.isArray(msg.content)) return { ...msg, providerOptions: remap(msg.providerOptions) }
        return {
          ...msg,
          providerOptions: remap(msg.providerOptions),
          content: msg.content.map((part) =>
            "providerOptions" in part ? { ...part, providerOptions: remap(part.providerOptions) } : part,
          ),
        } as typeof msg
      })
    }

    return msgs
  }

  export function temperature(model: ProviderModel) {
    if (model.transform?.sampling && "temperature" in model.transform.sampling) {
      return model.transform.sampling.temperature
    }
    const id = model.id.toLowerCase()
    if (id.includes("qwen")) return 0.55
    if (id.includes("claude")) return undefined
    if (id.includes("gemini")) return 1.0
    if (id.includes("glm-4.6")) return GLM_EVALUATION_TEMPERATURE
    if (id.includes("glm-4.7")) return GLM_EVALUATION_TEMPERATURE
    if (id.includes("minimax-m2")) return 1.0
    if (id.includes("kimi-k2")) {
      // kimi-k2-thinking & kimi-k2.5 && kimi-k2p5 && kimi-k2-5
      if (["thinking", "k2.", "k2p", "k2-5"].some((s) => id.includes(s))) {
        return 1.0
      }
      return 0.6
    }
    return undefined
  }

  export function topP(model: ProviderModel) {
    if (model.transform?.sampling && "topP" in model.transform.sampling) {
      return model.transform.sampling.topP
    }
    const id = model.id.toLowerCase()
    if (id.includes("qwen")) return 1
    if (["minimax-m2", "gemini", "kimi-k2.5", "kimi-k2p5", "kimi-k2-5"].some((s) => id.includes(s))) {
      return THINKING_MODEL_TOP_P
    }
    return undefined
  }

  export function topK(model: ProviderModel) {
    if (model.transform?.sampling && "topK" in model.transform.sampling) {
      return model.transform.sampling.topK
    }
    const id = model.id.toLowerCase()
    if (id.includes("minimax-m2")) {
      if (["m2.", "m25", "m21"].some((s) => id.includes(s))) return 40
      return 20
    }
    if (id.includes("gemini")) return 64
    return undefined
  }

  const WIDELY_SUPPORTED_EFFORTS = ["low", "medium", "high"]
  const OPENAI_EFFORTS = ["none", "minimal", ...WIDELY_SUPPORTED_EFFORTS, "xhigh"]

  export function variants(model: ProviderModel): Record<string, Record<string, any>> {
    if (!model.capabilities.reasoning) return {}

    const id = model.id.toLowerCase()
    const isAnthropicAdaptive = ["opus-4-6", "opus-4.6", "sonnet-4-6", "sonnet-4.6"].some((v) =>
      model.api.id.includes(v),
    )
    const adaptiveEfforts = ["low", "medium", "high", "max"]
    if (
      id.includes("deepseek") ||
      id.includes("minimax") ||
      id.includes("glm") ||
      id.includes("mistral") ||
      id.includes("kimi") ||
      // models.dev currently ships the Kimi K2.5 release as "k2p5" (the
      // dot is escaped because the registry uses dots as path separators).
      // Match both forms so the family detection works regardless of which
      // ID the upstream catalog returns this week.
      id.includes("k2p5")
    )
      return {}

    // see: https://docs.x.ai/docs/guides/reasoning#control-how-hard-the-model-thinks
    if (id.includes("grok") && id.includes("grok-3-mini")) {
      if (model.api.npm === "@openrouter/ai-sdk-provider") {
        return {
          low: { reasoning: { effort: "low" } },
          high: { reasoning: { effort: "high" } },
        }
      }
      return {
        low: { reasoningEffort: "low" },
        high: { reasoningEffort: "high" },
      }
    }
    if (id.includes("grok")) return {}

    switch (model.api.npm) {
      case "@openrouter/ai-sdk-provider":
        if (!model.id.includes("gpt") && !model.id.includes("gemini-3") && !model.id.includes("claude")) return {}
        return Object.fromEntries(OPENAI_EFFORTS.map((effort) => [effort, { reasoning: { effort } }]))

      case "@ai-sdk/gateway":
        if (model.id.includes("anthropic")) {
          if (isAnthropicAdaptive) {
            return Object.fromEntries(
              adaptiveEfforts.map((effort) => [
                effort,
                {
                  thinking: {
                    type: "adaptive",
                  },
                  effort,
                },
              ]),
            )
          }
          return {
            high: {
              thinking: {
                type: "enabled",
                budgetTokens: 16000,
              },
            },
            max: {
              thinking: {
                type: "enabled",
                budgetTokens: 31999,
              },
            },
          }
        }
        if (model.id.includes("google")) {
          if (id.includes("2.5")) {
            return {
              high: {
                thinkingConfig: {
                  includeThoughts: true,
                  thinkingBudget: 16000,
                },
              },
              max: {
                thinkingConfig: {
                  includeThoughts: true,
                  thinkingBudget: 24576,
                },
              },
            }
          }
          return Object.fromEntries(
            ["low", "high"].map((effort) => [
              effort,
              {
                includeThoughts: true,
                thinkingLevel: effort,
              },
            ]),
          )
        }
        return Object.fromEntries(OPENAI_EFFORTS.map((effort) => [effort, { reasoningEffort: effort }]))

      case "@ai-sdk/cerebras":
      // https://v5.ai-sdk.dev/providers/ai-sdk-providers/cerebras
      case "@ai-sdk/togetherai":
      // https://v5.ai-sdk.dev/providers/ai-sdk-providers/togetherai
      case "@ai-sdk/xai":
      // https://v5.ai-sdk.dev/providers/ai-sdk-providers/xai
      case "@ai-sdk/deepinfra":
      // https://v5.ai-sdk.dev/providers/ai-sdk-providers/deepinfra
      case "venice-ai-sdk-provider":
      // https://docs.venice.ai/overview/guides/reasoning-models#reasoning-effort
      case "@ai-sdk/openai-compatible":
        return Object.fromEntries(WIDELY_SUPPORTED_EFFORTS.map((effort) => [effort, { reasoningEffort: effort }]))

      case "@ai-sdk/azure":
        // https://v5.ai-sdk.dev/providers/ai-sdk-providers/azure
        if (id === "o1-mini") return {}
        const azureEfforts = ["low", "medium", "high"]
        if (id.includes("gpt-5-") || id === "gpt-5") {
          azureEfforts.unshift("minimal")
        }
        return Object.fromEntries(
          azureEfforts.map((effort) => [
            effort,
            {
              reasoningEffort: effort,
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          ]),
        )
      case "@ai-sdk/openai":
        // https://v5.ai-sdk.dev/providers/ai-sdk-providers/openai
        if (id === "gpt-5-pro") return {}
        const openaiEfforts = iife(() => {
          if (id.includes("codex")) {
            if (id.includes("5.2") || id.includes("5.3")) return [...WIDELY_SUPPORTED_EFFORTS, "xhigh"]
            return WIDELY_SUPPORTED_EFFORTS
          }
          const arr = [...WIDELY_SUPPORTED_EFFORTS]
          if (id.includes("gpt-5-") || id === "gpt-5") {
            arr.unshift("minimal")
          }
          if (model.release_date >= "2025-11-13") {
            arr.unshift("none")
          }
          if (model.release_date >= "2025-12-04") {
            arr.push("xhigh")
          }
          return arr
        })
        return Object.fromEntries(
          openaiEfforts.map((effort) => [
            effort,
            {
              reasoningEffort: effort,
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          ]),
        )

      case "@ai-sdk/anthropic":
      // https://v5.ai-sdk.dev/providers/ai-sdk-providers/anthropic
      case "@ai-sdk/google-vertex/anthropic":
        // https://v5.ai-sdk.dev/providers/ai-sdk-providers/google-vertex#anthropic-provider

        if (isAnthropicAdaptive) {
          return Object.fromEntries(
            adaptiveEfforts.map((effort) => [
              effort,
              {
                thinking: {
                  type: "adaptive",
                },
                effort,
              },
            ]),
          )
        }

        return {
          high: {
            thinking: {
              type: "enabled",
              budgetTokens: Math.min(16_000, Math.floor(model.limit.output / 2 - 1)),
            },
          },
          max: {
            thinking: {
              type: "enabled",
              budgetTokens: Math.min(31_999, model.limit.output - 1),
            },
          },
        }

      case "@ai-sdk/amazon-bedrock":
        // https://v5.ai-sdk.dev/providers/ai-sdk-providers/amazon-bedrock
        if (isAnthropicAdaptive) {
          return Object.fromEntries(
            adaptiveEfforts.map((effort) => [
              effort,
              {
                reasoningConfig: {
                  type: "adaptive",
                  maxReasoningEffort: effort,
                },
              },
            ]),
          )
        }
        // For Anthropic models on Bedrock, use reasoningConfig with budgetTokens
        if (model.api.id.includes("anthropic")) {
          return {
            high: {
              reasoningConfig: {
                type: "enabled",
                budgetTokens: 16000,
              },
            },
            max: {
              reasoningConfig: {
                type: "enabled",
                budgetTokens: 31999,
              },
            },
          }
        }

        // For Amazon Nova models, use reasoningConfig with maxReasoningEffort
        return Object.fromEntries(
          WIDELY_SUPPORTED_EFFORTS.map((effort) => [
            effort,
            {
              reasoningConfig: {
                type: "enabled",
                maxReasoningEffort: effort,
              },
            },
          ]),
        )

      case "@ai-sdk/google-vertex":
      // https://v5.ai-sdk.dev/providers/ai-sdk-providers/google-vertex
      case "@ai-sdk/google":
        // https://v5.ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
        if (id.includes("2.5")) {
          return {
            high: {
              thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 16000,
              },
            },
            max: {
              thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 24576,
              },
            },
          }
        }
        let levels = ["low", "high"]
        if (id.includes("3.1")) {
          levels = ["low", "medium", "high"]
        }

        return Object.fromEntries(
          levels.map((effort) => [
            effort,
            {
              thinkingConfig: {
                includeThoughts: true,
                thinkingLevel: effort,
              },
            },
          ]),
        )

      case "@ai-sdk/mistral":
        // https://v5.ai-sdk.dev/providers/ai-sdk-providers/mistral
        return {}

      case "@ai-sdk/cohere":
        // https://v5.ai-sdk.dev/providers/ai-sdk-providers/cohere
        return {}

      case "@ai-sdk/groq":
        // https://v5.ai-sdk.dev/providers/ai-sdk-providers/groq
        const groqEffort = ["none", ...WIDELY_SUPPORTED_EFFORTS]
        return Object.fromEntries(
          groqEffort.map((effort) => [
            effort,
            {
              reasoningEffort: effort,
            },
          ]),
        )

      case "@ai-sdk/perplexity":
        // https://v5.ai-sdk.dev/providers/ai-sdk-providers/perplexity
        return {}

      case "@mymediset/sap-ai-provider":
      case "@jerome-benoit/sap-ai-provider-v2":
        if (model.api.id.includes("anthropic")) {
          return {
            high: {
              thinking: {
                type: "enabled",
                budgetTokens: 16000,
              },
            },
            max: {
              thinking: {
                type: "enabled",
                budgetTokens: 31999,
              },
            },
          }
        }
        return Object.fromEntries(WIDELY_SUPPORTED_EFFORTS.map((effort) => [effort, { reasoningEffort: effort }]))
    }
    return {}
  }

  export function options(input: {
    model: ProviderModel
    sessionID: string
    providerOptions?: Record<string, any>
  }): Record<string, any> {
    const result: Record<string, any> = { ...(input.model.transform?.options ?? {}) }

    // openai and providers using openai package should set store to false by default.
    if (input.model.providerID === "openai" || input.model.api.npm === "@ai-sdk/openai") {
      result["store"] = false
    }

    if (input.model.api.npm === "@openrouter/ai-sdk-provider") {
      result["usage"] = {
        include: true,
      }
      if (input.model.api.id.includes("gemini-3")) {
        result["reasoning"] = { effort: "high" }
      }
    }

    if (
      input.model.providerID === "baseten" ||
      (input.model.providerID === "opencorvus" && ["kimi-k2-thinking", "glm-4.6"].includes(input.model.api.id))
    ) {
      result["chat_template_args"] = { enable_thinking: true }
    }

    if (["zai", "zhipuai"].includes(input.model.providerID) && input.model.api.npm === "@ai-sdk/openai-compatible") {
      result["thinking"] = {
        type: "enabled",
        clear_thinking: false,
      }
    }

    if (input.model.providerID === "openai" || input.providerOptions?.setCacheKey) {
      result["promptCacheKey"] = input.sessionID
    }

    if (input.model.api.npm === "@ai-sdk/google" || input.model.api.npm === "@ai-sdk/google-vertex") {
      result["thinkingConfig"] = {
        includeThoughts: true,
      }
      if (input.model.api.id.includes("gemini-3")) {
        result["thinkingConfig"]["thinkingLevel"] = "high"
      }
    }

    // Enable thinking by default for kimi-k2.5/k2p5 models using anthropic SDK
    const modelId = input.model.api.id.toLowerCase()
    if (
      (input.model.api.npm === "@ai-sdk/anthropic" || input.model.api.npm === "@ai-sdk/google-vertex/anthropic") &&
      (modelId.includes("k2p5") || modelId.includes("kimi-k2.5") || modelId.includes("kimi-k2p5"))
    ) {
      result["thinking"] = {
        type: "enabled",
        budgetTokens: Math.min(16_000, Math.floor(input.model.limit.output / 2 - 1)),
      }
    }

    // DashScope's OpenAI-compatible API requires `enable_thinking: true` in the request body
    // to return reasoning_content. Without it, reasoning models never output thinking tokens.
    // Detect DashScope by API URL rather than hardcoding providerIDs.
    if (
      input.model.api.url?.includes("dashscope") &&
      input.model.capabilities.reasoning &&
      input.model.api.npm === "@ai-sdk/openai-compatible" &&
      !modelId.includes("kimi-k2-thinking")
    ) {
      result["enable_thinking"] = true
    }

    // GPT-5 reasoning params: only for SDKs that natively support them.
    // Generic @ai-sdk/openai-compatible providers (e.g. litellm proxies) pass
    // these as raw body fields — backends that don't recognise them return 400.
    const gpt5NativeSDKs = new Set(["@ai-sdk/openai", "@ai-sdk/azure"])
    if (
      input.model.api.id.includes("gpt-5") &&
      !input.model.api.id.includes("gpt-5-chat") &&
      (gpt5NativeSDKs.has(input.model.api.npm) || input.model.providerID.startsWith("opencorvus"))
    ) {
      if (!input.model.api.id.includes("gpt-5-pro")) {
        result["reasoningEffort"] = "medium"
        result["reasoningSummary"] = "auto"
      }

      // Only set textVerbosity for non-chat gpt-5.x models
      // Chat models (e.g. gpt-5.2-chat-latest) only support "medium" verbosity
      if (
        input.model.api.id.includes("gpt-5.") &&
        !input.model.api.id.includes("codex") &&
        !input.model.api.id.includes("-chat") &&
        input.model.providerID !== "azure"
      ) {
        result["textVerbosity"] = "low"
      }

      if (input.model.providerID.startsWith("opencorvus") || input.model.api.npm === "@ai-sdk/azure") {
        result["promptCacheKey"] = input.sessionID
      }

      if (input.model.providerID.startsWith("opencorvus")) {
        result["include"] = ["reasoning.encrypted_content"]
        result["reasoningSummary"] = "auto"
      }
    }

    if (input.model.providerID === "venice") {
      result["promptCacheKey"] = input.sessionID
    }

    if (input.model.providerID === "openrouter") {
      result["prompt_cache_key"] = input.sessionID
    }
    if (input.model.api.npm === "@ai-sdk/gateway") {
      result["gateway"] = {
        caching: "auto",
      }
    }

    return result
  }

  export function smallOptions(model: ProviderModel) {
    if (model.providerID === "openai" || model.api.npm === "@ai-sdk/openai") {
      if (model.api.id.includes("gpt-5")) {
        if (model.api.id.includes("5.")) {
          return { store: false, reasoningEffort: "low" }
        }
        return { store: false, reasoningEffort: "minimal" }
      }
      return { store: false }
    }
    if (model.providerID === "google") {
      // gemini-3 uses thinkingLevel, gemini-2.5 uses thinkingBudget
      if (model.api.id.includes("gemini-3")) {
        return { thinkingConfig: { thinkingLevel: "minimal" } }
      }
      return { thinkingConfig: { thinkingBudget: 0 } }
    }
    if (model.providerID === "openrouter") {
      if (model.api.id.includes("google")) {
        return { reasoning: { enabled: false } }
      }
      return { reasoningEffort: "minimal" }
    }

    if (model.providerID === "venice") {
      return { veniceParameters: { disableThinking: true } }
    }

    return {}
  }

  // Maps model ID prefix to provider slug used in providerOptions.
  // Example: "amazon/nova-2-lite" → "bedrock"
  const SLUG_OVERRIDES: Record<string, string> = {
    amazon: "bedrock",
  }

  export function providerOptions(model: ProviderModel, options: { [x: string]: any }) {
    if (model.api.npm === "@ai-sdk/gateway") {
      // Gateway providerOptions are split across two namespaces:
      // - `gateway`: gateway-native routing/caching controls (order, only, byok, etc.)
      // - `<upstream slug>`: provider-specific model options (anthropic/openai/...)
      // We keep `gateway` as-is and route every other top-level option under the
      // model-derived upstream slug.
      const i = model.api.id.indexOf("/")
      const rawSlug = i > 0 ? model.api.id.slice(0, i) : undefined
      const slug = rawSlug ? (SLUG_OVERRIDES[rawSlug] ?? rawSlug) : undefined
      const gateway = options.gateway
      const rest = Object.fromEntries(Object.entries(options).filter(([k]) => k !== "gateway"))
      const has = Object.keys(rest).length > 0

      const result: Record<string, any> = {}
      if (gateway !== undefined) result.gateway = gateway

      if (has) {
        if (slug) {
          // Route model-specific options under the provider slug
          result[slug] = rest
        } else if (gateway && typeof gateway === "object" && !Array.isArray(gateway)) {
          result.gateway = { ...gateway, ...rest }
        } else {
          result.gateway = rest
        }
      }

      return result
    }

    // Some Artificial Intelligence Software Development Kit providers derive
    // providerOptionsName by splitting the configured provider name on ".".
    // Mirror that only for packages known to use this convention; other
    // providers use fixed names or their exact provider id.
    const usesDotSplitOptions =
      model.api.npm === "@ai-sdk/openai-compatible" ||
      model.api.npm === "@ai-sdk/openai" ||
      model.api.npm === "@ai-sdk/anthropic"
    const key = sdkKey(model.api.npm) ?? (usesDotSplitOptions ? model.providerID.split(".")[0] : model.providerID)
    if (model.api.npm === "@ai-sdk/azure") {
      return { [key]: options, azure: options }
    }
    return { [key]: options }
  }

  export function optionsForToolChoice(
    model: ProviderModel,
    options: { [x: string]: any },
    toolChoice: ToolChoice | undefined,
  ) {
    if (!toolChoiceForcesToolCall(toolChoice)) return options
    if (!hasKimiDashScopeThinkingToolChoiceConflict(model)) return options
    if (options.enable_thinking !== true) return options
    return { ...options, enable_thinking: false }
  }

  function toolChoiceForcesToolCall(toolChoice: ToolChoice | undefined) {
    return toolChoice === "required" || (typeof toolChoice === "object" && toolChoice.type === "tool")
  }

  function hasKimiDashScopeThinkingToolChoiceConflict(model: ProviderModel) {
    const modelID = `${model.id} ${model.api.id}`.toLowerCase()
    return (
      model.api.npm === "@ai-sdk/openai-compatible" &&
      model.api.url?.includes("dashscope") === true &&
      (modelID.includes("kimi-k2.5") || modelID.includes("kimi-k2p5") || modelID.includes("k2p5"))
    )
  }

  export function maxOutputTokens(model: ProviderModel): number {
    return Math.min(model.limit.output, OUTPUT_TOKEN_MAX) || OUTPUT_TOKEN_MAX
  }

  const JSON_SCHEMA_ANNOTATION_KEYS = new Set([
    "$schema",
    "$comment",
    "title",
    "description",
    "default",
    "examples",
    "deprecated",
    "readOnly",
    "writeOnly",
  ])

  function schemaValidationIdentity(value: unknown): string {
    const normalize = (item: unknown): unknown => {
      if (Array.isArray(item)) return item.map(normalize)
      if (!item || typeof item !== "object") return item
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .filter(([key]) => !JSON_SCHEMA_ANNOTATION_KEYS.has(key))
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)]),
      )
    }
    return JSON.stringify(normalize(value))
  }

  function mergeEnumPropertySchemas(schemas: readonly Record<string, unknown>[]): Record<string, unknown> | undefined {
    const values: unknown[] = []
    for (const schema of schemas) {
      if (schema.type !== "string") return undefined
      if ("const" in schema) {
        values.push(schema.const)
        continue
      }
      if (Array.isArray(schema.enum)) {
        values.push(...schema.enum)
        continue
      }
      return undefined
    }
    const first = schemas[0]
    if (!first) return undefined
    const { const: _const, enum: _enum, ...base } = first
    return {
      ...base,
      type: "string",
      enum: [...new Map(values.map((value) => [JSON.stringify(value), value])).values()],
    }
  }

  function mergeVariantPropertySchemas(schemas: readonly unknown[]): unknown {
    const representatives = new Map<string, unknown>()
    for (const schema of schemas) {
      const identity = schemaValidationIdentity(schema)
      const current = representatives.get(identity)
      const descriptionLength = (value: unknown): number =>
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof (value as Record<string, unknown>).description === "string"
          ? ((value as Record<string, unknown>).description as string).trim().length
          : 0
      if (current === undefined || descriptionLength(schema) > descriptionLength(current)) {
        representatives.set(identity, schema)
      }
    }
    const unique = [...representatives.values()]
    if (unique.length === 1) return unique[0]

    const records = unique.filter(
      (schema): schema is Record<string, unknown> =>
        Boolean(schema && typeof schema === "object" && !Array.isArray(schema)),
    )
    if (records.length === unique.length) {
      const mergedEnum = mergeEnumPropertySchemas(records)
      if (mergedEnum) return mergedEnum
    }
    return { anyOf: unique }
  }

  function flattenRootObjectUnionSchema(input: unknown): unknown {
    if (!input || typeof input !== "object" || Array.isArray(input)) return input
    const schema = input as Record<string, unknown>
    if (schema.type) return schema
    const unionKey = Array.isArray(schema.anyOf) ? "anyOf" : Array.isArray(schema.oneOf) ? "oneOf" : undefined
    if (!unionKey) return schema
    const variants = (schema[unionKey] as unknown[]).filter(
      (variant): variant is Record<string, unknown> =>
        Boolean(
          variant &&
            typeof variant === "object" &&
            !Array.isArray(variant) &&
            (variant as Record<string, unknown>).type === "object" &&
            (variant as Record<string, unknown>).properties &&
            typeof (variant as Record<string, unknown>).properties === "object" &&
            !Array.isArray((variant as Record<string, unknown>).properties),
        ),
    )
    if (variants.length === 0) return schema

    const propertySchemas = new Map<string, unknown[]>()
    let requiredByEveryVariant: Set<string> | undefined
    for (const variant of variants) {
      for (const [field, propertySchema] of Object.entries(
        variant.properties as Record<string, unknown>,
      )) {
        const definitions = propertySchemas.get(field) ?? []
        definitions.push(propertySchema)
        propertySchemas.set(field, definitions)
      }
      const required = new Set(
        Array.isArray(variant.required)
          ? variant.required.filter((field): field is string => typeof field === "string")
          : [],
      )
      requiredByEveryVariant =
        requiredByEveryVariant === undefined
          ? required
          : new Set([...requiredByEveryVariant].filter((field) => required.has(field)))
    }

    const { anyOf: _anyOf, oneOf: _oneOf, ...root } = schema
    return {
      ...root,
      type: "object",
      properties: Object.fromEntries(
        [...propertySchemas.entries()].map(([field, definitions]) => [
          field,
          mergeVariantPropertySchemas(definitions),
        ]),
      ),
      required: [...(requiredByEveryVariant ?? [])],
    }
  }

  export function schema(model: ProviderModel, schema: JSONSchema.BaseSchema | JSONSchema7): JSONSchema7 {
    /*
    if (["openai", "azure"].includes(providerID)) {
      if (schema.type === "object" && schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          if (schema.required?.includes(key)) continue
          schema.properties[key] = {
            anyOf: [
              value as JSONSchema.JSONSchema,
              {
                type: "null",
              },
            ],
          }
        }
      }
    }
    */

    // Convert integer enums to string enums for Google/Gemini
    if (model.providerID === "google" || model.api.id.includes("gemini")) {
      const sanitizeGemini = (obj: any): any => {
        if (obj === null || typeof obj !== "object") {
          return obj
        }

        if (Array.isArray(obj)) {
          return obj.map(sanitizeGemini)
        }

        const result: any = {}
        for (const [key, value] of Object.entries(obj)) {
          if (key === "enum" && Array.isArray(value)) {
            // Convert all enum values to strings
            result[key] = value.map((v) => String(v))
            // If we have integer type with enum, change type to string
            if (result.type === "integer" || result.type === "number") {
              result.type = "string"
            }
          } else if (typeof value === "object" && value !== null) {
            result[key] = sanitizeGemini(value)
          } else {
            result[key] = value
          }
        }

        // Filter required array to only include fields that exist in properties
        if (result.type === "object" && result.properties && Array.isArray(result.required)) {
          result.required = result.required.filter((field: any) => field in result.properties)
        }

        if (result.type === "array") {
          if (result.items == null) {
            result.items = {}
          }
          // Ensure items has at least a type if it's an empty object
          // This handles nested arrays like { type: "array", items: { type: "array", items: {} } }
          if (typeof result.items === "object" && !Array.isArray(result.items) && !result.items.type) {
            result.items.type = "string"
          }
        }

        // Remove properties/required from non-object types (Gemini rejects these)
        if (result.type && result.type !== "object") {
          delete result.properties
          delete result.required
        }

        return result
      }

      schema = sanitizeGemini(schema)
    }

    // OpenAI Responses and Gemini require tool parameters to be a root object.
    // A discriminated union therefore becomes one provider-facing superset
    // while the original Zod union remains the execution validator. Repeated
    // properties are joined by their actual value domains rather than using
    // whichever branch happened to be listed first.
    schema = flattenRootObjectUnionSchema(schema) as JSONSchema7

    if (requiresOpenAIStrictToolSchema(model)) {
      return normalizeOpenAIStrictToolSchema(schema as JSONSchema7) as JSONSchema7
    }

    return schema as JSONSchema7
  }

  function normalizeOpenAIStrictToolSchema(schema: JSONSchema7): JSONSchema7 {
    return strictifyOpenAISchemaNode(schema, false) as JSONSchema7
  }

  function strictifyOpenAISchemaNode(node: unknown, optionalFromParent: boolean): unknown {
    if (Array.isArray(node)) return node.map((item) => strictifyOpenAISchemaNode(item, false))
    if (!node || typeof node !== "object") return node

    const input = node as Record<string, unknown>
    const output: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
        continue
      }
      output[key] = strictifyOpenAISchemaNode(value, false)
    }

    const properties = input.properties
    if (properties && typeof properties === "object" && !Array.isArray(properties)) {
      const required = new Set(
        Array.isArray(input.required) ? input.required.filter((item) => typeof item === "string") : [],
      )
      const strictProperties: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
        const strictValue = strictifyOpenAISchemaNode(value, !required.has(key))
        strictProperties[key] =
          !required.has(key) && !schemaAllowsNull(strictValue) ? nullableOpenAISchema(strictValue) : strictValue
      }
      output.properties = strictProperties
      output.required = Object.keys(strictProperties)
      if (output.additionalProperties === undefined) output.additionalProperties = false
    }

    return optionalFromParent && !schemaAllowsNull(output) ? nullableOpenAISchema(output) : output
  }

  function schemaAllowsNull(schema: unknown): boolean {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return false
    const record = schema as Record<string, unknown>
    if (record.type === "null") return true
    if (Array.isArray(record.type) && record.type.includes("null")) return true
    return (
      (Array.isArray(record.anyOf) && record.anyOf.some(schemaAllowsNull)) ||
      (Array.isArray(record.oneOf) && record.oneOf.some(schemaAllowsNull))
    )
  }

  function nullableOpenAISchema(schema: unknown): unknown {
    return { anyOf: [schema, { type: "null" }] }
  }
}
