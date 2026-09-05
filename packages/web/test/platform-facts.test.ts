import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { READY_CHANNELS, PLANNED_CHANNELS } from "../../channel-runtime/src/registry"
import { GLOBAL_TOOL_IDS } from "../../opencorvus/src/tool/tool-id-catalog"
import { generatedPlatformFacts } from "../src/content/platform-facts.generated"
import { derivePlatformFacts, generatePlatformFacts } from "../script/generate-platform-facts"

describe("platform facts generator data", () => {
  test("derives exact counts from the owning catalogs", async () => {
    const catalog = JSON.parse(
      await readFile(new URL("../../opencorvus/src/provider/models-bootstrap.json", import.meta.url), "utf8"),
    ) as Record<string, { models: Record<string, unknown> }>
    expect(await derivePlatformFacts()).toEqual({
      modelProviders: Object.keys(catalog).length,
      models: Object.values(catalog).reduce((total, provider) => total + Object.keys(provider.models).length, 0),
      chatChannels: READY_CHANNELS.length,
      plannedChatChannels: PLANNED_CHANNELS.length,
      builtInTools: GLOBAL_TOOL_IDS.length,
    })
  })

  test("writes an importable module with the current canonical facts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-platform-facts-"))
    try {
      const target = path.join(root, "platform-facts.ts")
      const facts = await generatePlatformFacts(target)
      const generated = await import(pathToFileURL(target).href)
      expect(generated.generatedPlatformFacts).toEqual(facts)
      expect(facts).toEqual(generatedPlatformFacts)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
