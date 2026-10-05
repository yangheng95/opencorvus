import { afterEach, expect, test } from "bun:test"
import { ApiAuthorityChangedError, captureApiAuthority, configure, renewApiAuthority } from "../src/services/api-state"
import {
  beginImagePreviewRequest,
  closeImagePreview,
  imagePreviewState,
  openImagePreview,
  openImagePreviewForRequest,
} from "../src/services/image-preview"

afterEach(() => {
  closeImagePreview()
  configure({ serverUrl: "http://127.0.0.1:7878", username: "opencorvus", password: "", directory: "" })
})

test("a current request publishes its original resource identity with the resolved image", () => {
  configure({ serverUrl: "http://owned-a.invalid" })
  const authority = captureApiAuthority()
  const revision = beginImagePreviewRequest()
  const opened = openImagePreviewForRequest(revision, "blob:owned-image", "owned image", {
    resourceUrl: "/attachment/owned/image.png",
    authority,
  })
  expect({ opened, state: imagePreviewState() }).toEqual({
    opened: true,
    state: {
      open: true,
      src: "blob:owned-image",
      alt: "owned image",
      revision,
      resourceUrl: "/attachment/owned/image.png",
    },
  })
})

test("an API-retired pending image reports the typed original authority outcome", () => {
  configure({ serverUrl: "http://owned-a.invalid" })
  const authority = captureApiAuthority()
  const revision = beginImagePreviewRequest()
  renewApiAuthority()
  let failure: unknown
  try {
    openImagePreviewForRequest(revision, "blob:owned-old", "owned", {
      resourceUrl: "/attachment/owned/image.png",
      authority,
    })
  } catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(ApiAuthorityChangedError)
  const error = failure as ApiAuthorityChangedError
  expect({
    name: error.name,
    expected: error.expectedRevision,
    current: error.currentRevision,
    outcome: error.outcome,
  }).toEqual({
    name: "ApiAuthorityChangedError",
    expected: authority.revision,
    current: authority.revision + 1,
    outcome: { phase: "before_dispatch" },
  })
})

test("closing the modal settles a late request against the canonical closed revision", () => {
  const revision = beginImagePreviewRequest()
  closeImagePreview()
  const result = openImagePreviewForRequest(revision, "blob:owned-late", "late")
  expect({ result, state: imagePreviewState() }).toEqual({
    result: false,
    state: { open: false, src: "", alt: "", revision: revision + 1 },
  })
})

test("standalone external images retain their exact view while API authority renews", () => {
  openImagePreview("data:image/png;base64,OWNED", "external fixture")
  const state = imagePreviewState()
  renewApiAuthority()
  expect(imagePreviewState()).toEqual({
    open: true,
    src: "data:image/png;base64,OWNED",
    alt: "external fixture",
    revision: state.revision,
  })
})
