import { afterEach, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { composerDraftText, setComposerDraft, workspaceComposerDraftKey } from "../src/services/composer-draft"
import { createConversationSession, createGlobalConversationSession } from "../src/services/conversation-session"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { boardStore } from "../src/store/board"
import { DEFAULT_SETTINGS } from "../src/store/settings"

const directory = "/isolated/project-conversation-retry"
const draftKey = workspaceComposerDraftKey("", "", directory)
const globalDraftKey = workspaceComposerDraftKey("", "", "")

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ serverUrl: DEFAULT_SETTINGS.serverUrl, directory: "" })
  setComposerDraft(draftKey, "")
  setComposerDraft(globalDraftKey, "")
})

function interruptCreation(interrupted: TypeError): TransportRequest[] {
  const requests: TransportRequest[] = []
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
  return requests
}

test("project conversation retry preserves the exact authored draft and repeats its creation identity", async () => {
  configure({ serverUrl: "http://isolated-conversation-review.invalid", directory })
  setComposerDraft(draftKey, "A user-authored draft")
  const interrupted = new TypeError("The create receipt was interrupted")
  const requests = interruptCreation(interrupted)
  const options = { directory, experience: "chat" as const, composerDraftKey: draftKey, selectionEpoch: boardStore.selectEpoch }
  await expect(createConversationSession(options)).rejects.toBe(interrupted)
  await expect(createConversationSession({ ...options, model: "  " })).rejects.toBe(interrupted)

  const [first, retry] = requests
  expect(first).toMatchObject({ path: "coding/chat/session", method: "POST", query: { directory } })
  expect(first?.body).toMatchObject({ kind: "json", value: { requestID: expect.stringMatching(/^msg_/) } })
  expect(retry?.body).toEqual(first?.body)
  expect(composerDraftText(draftKey)).toBe("A user-authored draft")
})

test("global Work retry keeps its own request identity and authored input", async () => {
  configure({ serverUrl: "http://isolated-global-conversation-review.invalid", directory: "" })
  setComposerDraft(globalDraftKey, "An authored Work request")
  const interrupted = new TypeError("The global create receipt was interrupted")
  const requests = interruptCreation(interrupted)
  const options = { experience: "work" as const, composerDraftKey: globalDraftKey, selectionEpoch: boardStore.selectEpoch }
  await expect(createGlobalConversationSession(options)).rejects.toBe(interrupted)
  await expect(createGlobalConversationSession(options)).rejects.toBe(interrupted)

  const [first, retry] = requests
  expect(first).toMatchObject({ path: "global/work", method: "POST" })
  expect(first?.body).toMatchObject({ kind: "json", value: { requestID: expect.stringMatching(/^msg_/) } })
  expect(retry?.body).toEqual(first?.body)
  expect(composerDraftText(globalDraftKey)).toBe("An authored Work request")
})
