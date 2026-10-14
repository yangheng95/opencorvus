import MEMORY_PROMPT from "../../src/agent/prompt/memory.txt"
import { SystemPrompt } from "../../src/session/system"
import fs from "node:fs/promises"
import path from "node:path"

// These fixtures use the default helper. Its entire physical system prompt is
// authoritative; ordinary agent guidance also mentions the Memory Organizer.
const memorySystemPrompt = [MEMORY_PROMPT, SystemPrompt.requestLanguage()].join("\n\n")

export function controlledProviderRequestKind(messages: Array<{ role?: string; content?: unknown }>) {
  return messages.some((message) => message.role === "system" && message.content === memorySystemPrompt)
    ? ("memory" as const)
    : ("prompt" as const)
}

/** Reply to the current organizer protocol using its actual ordered input.
 * This is controlled qualification data, not a model-authored memory claim. */
export function controlledMemoryReply(messages: Array<{ role?: string; content?: unknown }>) {
  const users = messages.filter((message) => message.role === "user")
  if (users.length !== 1 || typeof users[0]?.content !== "string")
    throw new Error("Controlled Memory requires one current organizer instruction")
  const sections = users[0].content.split("\n\nCURRENT PROJECT MEMORY.MD\n\n")
  if (sections.length !== 2) throw new Error("Controlled Memory requires the current document section")
  const document = sections[1]!.split("\n\nORDERED PENDING USER-INPUT EVIDENCE\n\n")
  if (document.length !== 2) throw new Error("Controlled Memory requires ordered input evidence")
  const lines = sections[0]!.split("\n")
  const revisions = lines.filter((line) => line.startsWith("baseRevision must be "))
  const coverages = lines.filter((line) => line.startsWith("coveredOccurrenceIDs must be exactly "))
  const revision = revisions.length === 1 ? /^baseRevision must be (\d+)\.$/u.exec(revisions[0]!) : null
  const coverage = coverages.length === 1
    ? /^coveredOccurrenceIDs must be exactly (.+)\.$/u.exec(coverages[0]!) : null
  if (!revision || !coverage) throw new Error("Controlled Memory requires exact revision and coverage directives")
  const baseRevision = Number(revision[1])
  const coveredOccurrenceIDs: unknown = JSON.parse(coverage[1]!)
  const evidence: unknown = JSON.parse(document[1]!)
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0 || !Array.isArray(coveredOccurrenceIDs)
    || coveredOccurrenceIDs.length === 0
    || !coveredOccurrenceIDs.every((id) => typeof id === "string" && id.length > 0)
    || !Array.isArray(evidence) || evidence.length !== coveredOccurrenceIDs.length
    || !evidence.every((item, index) => item?.occurrenceID === coveredOccurrenceIDs[index]))
    throw new Error("Controlled Memory revision or ordered evidence is invalid")
  const current = document[0] === "(empty)" ? "" : document[0]!
  const qualification = `Controlled Provider fixture: organized input occurrences ${JSON.stringify(coveredOccurrenceIDs)} at base revision ${baseRevision}.`
  return JSON.stringify({ baseRevision, coveredOccurrenceIDs, disposition: "organized",
    markdown: current ? `${current}\n\n${qualification}` : `# Controlled Provider memory\n\n${qualification}` })
}

/** Build the one explicit catalog from public bundled metadata after bootstrap. */
export async function writeControlledProviderCatalog(destination: string) {
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!processRoot || !path.isAbsolute(processRoot) || !path.isAbsolute(destination))
    throw new Error("Controlled catalog requires an owned test process root and absolute path")
  const descendant = (root: string, candidate: string) => {
    const relative = path.relative(root, candidate)
    return relative.length > 0 && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
  }
  if (!descendant(path.resolve(processRoot), path.resolve(destination)))
    throw new Error("Controlled catalog must belong to the original test process root")
  await fs.mkdir(path.dirname(destination), { recursive: true })
  const originalRoot = await fs.realpath(processRoot)
  const actualParent = await fs.realpath(path.dirname(destination))
  if (actualParent !== originalRoot && !descendant(originalRoot, actualParent))
    throw new Error("Controlled catalog parent escaped the original test process root")
  const { ModelsDev } = await import("../../src/provider/models")
  const source = path.resolve(import.meta.dir, "../../src/provider/models-bootstrap.json")
  const bundled = JSON.parse(await fs.readFile(source, "utf8"))
  const catalog = ModelsDev.validateExplicitCatalog(ModelsDev.withLocalProviders(bundled))
  await fs.writeFile(destination, `${JSON.stringify(catalog)}\n`, { flag: "wx", mode: 0o600 })
  return { source, destination, providerCount: Object.keys(catalog).length,
    modelCount: Object.values(catalog).reduce((count, provider) => count + Object.keys(provider.models).length, 0) }
}

export type ControlledProviderRequest = {
  index: number
  kind: "memory" | "prompt"
  body: unknown
  responded: Promise<void>
  release(): void
}

/** OpenAI-compatible streaming Provider whose physical replies are released by
 * the owning test. Memory requests settle immediately so they cannot become a
 * scheduling barrier or pollute Prompt request assertions. */
export function startControlledStreamingProvider(options?: {
  failPromptFrom?: number
  memoryModelID?: string
  firstPromptToolCall?: { name: string; arguments: Record<string, unknown> }
}) {
  const requests: ControlledProviderRequest[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 255,
    async fetch(request) {
      const body = await request.json().catch(() => undefined)
      const released = Promise.withResolvers<void>()
      const responded = Promise.withResolvers<void>()
      const index = requests.length
      const messages = Array.isArray((body as any)?.messages) ? (body as any).messages : []
      const kind = options?.memoryModelID
        ? (body as { model?: string })?.model === options.memoryModelID
          ? "memory"
          : "prompt"
        : controlledProviderRequestKind(messages)
      const promptOrdinal =
        kind === "prompt" ? requests.filter((candidate) => candidate.kind === "prompt").length + 1 : 0
      requests.push({ index, kind, body, responded: responded.promise, release: released.resolve })
      const injectedFailure =
        kind === "prompt" && options?.failPromptFrom !== undefined && promptOrdinal >= options.failPromptFrom
      if (kind === "memory" || injectedFailure) released.resolve()
      request.signal.addEventListener("abort", released.resolve, { once: true })
      await released.promise
      if (injectedFailure) {
        responded.resolve()
        return new Response(JSON.stringify({ error: { message: "injected compaction provider failure" } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
      }
      const id = `chatcmpl-session-owner-${index}`
      const created = Math.floor(Date.now() / 1000)
      const content =
        kind === "memory"
          ? controlledMemoryReply(messages)
          : `provider reply ${requests.filter((candidate) => candidate.kind === "prompt").length}`
      const toolCall = kind === "prompt" && promptOrdinal === 1 ? options?.firstPromptToolCall : undefined
      const chunks = [
        {
          id,
          object: "chat.completion.chunk",
          created,
          model: "session-prompt-owner-model",
          choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
        },
        {
          id,
          object: "chat.completion.chunk",
          created,
          model: "session-prompt-owner-model",
          choices: [{ index: 0, delta: toolCall ? { tool_calls: [{ index: 0, id: "call_controlled_recovery_next",
            type: "function", function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) } }] } : { content }, finish_reason: null }],
        },
        {
          id,
          object: "chat.completion.chunk",
          created,
          model: "session-prompt-owner-model",
          choices: [{ index: 0, delta: {}, finish_reason: toolCall ? "tool_calls" : "stop" }],
        },
      ]
      const payload = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`
      responded.resolve()
      return new Response(payload, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "close",
        },
      })
    },
  })
  return {
    server,
    requests,
    promptRequests: () => requests.filter((request) => request.kind === "prompt"),
    apiURL: `http://127.0.0.1:${server.port}/v1`,
  }
}
