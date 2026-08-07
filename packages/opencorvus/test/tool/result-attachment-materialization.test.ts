import { describe, expect, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { AttachmentStore } from "../../src/storage/attachment-store"
import {
  cloneToolInputForPersistence,
  materializeToolResultInlineAttachments,
} from "../../src/tool/result-attachment-materialization"

describe("tool result attachment materialization", () => {
  test("replaces real inline output bytes with one content-addressed reference", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const bytes = Buffer.from('{"fixture":"real tool output"}')
        const dataUrl = `data:application/json;base64,${bytes.toString("base64")}`
        const result = await materializeToolResultInlineAttachments({
          projectID: Instance.project.id,
          value: { output: `prefix ${dataUrl} suffix`, metadata: { output: dataUrl } },
        })

        const reference = result.metadata.output
        expect(result.output).toBe(`prefix ${reference} suffix`)
        expect(reference).toStartWith(`/attachment/${Instance.project.id}/`)
        const name = reference.slice(reference.lastIndexOf("/") + 1)
        expect(await AttachmentStore.read(Instance.project.id, name)).toEqual(bytes)
      },
    })
  })

  test("preserves ordinary source text that contains an empty data URL header", async () => {
    const source = 'const emptyDataUrlPattern = "data:image/png;base64,"'
    expect(
      await materializeToolResultInlineAttachments({
        projectID: "project-source-text",
        value: { patch: source },
      }),
    ).toEqual({ patch: source })
  })

  test("preserves exact non-empty data URLs in persisted tool source input", () => {
    const source = 'const pixel = "data:image/png;base64,aGVsbG8="'
    expect(cloneToolInputForPersistence({ patch: source })).toEqual({ patch: source })
  })
})
