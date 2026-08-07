import { describe, expect, test } from "bun:test"

import {
  boundaryMessageHasNarrativeContent,
  executionDisclosureKey,
  messagePartHasDisplayContent,
  partitionMessagePartRenderRuns,
} from "../src/utils/message-part"
import { testPartOrderKey } from "./fixtures/timeline-order"

function part(id: string, type: string) {
  return { id, type }
}

describe("message part render order", () => {
  test("keeps execution disclosure identity when later adjacent activity extends the run", () => {
    const first = { ...part("tool-first", "tool"), orderKey: testPartOrderKey("tool-first", 1_776_000_000_100) }
    const later = { ...part("patch-later", "patch"), files: ["src/later.ts"] }

    expect(executionDisclosureKey([first])).toBe(executionDisclosureKey([first, later]))
  })

  test("keeps persisted reasoning out of message-card display runs", () => {
    const reasoning = { ...part("reasoning", "reasoning"), text: "Private runtime evidence" }

    expect(messagePartHasDisplayContent(reasoning)).toBe(false)
    expect(partitionMessagePartRenderRuns([reasoning], true)).toEqual([])
    expect(partitionMessagePartRenderRuns([reasoning], false)).toEqual([
      { kind: "body", parts: [reasoning], startIndex: 0 },
    ])
  })

  test("keeps later narrative after the execution run that preceded it", () => {
    const reasoning = part("reasoning-before", "reasoning")
    reasoning.text = "Inspecting durable Mission state"
    const tool = part("tool-before", "tool")
    const boundary = { type: "boundary", messageID: "msg-later", time: 1_776_000_000_200 }
    const narrative = { ...part("text-later", "text"), text: "The Mission has now dispatched its research task." }

    const runs = partitionMessagePartRenderRuns([reasoning, tool, boundary, narrative], true)

    expect(runs.map((run) => run.kind)).toEqual(["execution", "body"])
    expect(runs[0]?.parts).toEqual([tool])
    expect(runs[0]?.startIndex).toBe(1)
    expect(runs[1]?.parts).toEqual([boundary, narrative])
    expect(runs[1]?.startIndex).toBe(2)
  })

  test("keeps execution runs in source order across intervening narrative", () => {
    const firstText = { ...part("text-first", "text"), text: "Starting" }
    const firstTool = part("tool-first", "tool")
    const laterText = { ...part("text-later", "text"), text: "Continuing" }
    const laterPatch = { ...part("patch-later", "patch"), files: ["src/later.ts"] }

    const runs = partitionMessagePartRenderRuns([firstText, firstTool, laterText, laterPatch], true)

    expect(runs.map((run) => run.kind)).toEqual(["body", "execution", "body", "execution"])
    expect(runs[0]?.parts).toEqual([firstText])
    expect(runs[1]?.parts).toEqual([firstTool])
    expect(runs[2]?.parts).toEqual([laterText])
    expect(runs[3]?.parts).toEqual([laterPatch])
  })

  test("keeps flattened message boundaries between chronological execution runs", () => {
    const firstReasoning = { ...part("reasoning-first", "reasoning"), text: "Inspecting" }
    const firstTool = part("tool-first", "tool")
    const boundary = { type: "boundary", messageID: "message-next", time: 1_776_000_000_200 }
    const narrative = { ...part("text-next", "text"), text: "Continuing after the tool result" }
    const laterTool = part("tool-later", "tool")
    const laterReasoning = { ...part("reasoning-later", "reasoning"), text: "Verifying" }

    const runs = partitionMessagePartRenderRuns(
      [firstReasoning, firstTool, boundary, narrative, laterTool, laterReasoning],
      true,
    )

    expect(runs.map((run) => run.kind)).toEqual(["execution", "body", "execution"])
    expect(runs[0]?.parts).toEqual([firstTool])
    expect(runs[1]?.parts).toEqual([boundary, narrative])
    expect(runs[2]?.parts).toEqual([laterTool])
  })

  test("tool-only and whitespace-only message boundaries have no collapsed narrative body", () => {
    const toolBoundary = { type: "boundary", messageID: "message-tool", time: 1_776_000_000_200 }
    const whitespace = { ...part("text-empty", "text"), text: "   \n  " }
    const tool = part("tool-only", "tool")
    const narrativeBoundary = { type: "boundary", messageID: "message-narrative", time: 1_776_000_000_300 }
    const narrative = { ...part("text-visible", "text"), text: "Visible body" }
    const parts = [toolBoundary, whitespace, tool, narrativeBoundary, narrative]

    expect(boundaryMessageHasNarrativeContent(parts, 0)).toBe(false)
    expect(boundaryMessageHasNarrativeContent(parts, 3)).toBe(true)
    expect(boundaryMessageHasNarrativeContent(parts, 1)).toBe(false)
  })

  test("merges consecutive execution across non-visible tool-only message segments", () => {
    const firstTool = part("tool-first", "tool")
    const toolBoundary = { type: "boundary", messageID: "message-tool", time: 1_776_000_000_200 }
    const whitespace = { ...part("text-empty", "text"), text: "   \n  " }
    const secondTool = part("tool-second", "tool")
    const emptyReasoning = { ...part("reasoning-empty", "reasoning"), text: "[ ]" }
    const thirdTool = part("tool-third", "tool")

    const runs = partitionMessagePartRenderRuns(
      [firstTool, toolBoundary, whitespace, secondTool, emptyReasoning, thirdTool],
      true,
    )

    expect(runs).toEqual([{ kind: "execution", parts: [firstTool, secondTool, thirdTool], startIndex: 0 }])
  })

  test("visible narrative remains the separator between aggregate execution runs", () => {
    const firstTool = part("tool-first", "tool")
    const toolBoundary = { type: "boundary", messageID: "message-tool", time: 1_776_000_000_200 }
    const secondTool = part("tool-second", "tool")
    const narrativeBoundary = { type: "boundary", messageID: "message-narrative", time: 1_776_000_000_300 }
    const narrative = { ...part("text-visible", "text"), text: "Visible body" }
    const thirdTool = part("tool-third", "tool")

    const runs = partitionMessagePartRenderRuns(
      [firstTool, toolBoundary, secondTool, narrativeBoundary, narrative, thirdTool],
      true,
    )

    expect(runs.map((run) => run.kind)).toEqual(["execution", "body", "execution"])
    expect(runs[0]?.parts).toEqual([firstTool, secondTool])
    expect(runs[1]?.parts).toEqual([narrativeBoundary, narrative])
    expect(runs[2]?.parts).toEqual([thirdTool])
  })

  test("does not create execution runs when disclosure is disabled", () => {
    const parts = [{ ...part("text", "text"), text: "Narrative" }, part("tool", "tool")]

    expect(partitionMessagePartRenderRuns(parts, false)).toEqual([{ kind: "body", parts, startIndex: 0 }])
  })
})
