import { afterEach, describe, expect, test } from "bun:test"
import type { ChangeGroup } from "../src/services/diff"
import { loadConversationArtifactContent } from "../src/services/conversation-artifact"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { setProjectDirectoryContext } from "../src/services/project-directory"
import { resolveReviewFocusTarget } from "../src/services/review-focus"

afterEach(() => {
  __setHostTransportForTest(undefined)
  setProjectDirectoryContext("", false)
})

function artifactTransport(
  responder: (request: TransportRequest) => Promise<TransportResponse<Uint8Array>>,
): HostTransport {
  return {
    kind: "browser",
    request: responder,
    openStream() {
      throw new Error("openStream is outside the Artifact interaction contract")
    },
    async native() {
      throw new Error("native commands are outside the Artifact interaction contract")
    },
    onUiCommand() {
      return { unsubscribe() {} }
    },
  } as unknown as HostTransport
}

describe("Review focus contract", () => {
  test("resolves one exact group and file into its canonical diff target", () => {
    const groups: ChangeGroup[] = [
      {
        id: "artifact:delivery",
        taskID: "task_delivery",
        artifactID: "artifact_delivery",
        sessionID: "session_build",
        agentID: "build",
        additions: 3,
        deletions: 1,
        changes: [{ file: "src/artifact-reader.ts", status: "modified", additions: 3, deletions: 1, isText: true }],
      },
    ]

    expect(
      resolveReviewFocusTarget(groups, {
        taskID: "task_delivery",
        groupID: "artifact:delivery",
        filePath: "src/artifact-reader.ts",
      }),
    ).toEqual({
      filePath: "src/artifact-reader.ts",
      groupID: "artifact:delivery",
      sessionID: "session_build",
      agentID: "build",
    })
  })
})

describe("Conversation Artifact cancellation contract", () => {
  test("propagates caller cancellation through the active pagination request", async () => {
    setProjectDirectoryContext("C:/artifact-contract", false)
    let requestCount = 0
    let markSecondRequestStarted: () => void = () => {}
    const secondRequestStarted = new Promise<void>((resolve) => {
      markSecondRequestStarted = resolve
    })
    __setHostTransportForTest(
      artifactTransport(async (request) => {
        requestCount += 1
        if (requestCount === 1) {
          return {
            status: 200,
            ok: true,
            headers: {
              "content-disposition": "inline",
              "content-range": "bytes 0-1/4",
              "content-type": "application/json",
              etag: `"sha256:${"a".repeat(64)}"`,
            },
            body: new TextEncoder().encode('{"'),
          }
        }
        markSecondRequestStarted()
        return new Promise<TransportResponse<Uint8Array>>((_, reject) => {
          const signal = request.signal
          if (!signal) throw new Error("Pagination request has no caller signal")
          signal.addEventListener("abort", () => reject(signal.reason), { once: true })
        })
      }),
    )
    const controller = new AbortController()
    const pending = loadConversationArtifactContent({
      taskID: "task_artifact_contract",
      locator: {
        source: "engine_artifact",
        artifact_id: "artifact_contract",
        catalog_revision: 1,
        expected_sha256: "a".repeat(64),
      },
      signal: controller.signal,
    })
    await secondRequestStarted
    controller.abort(new DOMException("Artifact inspector closed", "AbortError"))
    await expect(pending).rejects.toMatchObject({ name: "AbortError", message: "Artifact inspector closed" })
  })
})
