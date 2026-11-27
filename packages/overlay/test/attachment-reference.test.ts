import { expect, test } from "bun:test"
import { DIRECTORY_REFERENCE_MIME } from "@opencorvus-ai/transport-protocol"
import { attachmentDownloadFilename } from "../src/services/attachment-reference"

test("original downloads project directory manifests and preserve ordinary filenames", () => {
  expect(attachmentDownloadFilename({ mime: DIRECTORY_REFERENCE_MIME, filename: "review" })).toBe("review.directory.json")
  expect(attachmentDownloadFilename({ mime: "application/octet-stream", filename: "核对 #1.py" })).toBe("核对 #1.py")
  expect(attachmentDownloadFilename({ mime: "application/pdf", filename: "审阅稿.pdf" })).toBe("审阅稿.pdf")
})
