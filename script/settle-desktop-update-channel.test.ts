import { describe, expect, test } from "bun:test"
import {
  parseDesktopChannelReleaseAuthority,
  settleDesktopUpdateChannel,
  type DesktopChannelAuthority,
} from "./settle-desktop-update-channel"

const repository = "owner/repository"

function candidate(version: string): string {
  return `${JSON.stringify(
    {
      version,
      notes: "",
      pub_date: "2026-08-29T00:00:00.000Z",
      platforms: {
        "linux-x86_64": {
          url: `https://github.com/${repository}/releases/download/v${version}/OpenCorvus_${version}_amd64.AppImage`,
          signature: "trusted-signature",
        },
      },
    },
    null,
    2,
  )}\n`
}

class MemoryChannel implements DesktopChannelAuthority {
  current?: string
  ensured = false
  failAfterUpload = false

  async readManifest(): Promise<string | undefined> {
    return this.current
  }

  async ensureRelease(): Promise<void> {
    this.ensured = true
  }

  async uploadManifest(content: string): Promise<void> {
    this.current = content
    if (this.failAfterUpload) {
      this.failAfterUpload = false
      throw new Error("connection closed after upload")
    }
  }
}

describe("desktop update channel settlement", () => {
  test("preserves the newer beta when an older publication arrives later", async () => {
    const authority = new MemoryChannel()
    await expect(
      settleDesktopUpdateChannel(
        { version: "0.0.58-beta", channel: "beta", repository, candidate: candidate("0.0.58-beta") },
        authority,
      ),
    ).resolves.toEqual({ kind: "promoted", version: "0.0.58-beta", channel: "beta" })
    await expect(
      settleDesktopUpdateChannel(
        { version: "0.0.57-beta", channel: "beta", repository, candidate: candidate("0.0.57-beta") },
        authority,
      ),
    ).resolves.toEqual({ kind: "superseded", version: "0.0.58-beta", channel: "beta" })
    expect(authority.current).toBe(candidate("0.0.58-beta"))
  })

  test("resumes an uncertain upload from canonical same-version channel state", async () => {
    const authority = new MemoryChannel()
    authority.failAfterUpload = true
    const input = {
      version: "0.0.57-beta",
      channel: "beta" as const,
      repository,
      candidate: candidate("0.0.57-beta"),
    }
    await expect(settleDesktopUpdateChannel(input, authority)).rejects.toThrow("connection closed after upload")
    await expect(settleDesktopUpdateChannel(input, authority)).resolves.toEqual({
      kind: "current",
      version: "0.0.57-beta",
      channel: "beta",
    })
  })

  test.each([
    ["empty current asset", ""],
    ["missing platform contract", JSON.stringify({ version: "999.0.0" })],
    [
      "invalid current version",
      JSON.stringify({
        version: "not-semver",
        notes: "",
        pub_date: "2026-08-29T00:00:00.000Z",
        platforms: {
          "linux-x86_64": { url: "https://example.com/update.tar.gz", signature: "signature" },
        },
      }),
    ],
  ])("maps %s to the exact invalid-manifest terminal contract", async (_name, current) => {
    const authority = new MemoryChannel()
    authority.current = current
    await expect(
      settleDesktopUpdateChannel(
        { version: "0.0.57-beta", channel: "beta", repository, candidate: candidate("0.0.57-beta") },
        authority,
      ),
    ).rejects.toMatchObject({ code: "desktop_channel_invalid_manifest" })
    expect(authority.ensured).toBe(false)
  })

  test("rejects a corrupt candidate before acquiring channel publication authority", async () => {
    const authority = new MemoryChannel()
    await expect(
      settleDesktopUpdateChannel(
        {
          version: "0.0.57-beta",
          channel: "beta",
          repository,
          candidate: JSON.stringify({ version: "0.0.57-beta" }),
        },
        authority,
      ),
    ).rejects.toMatchObject({ code: "desktop_channel_invalid_manifest" })
    expect(authority.ensured).toBe(false)
  })

  test.each([
    [
      "unknown target",
      {
        version: "999.0.0",
        notes: "",
        pub_date: "2026-08-29T00:00:00.000Z",
        platforms: {
          evil: {
            url: `https://github.com/${repository}/releases/download/v999.0.0/OpenCorvus_999.0.0_amd64.AppImage`,
            signature: "signature",
          },
        },
      },
    ],
    [
      "foreign asset host",
      {
        version: "999.0.0",
        notes: "",
        pub_date: "2026-08-29T00:00:00.000Z",
        platforms: {
          "linux-x86_64": { url: "https://example.com/OpenCorvus_999.0.0_amd64.AppImage", signature: "signature" },
        },
      },
    ],
    [
      "wrong immutable version asset",
      {
        version: "999.0.0",
        notes: "",
        pub_date: "2026-08-29T00:00:00.000Z",
        platforms: {
          "linux-x86_64": {
            url: `https://github.com/${repository}/releases/download/v998.0.0/OpenCorvus_998.0.0_amd64.AppImage`,
            signature: "signature",
          },
        },
      },
    ],
  ])("rejects a high-version %s instead of suppressing the real updater", async (_name, current) => {
    const authority = new MemoryChannel()
    authority.current = JSON.stringify(current)
    await expect(
      settleDesktopUpdateChannel(
        { version: "0.0.57-beta", channel: "beta", repository, candidate: candidate("0.0.57-beta") },
        authority,
      ),
    ).rejects.toMatchObject({ code: "desktop_channel_invalid_manifest" })
    expect(authority.ensured).toBe(false)
  })

  test("rejects a mutable channel Release that is not a prerelease authority", () => {
    expect(() =>
      parseDesktopChannelReleaseAuthority("desktop-update-beta", {
        tag_name: "desktop-update-beta",
        draft: false,
        prerelease: false,
        assets: [],
      }),
    ).toThrow(expect.objectContaining({ code: "desktop_channel_api_failure" }))
  })
})
