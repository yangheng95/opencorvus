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
export function startControlledStreamingProvider(options?: { failPromptFrom?: number }) {
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
      const kind = messages.some(
        (message: any) =>
          message?.role === "system" &&
          typeof message.content === "string" &&
          message.content.includes("dedicated Memory Organizer"),
      )
        ? ("memory" as const)
        : ("prompt" as const)
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
      const memoryInstruction = messages.find((message: any) => message?.role === "user")?.content
      const coveredOccurrenceIDs =
        typeof memoryInstruction === "string"
          ? JSON.parse(memoryInstruction.match(/coveredOccurrenceIDs must be exactly (\[[^\n]+\])/u)?.[1] ?? "[]")
          : []
      const content =
        kind === "memory"
          ? JSON.stringify({ baseRevision: 0, coveredOccurrenceIDs, disposition: "organized", markdown: "" })
          : `provider reply ${requests.filter((candidate) => candidate.kind === "prompt").length}`
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
          choices: [{ index: 0, delta: { content }, finish_reason: null }],
        },
        {
          id,
          object: "chat.completion.chunk",
          created,
          model: "session-prompt-owner-model",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
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
