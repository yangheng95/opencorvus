import { afterEach, expect, test } from "bun:test"
import { executeWebFetch } from "../../src/tool/webfetch"
import { Tool } from "../../src/tool/tool"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { resolveSessionExecutionAuthority } from "../../src/engine/task-session-lineage"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("actual HTTP output keeps complete UTF-8 prefixes and exact clipping metadata", async () => {
  const budget = 50 * 1024 - 512
  const cases = ["غ", "文", "🙂"].flatMap((character) => {
    const width = Buffer.byteLength(character)
    return Array.from({ length: width }, (_, padding) => ({
      name: `${character}-${padding}`,
      body: "x".repeat(padding) + character.repeat(budget),
      prefix: "x".repeat(padding) + character.repeat(Math.floor((budget - padding) / width)),
      clipped: true,
    }))
  })
  cases.push(
    { name: "exact", body: "x".repeat(budget - 4) + "🙂", prefix: "x".repeat(budget - 4) + "🙂", clipped: false },
    { name: "ascii", body: "x".repeat(budget + 1), prefix: "x".repeat(budget), clipped: true },
    { name: "lines", body: "正文\n" + "文".repeat(budget), prefix: "正文", clipped: true },
  )
  await using project = await memoryProject("webfetch-utf8-prefix")
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      const item = cases[Number(new URL(request.url).pathname.slice(1))]!
      return new Response(item.body, { headers: { "content-type": "text/plain; charset=utf-8" } })
    },
  })
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Owned HTTP UTF-8 prefix" })
        const executionAuthority = await resolveSessionExecutionAuthority({
          sessionID: session.id,
          projectID: Instance.project.id,
          expected: { kind: "conversation" },
        })
        const ctx: Tool.Context = {
          sessionID: session.id,
          messageID: "message_webfetch_utf8",
          agent: "coding",
          abort: new AbortController().signal,
          messages: [],
          executionAuthority,
          executionSurface: Tool.executionSurface(["webfetch"], []),
          metadata() {},
        }
        const results = await Promise.all(
          cases.map((_, index) => executeWebFetch({ url: `${server.url}${index}`, format: "text" }, ctx)),
        )
        console.log(
          "HTTP prefix observations",
          JSON.stringify(
            results.map((result, index) => ({
              name: cases[index]!.name,
              tail: Array.from(result.output).slice(-130).join(""),
              metadata: result.metadata,
            })),
          ),
        )
        for (const [index, item] of cases.entries()) {
          const result = results[index]!
          const originalBytes = Buffer.byteLength(item.body)
          const shownBytes = Buffer.byteLength(item.prefix)
          const omittedBytes = originalBytes - shownBytes
          const output =
            item.prefix +
            (item.clipped
              ? `\n\n[webfetch output clipped: ${shownBytes} of ${originalBytes} bytes shown, ${omittedBytes} bytes omitted from model context]`
              : "")
          // Compare actual HTTP output bytes to the authored complete-character expectation.
          expect(Buffer.compare(Buffer.from(result.output), Buffer.from(output))).toBe(0)
          expect(result.metadata).toEqual({
            originalBytes,
            shownBytes,
            ...(item.clipped ? { omittedBytes } : {}),
            webfetchOutputClipped: item.clipped,
            webfetchEmbeddedAttachmentCount: 0,
          })
          expect(result.sources[0]!.url).toBe(`${server.url}${index}`)
        }
      },
    })
  } finally {
    await server.stop(true)
  }
})
