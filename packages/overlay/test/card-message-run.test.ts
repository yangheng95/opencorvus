import { expect, test } from "bun:test"

import { partitionCardMessageRuns } from "../src/utils/card-message-run"

test("flattened card messages keep exact message ownership without repeated role parts", () => {
  const runs = partitionCardMessageRuns(
    [
      { id: "boundary-1", type: "boundary", messageID: "message-1", roleLabel: "Architect", time: 1000 },
      { id: "text-1", type: "text", messageID: "message-1", text: "First message" },
      { id: "boundary-2", type: "boundary", messageID: "message-2", roleLabel: "Architect", time: 2000 },
      { id: "text-2", type: "text", messageID: "message-2", text: "Second message" },
    ],
    [],
  )

  expect(runs).toEqual([
    {
      key: "message:message-1",
      messageID: "message-1",
      collapsedContext: false,
      parts: [{ id: "text-1", type: "text", messageID: "message-1", text: "First message" }],
    },
    {
      key: "message:message-2",
      messageID: "message-2",
      collapsedContext: false,
      parts: [{ id: "text-2", type: "text", messageID: "message-2", text: "Second message" }],
    },
  ])
  expect(runs.flatMap((run) => run.parts).some((part) => part.type === "boundary")).toBe(false)
})

test("message grouping preserves the exact delegated-context owner", () => {
  const [run] = partitionCardMessageRuns(
    [
      { id: "boundary", type: "boundary", messageID: "delegated", roleLabel: "Architect", time: 3000 },
      { id: "text", type: "text", messageID: "delegated", text: "Delegated context" },
    ],
    ["delegated"],
  )

  expect(run?.collapsedContext).toBe(true)
  expect(run?.messageID).toBe("delegated")
})

test("tool-only message boundaries stay transparent to execution aggregation", () => {
  const runs = partitionCardMessageRuns(
    [
      { id: "tool-1", type: "tool", messageID: "message-1" },
      { id: "boundary", type: "boundary", messageID: "message-2", roleLabel: "Architect", time: 4000 },
      { id: "tool-2", type: "tool", messageID: "message-2" },
    ],
    [],
  )

  expect(runs).toHaveLength(1)
  expect(runs[0]?.parts.map((part) => part.id)).toEqual(["tool-1", "tool-2"])
})
