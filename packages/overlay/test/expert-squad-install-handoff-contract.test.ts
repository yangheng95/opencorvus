
import { describe, expect, test } from "bun:test"
import {
  downloadExpertSquadInstallArchive,
  parseExpertSquadInstallHandoff,
  sameExpertSquadInstallHandoff,
} from "../src/services/expert-squad-install-handoff-contract"

const digest = "a".repeat(64)
const archiveDigest = "b".repeat(64)

describe("Expert Squad hosted install handoff contract", () => {
  test("binds one exact hosted revision and immutable archive URL", () => {
    const archiveUrl =
      "https://market.opencorvus.ai/records/builtin/frontend-replica/2026.08.07.1/" + digest + "/archive"
    const url = new URL("opencorvus://expert-squad/install")
    url.searchParams.set("namespace", "builtin")
    url.searchParams.set("id", "frontend-replica")
    url.searchParams.set("version", "2026.08.07.1")
    url.searchParams.set("packageDigest", digest)
    url.searchParams.set("archiveSha256", archiveDigest)
    url.searchParams.set("archiveBytes", "91463")
    url.searchParams.set("archiveUrl", archiveUrl)

    const handoff = parseExpertSquadInstallHandoff(url.href)
    expect(handoff).toEqual({
      namespace: "builtin",
      id: "frontend-replica",
      version: "2026.08.07.1",
      packageDigest: digest,
      archiveSha256: archiveDigest,
      archiveBytes: 91463,
      archiveUrl,
    })
    expect(sameExpertSquadInstallHandoff(handoff, { ...handoff })).toBe(true)
  })

  test("streams one exact ZIP response within the canonical archive byte bound", async () => {
    const archiveUrl = "https://market.opencorvus.ai/records/builtin/frontend-replica/revision/archive"
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const handoff = {
      namespace: "builtin",
      id: "frontend-replica",
      version: "2026.08.07.1",
      packageDigest: digest,
      archiveSha256: archiveDigest,
      archiveBytes: bytes.byteLength,
      archiveUrl,
    }
    const fetcher = (async () => {
      const response = new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "application/zip", "Content-Length": String(bytes.byteLength) },
      })
      Object.defineProperty(response, "url", { value: archiveUrl })
      return response
    }) as typeof fetch

    const downloaded = await downloadExpertSquadInstallArchive(handoff, fetcher)
    expect(new Uint8Array(downloaded)).toEqual(bytes)
  })
})
