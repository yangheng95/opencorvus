import { expect, test } from "bun:test"
import MEMORY_PROMPT from "../src/agent/prompt/memory.txt"
import { SystemPrompt } from "../src/session/system"
import { startControlledStreamingProvider, writeControlledProviderCatalog } from "./fixture/controlled-streaming-provider"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

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
          { role: "user", content: [
            "Maintain the Project MEMORY.MD from the evidence below.",
            "The complete replacement must contain at most 12000 estimated tokens.",
            "Return only JSON matching this shape:",
            '{"baseRevision":number,"coveredOccurrenceIDs":[string,...],"disposition":"organized","markdown":string}',
            "baseRevision must be 3.",
            'coveredOccurrenceIDs must be exactly ["occurrence-1","occurrence-2"].',
            "\nCURRENT PROJECT MEMORY.MD\n", "# Existing memory\n\nPreserve this original fact.",
            "\nORDERED PENDING USER-INPUT EVIDENCE\n",
            JSON.stringify([{ occurrenceID: "occurrence-1" }, { occurrenceID: "occurrence-2" }]),
          ].join("\n") },
        ],
      }),
    })
    expect(provider.requests.map(({ kind }) => kind)).toEqual(["prompt", "memory"])
    expect(memory.headers.get("content-type")).toBe("text/event-stream")
    const chunks = (await memory.text()).split("\n\n").filter((chunk) => chunk.startsWith("data: {"))
    const text = chunks.map((chunk) => JSON.parse(chunk.slice(6)).choices[0].delta.content ?? "").join("")
    expect(JSON.parse(text)).toEqual({
      baseRevision: 3,
      coveredOccurrenceIDs: ["occurrence-1", "occurrence-2"],
      disposition: "organized",
      markdown: '# Existing memory\n\nPreserve this original fact.\n\nControlled Provider fixture: organized input occurrences ["occurrence-1","occurrence-2"] at base revision 3.',
    })
  } finally {
    for (const request of provider.requests) request.release()
    provider.server.stop(true)
  }
})

test("controlled catalog supplies the complete current public provider declarations", async () => {
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!processRoot) throw new Error("Controlled catalog test requires the repository test runtime")
  const directory = await createManagedTemporaryDirectory(processRoot, "controlled-catalog-")
  try {
    const destination = path.join(directory, "models.json")
    const receipt = await writeControlledProviderCatalog(destination)
    const { ModelsDev } = await import("../src/provider/models")
    const catalog = ModelsDev.validateExplicitCatalog(JSON.parse(await fs.readFile(destination, "utf8")))
    expect({ destination: receipt.destination, opencorvus: catalog.opencorvus.id, kilo: catalog.kilo.id }).toEqual({
      destination, opencorvus: "opencorvus", kilo: "kilo",
    })
    expect(receipt.providerCount).toBe(Object.keys(catalog).length)
    expect(receipt.modelCount).toBe(Object.values(catalog).reduce((sum, provider) => sum + Object.keys(provider.models).length, 0))
    expect(Object.keys(catalog.openai.models).length).toBeGreaterThan(0)
  } finally {
    await removeManagedDirectoryTree(directory)
  }
})
