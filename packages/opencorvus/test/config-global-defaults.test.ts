import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { Global } from "@/global"
import { GlobalConversationService } from "@/chat/global-chat-service"

const filename = path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)

async function source(text?: string) {
  await mkdir(Global.Path.config, { recursive: true })
  if (text === undefined) await rm(filename, { force: true })
  else await writeFile(filename, text)
  Config.global.reset()
}

afterEach(() => source())

describe.serial("effective global configuration defaults", () => {
  for (const [label, text] of [
    ["absent", undefined],
    ["empty", ""],
    ["whitespace", " \n\t"],
    ["empty object", "{}"],
  ] as const) {
    test(`${label} source yields canonical defaults and conversation preflight`, async () => {
      await source(text)
      const expected = Config.Info.parse({})
      expect(await Config.global()).toEqual(expected)
      const configSnapshot = await Config.getGlobal()
      expect(configSnapshot).toEqual(expected)
      const result = await GlobalConversationService.preflight({ configSnapshot })
      expect(result.initialOverlay).toEqual({ prompt_profile: { active: "base" } })
    })
  }

  test("source revision changes publish explicit settings and then canonical defaults", async () => {
    await source(JSON.stringify({ prompt_profile: { active: "luna" }, username: "configured-user" }))
    expect((await Config.getGlobal()).prompt_profile).toEqual({ active: "luna" })
    await writeFile(filename, "\n")
    expect(await Config.getGlobal()).toEqual(Config.Info.parse({}))
    await writeFile(filename, JSON.stringify({ username: "next-user" }))
    expect((await Config.global()).username).toBe("next-user")
    expect((await Config.global()).prompt_profile).toEqual({ active: "base" })
  })

  test("first atomic write receives canonical defaults and publishes the requested setting", async () => {
    await source()
    let observed: unknown
    await Config.updateGlobalPatchAtomic((effective, writable) => {
      observed = { effective, writable }
      return { username: "first-write" }
    })
    expect(observed).toEqual({ effective: Config.Info.parse({}), writable: Config.Info.parse({}) })
    expect((await Config.getGlobal()).username).toBe("first-write")
    expect((await Config.getGlobal()).prompt_profile).toEqual({ active: "base" })
  })
})
