import { Provider } from "@/provider/provider"
import { ProviderLLM } from "@/provider/llm"
import { Log } from "@/util/log"
import { Bus } from "@/bus"
import type { ModelMessage, StopCondition, Tool, ToolSet } from "ai"
// Use the wrapped streamText from @/llm/api — its Proxy returns
// `abortableIterable(fullStream, composed)`, which is the only thing that
// rescues a Bun-fetch-backed reader.read() from parking forever when the
// LLM-activity gate fires its abort signal. Importing the raw "ai" form
// bypassed the Proxy and silently parked sub-agents (architect, requirements,
// build) for 14–25 min during alibaba-coding-plan-cn streams (audit §12,
// 2026-04-30 r5/r6/r7 bench evidence). Rule 8 — single source.
import { streamText } from "@/llm/api"
import type { TextHooks } from "@/llm/api"
import { mergeDeep, pipe } from "remeda"
import { ProviderTransform } from "@/provider/transform"
import { EffectiveConfig } from "@/config/effective"
import type { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { withObservableWorkNarrative } from "@/prompt/fragments/observable-work-narrative"
import { Message } from "./message"
import { SessionEvents } from "./events"
import { sessionLifecycleOrderKey } from "./status"
import { Plugin } from "@/plugin"
import { SystemPrompt } from "./system"
import { Flag } from "@/flag/flag"
import { CapabilityRules } from "@/capability/rules"
import { Auth } from "@/auth"
import { AgentTrace } from "@/trace"
import { sessionParentID, taskIDForSession } from "@/engine/task-session-lineage"

export namespace LLM {
  const log = Log.create({ service: "llm" })
  export const OUTPUT_TOKEN_MAX = ProviderTransform.OUTPUT_TOKEN_MAX

  export type StreamInput = {
    /** Real transcript user message when this stream belongs to a conversation turn. */
    user?: Message.User
    /** Real non-message occurrence identity for an internal, tool-free participant request. */
    requestID?: string
    sessionID: string
    /** Reuse an already-resolved effective snapshot for one coherent internal attempt. */
    config?: Config.Info
    model: Provider.Model
    agentID: string
    agent: SessionAgentRuntime
    system: string[]
    abort: AbortSignal
    messages: ModelMessage[]
    small?: boolean
    tools: Record<string, Tool>
    retries?: number
    stopWhen?: StopCondition<ToolSet> | Array<StopCondition<ToolSet>>
    /**
     * Optional provider-level tool selection passed through to streamText.
     * Session completion never pins or requires a terminal tool; a selected
     * tool is only an explicit caller preference for that provider turn.
     */
    toolChoice?: "auto" | "required" | "none" | { type: "tool"; toolName: string }
    stream?: TextHooks
    runtimeSystemMode?: "complete"
  }

  export type StreamOutput = ReturnType<typeof streamText<ToolSet>>

  export type StreamResult = ReturnType<typeof streamText<ToolSet>>

  export function telemetryConfig(input: {
    enabled: boolean | undefined
    username: string | undefined
    sessionID: string
  }) {
    return {
      isEnabled: input.enabled,
      recordInputs: false,
      recordOutputs: false,
      metadata: {
        userId: input.username ?? "unknown",
        sessionId: input.sessionID,
      },
    }
  }

  export async function composeSystem(input: {
    agentID: string
    agent: SessionAgentRuntime
    model: Provider.Model
    system: string[]
    user?: Message.User
    sessionID?: string
    runtimeSystemMode?: "complete"
  }) {
    const agent = input.agent
    const completeSystemMode = input.runtimeSystemMode === "complete"
    const providerPrompt = completeSystemMode
      ? []
      : agent.prompt
        ? [[agent.prompt, agent.promptAppend].filter(Boolean).join("\n")]
        : await SystemPrompt.provider(input.model, { sessionID: input.sessionID })
    const composed = [
      // use agent prompt otherwise provider prompt, unless caller supplied
      // a complete system prompt for this turn
      ...providerPrompt,
      // any custom prompt passed into this call
      ...input.system,
    ]
      .filter((x) => x)
      .join("\n")
    return [
      !completeSystemMode && PrimaryAssistantRegistry.isID(input.agentID)
        ? withObservableWorkNarrative(composed)
        : composed,
    ]
  }

  export async function stream(input: StreamInput): Promise<StreamResult> {
    const requestID = input.user?.id ?? input.requestID
    if (!requestID) throw new Error("LLM.stream requires a real user Message or request occurrence identity")
    const config = input.config ?? (await EffectiveConfig.effective({ sessionID: input.sessionID }))
    const agent = input.agent
    const l = log
      .clone()
      .tag("providerID", input.model.providerID)
      .tag("modelID", input.model.id)
      .tag("sessionID", input.sessionID)
      .tag("small", (input.small ?? false).toString())
      .tag("agent", input.agentID)
    l.info("stream", {
      modelID: input.model.id,
      providerID: input.model.providerID,
    })
    const [language, cfg, provider, auth] = await Promise.all([
      Provider.getLanguage(input.model, { config }),
      Promise.resolve(config),
      Provider.getProvider(input.model.providerID, { config }),
      Auth.get(input.model.providerID),
    ])
    const isOpenaiOauth = provider.id === "openai" && auth?.type === "oauth"

    const system = await composeSystem({ ...input, agent, sessionID: input.sessionID })
    system[0] = [system[0], SystemPrompt.requestLanguage()].filter(Boolean).join("\n\n")

    const header = system[0]
    await Plugin.trigger(
      "experimental.chat.system.transform",
      { sessionID: input.sessionID, model: input.model },
      { system },
    )
    // rejoin to maintain 2-part structure for caching if header unchanged
    if (system.length > 2 && system[0] === header) {
      const rest = system.slice(1)
      system.length = 0
      system.push(header, rest.join("\n"))
    }

    const variant =
      !input.small && input.model.variants && input.user?.variant ? input.model.variants[input.user.variant] : {}
    const base = input.small
      ? ProviderTransform.smallOptions(input.model)
      : ProviderTransform.options({
          model: input.model,
          sessionID: input.sessionID,
          providerOptions: provider.options,
        })
    const options: Record<string, any> = pipe(
      base,
      mergeDeep(input.model.options),
      mergeDeep(agent.options),
      mergeDeep(variant),
    )
    if (isOpenaiOauth) {
      options.instructions = system.join("\n")
    }

    const maxOutputTokens = ProviderTransform.maxOutputTokens(input.model)
    const baseParams = {
      temperature: input.model.capabilities.temperature
        ? (agent.temperature ?? ProviderTransform.temperature(input.model))
        : undefined,
      topP: agent.topP ?? ProviderTransform.topP(input.model),
      topK: ProviderTransform.topK(input.model),
      maxOutputTokens,
      options,
    }
    const params = input.user
      ? await Plugin.trigger(
          "chat.params",
          { sessionID: input.sessionID, agent, model: input.model, provider, message: input.user },
          baseParams,
        )
      : baseParams

    const headers = input.user
      ? (
          await Plugin.trigger(
            "chat.headers",
            { sessionID: input.sessionID, agent, model: input.model, provider, message: input.user },
            { headers: {} },
          )
        ).headers
      : {}

    const tools = await resolveTools({ ...input, agent })
    const toolChoice = input.toolChoice
    const providerOptions = ProviderTransform.providerOptions(
      input.model,
      ProviderTransform.optionsForToolChoice(input.model, params.options, toolChoice),
    )
    const requestHeaders = {
      ...(input.model.providerID.startsWith("opencorvus")
        ? {
            "x-opencorvus-project": Instance.project.id,
            "x-opencorvus-session": input.sessionID,
            "x-opencorvus-request": requestID,
            "x-opencorvus-client": Flag.OPENCORVUS_CLIENT,
          }
        : ProviderLLM.baseHeaders(input.model, input.sessionID)),
      ...headers,
    }
    const systemText = system.join("\n")
    const requestMessages = input.messages

    if (AgentTrace.isEnabled()) {
      const parentSessionID = sessionParentID(input.sessionID)
      const taskID = taskIDForSession(input.sessionID)
      if (taskID) {
        AgentTrace.recordLLMRequest({
          sessionID: input.sessionID,
          parentSessionID,
          taskID,
          agentName: input.agentID,
          agentMode: "runtime",
          model: { providerID: input.model.providerID, modelID: input.model.id },
          small: input.small,
          toolChoice,
          requestMessageID: requestID,
          tools: Object.keys(tools),
        })
      }
    }

    const result = streamText({
      onError(event) {
        void input.stream?.onError?.(event)
        const error = Message.fromError(event.error, { providerID: input.model.providerID })
        Bus.publishOwned(SessionEvents.Error, {
          sessionID: input.sessionID,
          orderKey: sessionLifecycleOrderKey(input.sessionID),
          error,
        })
        l.error("stream error", {
          error,
        })
      },
      // Tool-call repair (name-normalization + discriminated-union legal-value
      // enumeration) is installed once at the `@/llm/api` streamText wrapper —
      // single source for every caller (see llm/repair-hint.ts
      // createToolCallRepair). Do not re-add a per-call repair here.
      temperature: params.temperature,
      topP: params.topP,
      topK: params.topK,
      providerOptions,
      activeTools: Object.keys(tools),
      tools,
      toolChoice,
      ...(isOpenaiOauth ? {} : { system: systemText }),
      maxOutputTokens: params.maxOutputTokens,
      abortSignal: input.abort,
      // Disable the wrapper's 5 s default soft timeout — the LLM-activity
      // gate (`withLLMActivity` in session/processor.ts) is the canonical
      // idle/timeout authority and composes its own abort signal into
      // `input.abort`. A second timeout here would race it.
      timeoutMs: false,
      usagePurpose: "session",
      headers: requestHeaders,
      maxRetries: input.retries ?? 0,
      stopWhen: input.stopWhen,
      messages: requestMessages,
      model: ProviderLLM.wrapModel(language, input.model, options),
      experimental_telemetry: telemetryConfig({
        enabled: cfg.experimental?.openTelemetry,
        username: cfg.username,
        sessionID: input.sessionID,
      }),
    })
    return result
  }

  async function resolveTools(input: Pick<StreamInput, "tools" | "agent" | "user">) {
    const disabled = CapabilityRules.disabled(Object.keys(input.tools), input.agent.permission)
    for (const tool of Object.keys(input.tools)) {
      if (input.user?.tools?.[tool] === false || disabled.has(tool)) {
        delete input.tools[tool]
      }
    }
    return input.tools
  }
}
