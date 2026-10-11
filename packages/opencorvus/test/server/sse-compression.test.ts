import { expect, test } from "bun:test"
import { Hono } from "hono"
import http from "node:http"
import { createGunzip, gunzipSync } from "node:zlib"
import { streamGlobalSSE } from "@/server/sse"
import { Server } from "@/server/server"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

function within<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} did not settle`)), 3_000)
    }),
  ]).finally(() => clearTimeout(timer))
}

function rawResponse(url: URL, encoding?: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers: encoding === undefined ? {} : { "accept-encoding": encoding } }, resolve)
    request.on("error", reject)
    request.setTimeout(3_000, () => request.destroy(new Error("Owned SSE HTTP inactivity")))
  })
}

async function bytes(response: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of response) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

for (const [header, expected] of [
  [undefined, "identity"],
  ["", "identity"],
  ["gzip", "gzip"],
  ["GZIP", "gzip"],
  ["GZIP;Q=0", "identity"],
  ["gzip;q=0", "identity"],
  ["*;q=0.5", "gzip"],
  ["gzip;q=0, *;q=1", "identity"],
  ["gzip;q=0.4, identity;q=0.8", "identity"],
  ["identity;q=0, gzip;q=0.3", "gzip"],
  ["br", "identity"],
] as const) {
  test(`SSE negotiates ${JSON.stringify(header)} as ${expected} over actual HTTP`, async () => {
    const app = new Hono().get("/events", (c) => {
      c.header("Vary", "Origin")
      return streamGlobalSSE(c, async (stream) => {
        await stream.writeSSE({ id: "1", data: "中文 🌐\nnext" })
        await stream.writeSSE({ data: "" })
      })
    })
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
    try {
      const response = await rawResponse(new URL("/events", server.url), header)
      const wire = await bytes(response)
      expect(response.statusCode).toBe(200)
      expect(response.headers["content-encoding"] ?? "identity").toBe(expected)
      expect(response.headers.vary).toBe("Origin, Accept-Encoding")
      expect((expected === "gzip" ? gunzipSync(wire) : wire).toString()).toBe(
        "data: 中文 🌐\ndata: next\nid: 1\n\ndata: \n\n",
      )
    } finally {
      await server.stop(true)
    }
  })
}

test("an excluded identity and gzip has the explicit HTTP 406 contract", async () => {
  const app = new Hono().get("/events", (c) =>
    streamGlobalSSE(c, async (stream) => {
      await stream.writeSSE({ data: "accepted" })
    }),
  )
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
  try {
    const response = await rawResponse(new URL("/events", server.url), "gzip;q=0, identity;q=0, *;q=0")
    expect({ status: response.statusCode, body: (await bytes(response)).toString() }).toEqual({
      status: 406,
      body: "SSE requires an acceptable gzip or identity content encoding",
    })
  } finally {
    await server.stop(true)
  }
})

test("a producer failure keeps the exact SSE error frame and closes a complete gzip response", async () => {
  const failures: string[] = []
  const app = new Hono().get("/events", (c) =>
    streamGlobalSSE(
      c,
      async (stream) => {
        await stream.writeSSE({ data: "accepted prefix" })
        throw new Error("owned producer failure")
      },
      async (error) => {
        failures.push(error.message)
      },
    ),
  )
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
  try {
    const response = await rawResponse(new URL("/events", server.url), "gzip")
    expect(gunzipSync(await bytes(response)).toString()).toBe(
      "data: accepted prefix\n\nevent: error\ndata: owned producer failure\n\n",
    )
    expect(failures).toEqual(["owned producer failure"])
  } finally {
    await server.stop(true)
  }
})

test("gzip delivers a complete first frame before the producer releases its next frame", async () => {
  const release = Promise.withResolvers<void>()
  const first = Promise.withResolvers<string>()
  const app = new Hono().get("/events", (c) =>
    streamGlobalSSE(c, async (stream) => {
      await stream.writeSSE({ data: "first 中文 🌐" })
      await release.promise
      await stream.writeSSE({ data: "last" })
    }),
  )
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
  let response: http.IncomingMessage | undefined
  const decoder = createGunzip()
  let decoded = ""
  decoder.on("data", (chunk) => {
    decoded += chunk.toString()
    if (decoded.endsWith("\n\n")) first.resolve(decoded)
  })
  const ended = new Promise<void>((resolve, reject) => {
    decoder.on("end", resolve)
    decoder.on("error", reject)
  })
  try {
    response = await rawResponse(new URL("/events", server.url), "gzip")
    response.pipe(decoder)
    expect(await within(first.promise, "First decoded SSE frame")).toBe("data: first 中文 🌐\n\n")
    release.resolve()
    await within(ended, "Natural gzip trailer")
    expect(decoded).toBe("data: first 中文 🌐\n\ndata: last\n\n")
  } finally {
    release.resolve()
    response?.destroy()
    decoder.destroy()
    await server.stop(true)
  }
})

test("concurrent compressed streams retain independent complete events and reduce repeated field bytes", async () => {
  const body = "独立项目的完整流式字段 🌐 ".repeat(100)
  const app = new Hono().get("/:project/events", (c) =>
    streamGlobalSSE(c, async (stream) => {
      for (let i = 1; i <= 100; i++)
        await stream.writeSSE({ data: JSON.stringify({ project: c.req.param("project"), value: body + i }) })
    }),
  )
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
  try {
    const observed = await Promise.all(
      ["alpha", "beta"].map(async (project) => {
        const response = await rawResponse(new URL(`/${project}/events`, server.url), "gzip")
        const wire = await bytes(response)
        const plain = gunzipSync(wire).toString()
        const expected = Array.from(
          { length: 100 },
          (_, index) => `data: ${JSON.stringify({ project, value: body + (index + 1) })}\n\n`,
        ).join("")
        expect(plain).toBe(expected)
        expect(wire.length / Buffer.byteLength(expected)).toBeLessThan(0.1)
        return { project, frames: plain.split("\n\n").length - 1 }
      }),
    )
    expect(observed).toEqual([
      { project: "alpha", frames: 100 },
      { project: "beta", frames: 100 },
    ])
  } finally {
    await server.stop(true)
  }
})

test("consumer cancellation retires the exact compressed owner and a reconnect opens a fresh stream", async () => {
  const cancelled = [Promise.withResolvers<number>(), Promise.withResolvers<number>()]
  let occurrence = 0
  const app = new Hono().get("/events", (c) =>
    streamGlobalSSE(c, async (stream) => {
      const current = occurrence++
      const closed = Promise.withResolvers<void>()
      stream.onAbort(() => {
        cancelled[current]!.resolve(current)
        closed.resolve()
      })
      await stream.writeSSE({ data: `occurrence ${current}` })
      await closed.promise
    }),
  )
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
  try {
    for (const current of [0, 1]) {
      const abort = new AbortController()
      const timer = setTimeout(() => abort.abort(), 3_000)
      try {
        const response = await fetch(new URL("/events", server.url), {
          headers: { "accept-encoding": "gzip" },
          signal: abort.signal,
        })
        const reader = response.body!.getReader()
        expect(new TextDecoder().decode((await reader.read()).value)).toBe(`data: occurrence ${current}\n\n`)
        await reader.cancel()
        reader.releaseLock()
        expect(await within(cancelled[current]!.promise, "Exact compressed stream cancellation")).toBe(current)
      } finally {
        clearTimeout(timer)
        abort.abort()
      }
    }
  } finally {
    await server.stop(true)
  }
})

test("public Session gzip streams hydrate exact project history and reconnect through the real server", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  const owners = []
  for (const [index, project] of [first, second].entries()) {
    const sessionID = await Instance.provideProjectIdentity({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: `Compressed history ${index}` })
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "chat",
          model: { providerID: "test", modelID: "test" },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: message.id,
          type: "text",
          text: `Project ${index} 中文 🌐`,
        })
        return session.id
      },
    })
    owners.push({ sessionID, directory: project.path, text: `Project ${index} 中文 🌐` })
  }
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: Server.App().fetch })
  const read = async (owner: (typeof owners)[number]) => {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 3_000)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const response = await fetch(new URL(`/session/${owner.sessionID}/events`, server.url), {
        headers: { "accept-encoding": "gzip", "x-opencorvus-directory": owner.directory },
        signal: abort.signal,
      })
      expect(response.headers.get("content-encoding")).toBe("gzip")
      reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let pending = ""
      while (!pending.includes("\n\n")) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error("Public Session stream ended before its connection snapshot")
        pending += decoder.decode(chunk.value, { stream: true }).replaceAll("\r\n", "\n")
      }
      const event = JSON.parse(
        pending
          .split("\n\n")[0]!
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n"),
      )
      expect(event.type).toBe("session.connected")
      const message = event.payload.conversationSnapshot.transcript[0]
      return { sessionID: message.info.sessionID, text: message.parts.find((part: any) => part.type === "text").text }
    } finally {
      clearTimeout(timer)
      try {
        await reader?.cancel()
      } finally {
        reader?.releaseLock()
        abort.abort()
      }
    }
  }
  try {
    expect(await Promise.all(owners.map(read))).toEqual(owners.map(({ sessionID, text }) => ({ sessionID, text })))
    expect(await read(owners[0]!)).toEqual({ sessionID: owners[0]!.sessionID, text: owners[0]!.text })
  } finally {
    await server.stop(true)
    Server.resetProjectRoutesAppForTest()
    await Instance.disposeAll()
    await resetMemoryDatabase()
  }
}, 30_000)
