import { expect, test } from "bun:test"
import path from "node:path"

// Transport fault injection complements the real server/provider checker.
// These cases validate client ownership and deliberately do not claim model E2E.
for (const scenario of [
  "session-stall",
  "permission-stall",
  "stream-closed",
  "reply-stall",
  "tool-progress",
  "old-occurrence",
  "human-error",
] as const) {
  test(`run transport: ${scenario}`, async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined
    const sessionID = "ses_check"
    const emit = (type: string, properties: unknown) =>
      controller?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type, properties })}\n\n`))
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const url = new URL(request.url)
        if (url.pathname === "/session" && request.method === "POST") {
          if (scenario === "session-stall") await Bun.sleep(2500)
          return Response.json({ id: sessionID })
        }
        if (url.pathname === "/permission") {
          if (scenario === "permission-stall") await Bun.sleep(2500)
          return Response.json([])
        }
        if (url.pathname === "/event")
          return new Response(
            new ReadableStream({
              start(stream) {
                controller = stream
                emit("server.connected", {})
              },
              cancel() {
                controller = undefined
              },
            }),
            { headers: { "content-type": "text/event-stream" } },
          )
        if (url.pathname === `/session/${sessionID}/message`) {
          const body = (await request.json()) as { messageID: string }
          if (scenario === "stream-closed") {
            controller?.close()
            controller = undefined
            await Bun.sleep(100)
          } else {
            emit("agent.execution.lifecycle", {
              sessionID,
              inputMessageID: "msg_previous",
              status: { type: "terminal", reason: "error" },
            })
            // Session errors do not identify an input occurrence. The response
            // to the exact submitted request is the failure authority.
            emit("session.error", { sessionID, error: { name: "OldError", data: { message: "previous occurrence" } } })
            for (let index = 0; index < (scenario === "tool-progress" ? 8 : 1); index++) {
              emit("message.part.updated", {
                part: { id: "part_tool", sessionID, type: "tool", state: { status: "running" } },
              })
              await Bun.sleep(300)
            }
            emit("message.part.updated", {
              part: { id: "part_text", sessionID, type: "text", text: "current reply", time: { start: 1, end: 2 } },
            })
            emit("agent.execution.lifecycle", { sessionID, inputMessageID: body.messageID, status: { type: "idle" } })
            if (scenario === "reply-stall") await Bun.sleep(2500)
          }
          return Response.json({
            info: {
              role: "assistant",
              parentID: body.messageID,
              ...(scenario === "human-error"
                ? { error: { name: "APIError", data: { message: "Provider returned HTTP 401" } } }
                : {}),
            },
            parts: [],
          })
        }
        return Response.json({ name: "UnexpectedRoute", data: { message: url.pathname } }, { status: 400 })
      },
    })
    const child = Bun.spawn(
      [
        process.execPath,
        path.resolve(import.meta.dir, "../../src/index.ts"),
        "run",
        "hello",
        "--attach",
        server.url.origin,
        "--agent",
        "chat",
        "--format",
        scenario === "human-error" ? "default" : "json",
      ],
      {
        env: { ...process.env, OPENCORVUS_RUN_STALL_TIMEOUT_MS: "1000" },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const timer = setTimeout(() => child.kill(), 15000)
    try {
      const [exit, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      if (scenario === "human-error") {
        expect(exit).toBe(1)
        expect(stderr).toContain("Provider returned HTTP 401")
        return
      }
      const events = stdout
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line))
      if (
        scenario === "session-stall" ||
        scenario === "permission-stall" ||
        scenario === "stream-closed" ||
        scenario === "reply-stall"
      ) {
        expect(exit, stderr).toBe(1)
        const errors = events.filter((event) => event.type === "error")
        expect(errors.length).toBe(1)
        if (scenario === "session-stall") expect(errors[0].error.name).toBe("TimeoutError")
        else if (scenario === "permission-stall" || scenario === "reply-stall")
          expect(errors[0].error.name).toBe("event_stream_stalled")
        else expect(errors[0].error.data.message).toBe("Event stream ended before the run settled")
      } else {
        expect(exit, stderr).toBe(0)
        expect(events.map((event) => ({ type: event.type, text: event.part.text }))).toEqual([
          { type: "text", text: "current reply" },
        ])
      }
    } finally {
      clearTimeout(timer)
      if (child.exitCode === null) {
        child.kill()
        await child.exited
      }
      await server.stop(true)
    }
  }, 20000)
}
