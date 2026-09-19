import { afterEach, expect, test } from "bun:test"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { createMissionDraft, dispatchMission, wakeMission } from "../src/services/mission"

function recordingTransport(requests: TransportRequest[]): HostTransport {
  return {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(input: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(input)
      return {
        status: 200,
        ok: true,
        headers: {},
        body: {
          missionID: "mission_board_acceptance",
          sessionID: "session_board_acceptance",
          created: true,
          productPillar: "code",
        } as T,
      }
    },
    openStream() {
      return { close() {} }
    },
    async native() {
      return true
    },
  }
}

afterEach(() => {
  __setHostTransportForTest(undefined)
})

test("Mission wake, draft creation, and draft dispatch settle on the authoritative server response", async () => {
  const requests: TransportRequest[] = []
  __setHostTransportForTest(recordingTransport(requests))

  await wakeMission({
    directory: "D:/project",
    text: "Publish the board task",
    productPillar: "code",
    model: "openai/gpt-5.6-terra",
    expertSquadIDs: ["base"],
  })
  await createMissionDraft({
    directory: "D:/project",
    title: "Panel backlog",
    request: "Publish the backlog item",
    productPillar: "code",
    expertSquadIDs: ["base"],
  })
  await dispatchMission(
    { missionID: "mission_board_acceptance", directory: "D:/project" },
    "openai/gpt-5.6-terra",
  )

  expect(
    requests.map((request) => ({
      method: request.method,
      path: request.path,
      timeoutMilliseconds: request.timeoutMilliseconds,
    })),
  ).toEqual([
    { method: "POST", path: "mission/wake", timeoutMilliseconds: null },
    { method: "POST", path: "mission/draft", timeoutMilliseconds: null },
    { method: "POST", path: "mission/mission_board_acceptance/dispatch", timeoutMilliseconds: null },
  ])
})

test.each([undefined, "mission_attachment_follow_up"])(
  "Mission wake projects uploaded attachments into its request contract (missionID=%s)",
  async (missionID) => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(recordingTransport(requests))
    const file = {
      kind: "file" as const,
      sha: "a".repeat(64),
      size: 42,
      url: `/attachment/project-alpha/${"a".repeat(64)}.txt`,
      mime: "text/plain",
      filename: "证据.txt",
    }
    const folder = {
      kind: "folder" as const,
      sha: "b".repeat(64),
      size: 84,
      path: "D:/project/design",
      url: `/attachment/project-alpha/${"b".repeat(64)}.json`,
      mime: "application/vnd.opencorvus.directory-reference+json",
      filename: "design",
    }
    const inline = { mime: "text/plain", data: "aGVsbG8=" }
    await wakeMission({
      directory: "D:/project",
      missionID,
      text: "Read the attached evidence",
      productPillar: "work",
      attachments: [file, folder, inline],
    })

    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ path: "mission/wake", method: "POST", query: { directory: "D:/project" } })
    expect(requests[0].body).toEqual({
      kind: "json",
      value: {
        text: "Read the attached evidence",
        productPillar: "work",
        ...(missionID ? { missionID } : {}),
        attachments: [
          { url: file.url, mime: file.mime, filename: file.filename },
          { url: folder.url, mime: folder.mime, filename: folder.filename },
          inline,
        ],
      },
    })
  },
)
