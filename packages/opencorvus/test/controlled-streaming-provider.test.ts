import { expect, test } from "bun:test"
import MEMORY_PROMPT from "../src/agent/prompt/memory.txt"
import { SystemPrompt } from "../src/session/system"
import { startControlledStreamingProvider } from "./fixture/controlled-streaming-provider"

test("controlled Provider holds primary requests mentioning memory and streams the exact helper reply", async () => {
  const provider = startControlledStreamingProvider()
  try {
    const reply = fetch(`${provider.apiURL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stream: true,
        messages: [
          { role: "system", content: "Project MEMORY.MD is maintained by the dedicated Memory Organizer agent." },
          { role: "user", content: "Continue this conversation." },
        ],
      }),
    })
    const deadline = Date.now() + 5_000
    while (provider.requests.length === 0 && Date.now() < deadline) await Bun.sleep(10)
    expect(provider.requests.map(({ kind }) => kind)).toEqual(["prompt"])
    provider.promptRequests()[0]!.release()
    const response = await reply
    expect(response.headers.get("content-type")).toBe("text/event-stream")
    expect(await response.text()).toContain('"content":"provider reply 1"')

    const memory = await fetch(`${provider.apiURL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stream: true,
        messages: [
          { role: "system", content: [MEMORY_PROMPT, SystemPrompt.requestLanguage()].join("\n\n") },
          { role: "user", content: 'coveredOccurrenceIDs must be exactly ["occurrence-1"].' },
        ],
      }),
    })
    expect(provider.requests.map(({ kind }) => kind)).toEqual(["prompt", "memory"])
    expect(memory.headers.get("content-type")).toBe("text/event-stream")
    const chunks = (await memory.text()).split("\n\n").filter((chunk) => chunk.startsWith("data: {"))
    const text = chunks.map((chunk) => JSON.parse(chunk.slice(6)).choices[0].delta.content ?? "").join("")
    expect(JSON.parse(text)).toEqual({
      baseRevision: 0,
      coveredOccurrenceIDs: ["occurrence-1"],
      disposition: "organized",
      markdown: "",
    })
  } finally {
    for (const request of provider.requests) request.release()
    provider.server.stop(true)
  }
})
