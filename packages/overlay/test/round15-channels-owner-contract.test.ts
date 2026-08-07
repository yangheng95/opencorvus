import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const overlayRoot = join(import.meta.dir, "..")
const channels = readFileSync(join(overlayRoot, "src/components/settings/ChannelsPanel.tsx"), "utf8")

describe("Round15 Channels async ownership", () => {
  test("save owners capture immutable form and scope identity", () => {
    expect(channels).toContain('type ChannelSaveKind = "channel" | "public-url"')
    expect(channels).toContain("readonly directory: string")
    expect(channels).toContain("readonly formKind: ChannelSaveKind")
    expect(channels).toContain("readonly channelID: string")
    expect(channels).toContain("readonly generation: number")
    expect(channels).toContain("const currentValues = fieldValues()")
    expect(channels).toContain("const publicUrlSnapshot = localPublicUrl().trim()")
    expect(channels).toContain("ownsResponse: () => ownsSave(owner)")
    expect(channels).toContain("if (!ownsSave(owner)) return")
  })

  test("scope and form changes invalidate stale completion, feedback, and timers", () => {
    expect(channels).toContain("invalidateSaveOwner()")
    expect(channels).toContain("invalidateTutorialOwner()")
    expect(channels).toContain("clearNotice()")
    expect(channels).toContain("if (generation !== noticeGeneration) return")
    expect(channels).toContain("if (ownsSave(owner)) showNotice")
    expect(channels).toContain("if (ownsSave(owner)) setSavingOwner(null)")
  })

  test("both tutorial entrances share one exact failure owner", () => {
    expect(channels).toContain("interface TutorialOpenOwner")
    expect(channels).toContain("readonly formIdentity: string")
    expect(channels).toContain("readonly trigger: HTMLButtonElement")
    expect(channels).toContain("const opened = await nativeOpen(target)")
    expect(channels).toContain('if (!opened) throw new Error("native open returned false")')
    expect(channels).toContain('role={noticeTone() === "error" ? "alert" : "status"}')
    expect(channels).toContain("owner.trigger.isConnected")
    expect(channels.match(/void openTutorial\(/g)?.length).toBe(2)
  })
})
