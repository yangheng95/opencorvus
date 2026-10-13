import assert from "node:assert/strict"
import fs from "node:fs/promises"
import type { ModelMessage } from "ai"
import type { LLM } from "@/session/llm"

/** Experimental comparison artifact, never a product Session checkpoint. */
export namespace CompactionNativeReference {
  export class InvalidResult extends Error {
    readonly code = "NATIVE_COMPACTION_INCOMPLETE"
    constructor(message: string) {
      super(message)
      this.name = "NativeCompactionReferenceError"
    }
  }

  export async function compact(input: { stream: Omit<LLM.StreamInput, "tools">; artifactPath: string }) {
    const { LLM } = await import("@/session/llm")
    assert.equal(input.stream.model.api.npm, "@ai-sdk/openai", "Native reference needs the OpenAI Responses adapter")
    const stream = await LLM.stream({
      ...input.stream,
      model: {
        ...input.stream.model,
        options: { ...input.stream.model.options, store: false, compactionTrigger: true },
      },
      tools: {},
    })
    const events: string[] = []
    let completedItems = 0
    for await (const part of stream.stream) {
      events.push(part.type)
      if (part.type === "error") throw part.error
      if (part.type === "custom" && part.kind === "openai.compaction") completedItems++
    }
    if (completedItems === 0) throw new InvalidResult("Native stream ended without a completed compaction item")
    const finish = await stream.finishReason
    const response = await stream.response
    const output = response.messages
    let boundary: { message: number; part: number; itemID: string; encryptedCharacters: number } | undefined
    output.forEach((message, index) => {
      if (message.role !== "assistant" || !Array.isArray(message.content)) return
      message.content.forEach((part, partIndex) => {
        if (part.type !== "custom" || part.kind !== "openai.compaction") return
        const metadata = part.providerOptions?.openai
        if (
          typeof metadata?.itemId !== "string" ||
          !metadata.itemId ||
          typeof metadata.encryptedContent !== "string" ||
          !metadata.encryptedContent
        )
          throw new InvalidResult("Completed native item must carry its original identity and encrypted content")
        boundary = {
          message: index,
          part: partIndex,
          itemID: metadata.itemId,
          encryptedCharacters: metadata.encryptedContent.length,
        }
      })
    })
    if (finish !== "stop" || !boundary)
      throw new InvalidResult(`Native reference needs a completed item and stop; received finish=${finish}`)
    const first = output[boundary.message]!
    assert(first.role === "assistant" && Array.isArray(first.content))
    const replay: ModelMessage[] = [
      { ...first, content: first.content.slice(boundary.part) },
      ...output.slice(boundary.message + 1),
    ]
    const artifact = {
      scope: "experimental native reference; not a Session MEMORY.MD checkpoint",
      model: { providerID: input.stream.model.providerID, modelID: input.stream.model.id },
      responseID: response.id,
      finish,
      output,
      replay,
    }
    await fs.writeFile(input.artifactPath, JSON.stringify(artifact), { flag: "wx" })
    const reopened = JSON.parse(await fs.readFile(input.artifactPath, "utf8")) as typeof artifact
    assert.deepEqual(reopened, artifact, "Exact returned native state survives artifact reopening")
    return {
      messages: reopened.replay,
      report: {
        scope: artifact.scope,
        artifactPath: input.artifactPath,
        responseID: response.id,
        itemID: boundary.itemID,
        encryptedCharacters: boundary.encryptedCharacters,
        finish,
        events,
        usage: await stream.totalUsage,
        reopen: "exact returned native response and replay content",
      },
    }
  }
}
