import { expect, test } from "bun:test"
import {
  STREAM_INSTANCE_QUERY_KEY,
  STREAM_SOCKET_METHOD_HEADER,
  STREAM_SOCKET_PATH,
  STREAM_SOCKET_TARGET_HEADER,
} from "@opencorvus-ai/transport-protocol"
import { configure, getServerUrl } from "../src/services/api-state"
import type { StreamOpenRequest } from "../src/services/host-transport"
import { createTauriTransport } from "../src/services/tauri-transport"

const configuredDirectory = "C:/owned fixture/configured"
const selectedDirectory = "C:/owned fixture/selected"
const prefix = "/team/ui/edge"
const message = { content: "Owned stream request" }

const cases: { name: string; basePath: string; input: StreamOpenRequest; pathname: string; query: object }[] = [
  {
    name: "root work ledger",
    basePath: "",
    input: { path: "work-ledger/events" },
    pathname: "/work-ledger/events",
    query: {},
  },
  {
    name: "prefixed work ledger",
    basePath: prefix,
    input: { path: "work-ledger/events" },
    pathname: "/work-ledger/events",
    query: {},
  },
  {
    name: "prefixed selected task replay",
    basePath: prefix,
    input: { path: "task/tsk_example/events?after=17", query: { after: 23, directory: selectedDirectory } },
    pathname: "/task/tsk_example/events",
    query: { after: "23", directory: selectedDirectory },
  },
  {
    name: "prefixed project POST with the configured directory",
    basePath: prefix,
    input: { path: "panel/message/stream", method: "POST", body: { kind: "json", value: message } },
    pathname: "/panel/message/stream",
    query: { directory: configuredDirectory },
  },
]

for (const { name, basePath, input, pathname, query } of cases) {
  test(`submits the public admission and logical stream target for ${name}`, async () => {
    const original = getServerUrl()
    const recorded = Promise.withResolvers<{
      method: string
      path: string
      target: string | null
      dispatchMethod: string | null
      body: string
    }>()
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        recorded.resolve({
          method: request.method,
          path: new URL(request.url).pathname,
          target: request.headers.get(STREAM_SOCKET_TARGET_HEADER),
          dispatchMethod: request.headers.get(STREAM_SOCKET_METHOD_HEADER),
          body: await request.text(),
        })
        return new Response("Admission capture complete", { status: 503 })
      },
    })
    const closed = Promise.withResolvers<void>()
    try {
      configure({ serverUrl: server.url.origin + basePath, directory: configuredDirectory })
      createTauriTransport("browser").openStream(input, { onEvent() {}, onClose: () => closed.resolve() })
      await closed.promise
      const request = await recorded.promise
      expect(request).toMatchObject({
        method: "POST",
        path: basePath + STREAM_SOCKET_PATH,
        dispatchMethod: input.method ?? "GET",
        body: input.body ? JSON.stringify(message) : "",
      })
      const target = new URL(request.target!, server.url)
      expect(target.pathname).toBe(pathname)
      expect(Object.fromEntries(target.searchParams)).toEqual({
        ...query,
        [STREAM_INSTANCE_QUERY_KEY]: expect.stringMatching(/^[0-9a-f-]{36}$/),
      })
    } finally {
      configure({ serverUrl: original, directory: "" })
      await server.stop(true)
    }
  })
}
