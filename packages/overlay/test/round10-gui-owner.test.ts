import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const overlayRoot = resolve(import.meta.dir, "..")
const readSource = (path: string) => readFileSync(resolve(overlayRoot, path), "utf8")

test("server connection save owns an immutable snapshot, completion, and feedback timer", () => {
  const source = readSource("src/components/settings/ServerConnectionSettingsGroup.tsx")
  expect(source).toContain("const snapshot = {")
  expect(source).toContain("await saveSettings({ overrides: snapshot })")
  expect(source).toContain("const generation = ++saveGeneration")
  expect(source.match(/await saveSettings\(\{ overrides: snapshot \}\)\s+if \(!ownsSave\(\)\) return/)?.[0]).toBeTruthy()
  expect(source.match(/await checkConnection\(\)\s+if \(!ownsSave\(\)\) return/)?.[0]).toBeTruthy()
  expect(source.match(/await reloadProjectScope\(\)\s+if \(!ownsSave\(\)\) return/)?.[0]).toBeTruthy()
  expect(source).toContain("if (ownsSave()) setSaved(false)")
  expect(source).toContain("disabled={saving()}")
})

test("PDF preview destroys source tasks and makes the current document reactive", () => {
  const source = readSource("src/components/interactive-artifact/FilePreviewArtifact.tsx")
  expect(source).toContain("const [currentDocument, setCurrentDocument]")
  expect(source).toContain("const generation = ++sourceGeneration")
  expect(source).toContain("if (generation !== sourceGeneration)")
  expect(source).toContain("void loadingTask.destroy()")
  expect(source).toContain("renderTask?.cancel()")
  expect(source).toContain("setPage(1)")
  expect(source).toContain('setError("")')
})
