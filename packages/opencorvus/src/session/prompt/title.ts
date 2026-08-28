import { Session } from ".."
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { Message } from "../message"
import { LLM } from "../llm"
import { resolveAgentModel } from "@/agent/model"
import { Log } from "../../util/log"
import { EffectiveConfig } from "@/config/effective"
import { collectLLMText } from "@/llm/activity"

const log = Log.create({ service: "session.prompt" })

export async function ensureTitle(input: { session: Session.Info; history: Message.WithParts[]; abort: AbortSignal }) {
  if (input.session.parentID) return
  if (!Session.isDefaultTitle(input.session.title)) return

  const firstRealUserIdx = input.history.findIndex((m) => m.info.role === "user")
  if (firstRealUserIdx === -1) return

  const isFirst = input.history.filter((m) => m.info.role === "user").length === 1
  if (!isFirst) return

  // Gather all messages up to and including the first real user message for context.
  const contextMessages = input.history.slice(0, firstRealUserIdx + 1)
  const firstRealUser = contextMessages[firstRealUserIdx]

  const config = await EffectiveConfig.effective({ sessionID: input.session.id })
  const agent = await HelperAgentRegistry.get("title", { config })
  const model = await resolveAgentModel("title", { sessionID: input.session.id })
  const messages = [
    {
      role: "user" as const,
      content: "Generate a title for this conversation:\n",
    },
    ...(await Message.toModelMessages(contextMessages, model)),
  ]
  const text = await collectLLMText({
    context: { sessionID: input.session.id, provider: model.providerID, model: model.id },
    external: input.abort,
    start: (run) =>
      LLM.stream({
        agentID: agent.name,
        agent: sessionRuntimeFromNativeAgent(agent),
        user: firstRealUser.info as Message.User,
        system: [],
        small: true,
        tools: {},
        model,
        abort: run.signal,
        sessionID: input.session.id,
        retries: 0,
        messages,
      }),
  }).catch((err) => log.error("failed to generate title", { error: err }))
  if (text) {
    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0)
    if (!cleaned) return

    const title = cleaned.length > 100 ? cleaned.substring(0, 97) + "..." : cleaned
    return Session.setTitle({ sessionID: input.session.id, title })
  }
}
