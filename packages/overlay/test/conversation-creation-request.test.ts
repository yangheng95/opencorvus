import { afterEach, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { composerDraftText, setComposerDraft, workspaceComposerDraftKey } from "../src/services/composer-draft"
import { createConversationSession } from "../src/services/conversation-session"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { boardStore } from "../src/store/board"
import { DEFAULT_SETTINGS } from "../src/store/settings"

const directory = "/isolated/project-conversation-retry"
const draftKey = workspaceComposerDraftKey("", "", directory)

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ serverUrl: DEFAULT_SETTINGS.serverUrl, directory: "" })
  setComposerDraft(draftKey, "")
})

test("project conversation retry preserves the exact authored draft and repeats its creation identity", async () => {
  configure({ serverUrl: "http://isolated-conversation-review.invalid", directory })
  setComposerDraft(draftKey, "A user-authored draft")
  const requests: TransportRequest[] = []
  const interrupted = new TypeError("The create receipt was interrupted")
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request(request) {
      requests.push(request)
      throw interrupted
    },
    openStream() { throw new Error("This fixture only handles the creation request") },
    async native() { throw new Error("This fixture only handles the creation request") },
  } satisfies HostTransport)
  const options = { directory, experience: "chat" as const, composerDraftKey: draftKey, selectionEpoch: boardStore.selectEpoch }
  await expect(createConversationSession(options)).rejects.toBe(interrupted)
  await expect(createConversationSession({ ...options, model: "  " })).rejects.toBe(interrupted)

  const [first, retry] = requests
  expect(first).toMatchObject({ path: "coding/chat/session", method: "POST", query: { directory } })
  expect(first?.body).toMatchObject({ kind: "json", value: { requestID: expect.stringMatching(/^msg_/) } })
  expect(retry?.body).toEqual(first?.body)
  expect(composerDraftText(draftKey)).toBe("A user-authored draft")
})
