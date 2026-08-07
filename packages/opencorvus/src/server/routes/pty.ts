// Project-bound Pseudo Terminal route surface.
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Pty } from "@/pty"
import { NotFoundError } from "../../storage/db"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { createSerializedSSEWriter, streamGlobalSSE, type SerializedSSEStream } from "../sse"
import { Log } from "../../util/log"
import { PtyOutputStreamEvent } from "@opencorvus-ai/transport-protocol"

const log = Log.create({ service: "server.pty" })

type PtyOutputStream = SerializedSSEStream & {
  onAbort(listener: () => void): void
}

export async function streamPtyOutput(
  stream: PtyOutputStream,
  preparedConnection: ReturnType<typeof Pty.prepareConnect>,
) {
  let closed = false
  let closing = false
  let handler: ReturnType<typeof preparedConnection.attach> | undefined
  let finish!: () => void
  const finished = new Promise<void>((resolve) => {
    finish = resolve
  })
  const cleanup = (error?: unknown) => {
    if (closed) return
    closed = true
    writer.stop()
    try {
      handler?.onClose()
    } catch (cause) {
      log.warn("PTY output stream cleanup failed", {
        error: cause instanceof Error ? cause.message : String(cause),
      })
    } finally {
      if (error) {
        log.warn("PTY output stream write failed", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
      finish()
    }
  }
  const writer = createSerializedSSEWriter(stream, (error) => cleanup(error))
  const write = (event: PtyOutputStreamEvent) => writer.write(JSON.stringify(event))
  const close = (code?: number, reason?: string) => {
    if (closed || closing) return
    closing = true
    const exit = write({ type: "exit", code: code ?? 1000, reason: reason ?? "PTY stream closed" })
    writer.stop()
    void exit.then(() => cleanup())
  }

  handler = preparedConnection.attach({
    send: (chunk) => {
      if (closing || closed) return
      if (typeof chunk === "string") {
        void write({ type: "data", data: chunk })
        return
      }
      const bytes = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : chunk
      if (bytes[0] !== 0) return
      const meta = JSON.parse(new TextDecoder().decode(bytes.slice(1))) as { cursor: number }
      void write({ type: "cursor", cursor: meta.cursor })
    },
    close,
  })
  stream.onAbort(() => cleanup())
  await finished
  await writer.idle()
}

export const PtyRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List PTY sessions",
        description: "Get active Pseudo Terminal (PTY) sessions managed by OpenCorvus.",
        operationId: "pty.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Pty.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => c.json(Pty.list()),
    )
    .post(
      "/",
      describeRoute({
        summary: "Create PTY session",
        description: "Create a project-bound Pseudo Terminal (PTY) session from a configured terminal profile.",
        operationId: "pty.create",
        responses: {
          200: {
            description: "Created session",
            content: {
              "application/json": {
                schema: resolver(Pty.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Pty.CreateInput),
      async (c) => {
        try {
          return c.json(await Pty.create(c.req.valid("json")))
        } catch (error) {
          if (error instanceof Error && error.message === "PTY cwd must match current project directory") {
            throw new HTTPException(400, { message: error.message })
          }
          if (error instanceof Pty.CreateFailedError) {
            throw new HTTPException(400, { message: error.data.message })
          }
          throw error
        }
      },
    )
    .get(
      "/:ptyID",
      describeRoute({
        summary: "Get PTY session",
        description: "Retrieve a specific Pseudo Terminal (PTY) session.",
        operationId: "pty.get",
        responses: {
          200: {
            description: "Session info",
            content: {
              "application/json": {
                schema: resolver(Pty.Info),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      async (c) => {
        const info = Pty.get(c.req.valid("param").ptyID)
        if (!info) throw new NotFoundError({ message: "PTY session not found" })
        return c.json(info)
      },
    )
    .put(
      "/:ptyID",
      describeRoute({
        summary: "Update PTY session",
        description: "Update title or size for a Pseudo Terminal (PTY) session.",
        operationId: "pty.update",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Pty.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      validator("json", Pty.UpdateInput),
      async (c) => {
        const info = await Pty.update(c.req.valid("param").ptyID, c.req.valid("json"))
        if (!info) throw new NotFoundError({ message: "PTY session not found" })
        return c.json(info)
      },
    )
    .delete(
      "/:ptyID",
      describeRoute({
        summary: "Remove PTY session",
        description: "Remove and terminate a Pseudo Terminal (PTY) session.",
        operationId: "pty.remove",
        responses: {
          200: {
            description: "Session removed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      async (c) => {
        const id = c.req.valid("param").ptyID
        if (!Pty.get(id)) throw new NotFoundError({ message: "PTY session not found" })
        await Pty.remove(id)
        return c.json(true)
      },
    )
    .get(
      "/:ptyID/output",
      describeRoute({
        summary: "Stream PTY output",
        description: "Stream buffered and live Pseudo Terminal (PTY) output through Server-Sent Events (SSE).",
        operationId: "pty.output",
        responses: {
          200: {
            description: "PTY output stream",
            content: {
              "text/event-stream": {
                schema: resolver(PtyOutputStreamEvent),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      validator("query", z.object({ cursor: z.coerce.number().int().min(-1).optional() })),
      async (c) => {
        const id = c.req.valid("param").ptyID
        if (!Pty.get(id)) throw new NotFoundError({ message: "PTY session not found" })
        const preparedConnection = Pty.prepareConnect(id, c.req.valid("query").cursor)
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamGlobalSSE(c, async (stream) => {
          await streamPtyOutput(stream, preparedConnection)
        })
      },
    )
    .post(
      "/:ptyID/input",
      describeRoute({
        summary: "Write PTY input",
        description: "Write user input to a running Pseudo Terminal (PTY) session.",
        operationId: "pty.input",
        responses: {
          200: {
            description: "Input accepted",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      validator("json", Pty.Input),
      async (c) => {
        const id = c.req.valid("param").ptyID
        const accepted = Pty.input(id, c.req.valid("json").data)
        if (!accepted) throw new NotFoundError({ message: "PTY session not found" })
        return c.json(true)
      },
    ),
)
