import { afterEach, expect, test } from "bun:test"
import { createComposerUploadLifetime } from "../src/services/composer-upload-lifetime"
import { beginWorkspaceSelection, resolveGlobalComposerProject } from "../src/services/workspace"
import { setSettingsStore } from "../src/store/settings"
import { setBoardStore } from "../src/store/board"

afterEach(() => {
  setBoardStore({ selectedSource: null, board: null })
  setSettingsStore("directory", "")
})

function establishedOperation() {
  setSettingsStore("directory", "D:/owned/attachments")
  return resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: beginWorkspaceSelection() })
}

test("parallel file and folder operations finish their own live tokens", async () => {
  const operation = establishedOperation()
  await operation.promise
  const uploads = createComposerUploadLifetime()
  const file = uploads.register(operation)
  const folder = uploads.register(operation)
  expect(uploads.count()).toBe(2)
  uploads.finish(file)
  expect({ count: uploads.count(), folder: uploads.isCurrent(folder) }).toEqual({ count: 1, folder: true })
  uploads.finish(folder)
  expect(uploads.count()).toBe(0)
})

test("external selection expires old inputs and their late finally preserves a new batch", async () => {
  const oldOperation = establishedOperation()
  await oldOperation.promise
  const uploads = createComposerUploadLifetime()
  const old = uploads.register(oldOperation)
  const nextOperation = establishedOperation()
  await nextOperation.promise
  expect({ count: uploads.count(), current: uploads.isCurrent(old) }).toEqual({ count: 0, current: false })
  const next = uploads.register(nextOperation)
  uploads.finish(old)
  expect({ count: uploads.count(), current: uploads.isCurrent(next) }).toEqual({ count: 1, current: true })
})

test("a failing input settles its own token while another live input retains count and membership", async () => {
  const operation = establishedOperation()
  await operation.promise
  const uploads = createComposerUploadLifetime()
  const other = uploads.register(operation)
  const failing = uploads.register(operation)
  const error = new Error("Input failed")
  const attempt = (async () => {
    try {
      await Promise.reject(error)
    } finally {
      uploads.finish(failing)
    }
  })()
  await expect(attempt).rejects.toBe(error)
  expect({ count: uploads.count(), current: uploads.isCurrent(other), registered: uploads.has(other) }).toEqual({
    count: 1,
    current: true,
    registered: true,
  })
})

test("component disposal releases its collection and has an explicit terminal registration error", async () => {
  const operation = establishedOperation()
  await operation.promise
  const uploads = createComposerUploadLifetime()
  const token = uploads.register(operation)
  uploads.dispose()
  uploads.finish(token)
  expect({ count: uploads.count(), current: uploads.isCurrent(token) }).toEqual({ count: 0, current: false })
  expect(() => uploads.register(operation)).toThrow("Composer upload lifetime is disposed")
})
