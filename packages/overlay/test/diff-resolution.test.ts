import { describe, expect, test } from "bun:test"
import type { ChangeGroup } from "../src/services/diff"
import { resolveDiff } from "../src/services/diff"

describe("diff resolution", () => {
  test("resolves the selected live group from the visible change collection", async () => {
    const groups: ChangeGroup[] = [
      {
        id: "agent:planner",
        agentID: "planner",
        additions: 1,
        deletions: 1,
        changes: [
          {
            file: "specs/README.md",
            status: "modified",
            additions: 1,
            deletions: 1,
            before: "planner before",
            after: "planner after",
          },
        ],
      },
      {
        id: "agent:chat",
        agentID: "chat",
        additions: 1,
        deletions: 1,
        changes: [
          {
            file: "specs/README.md",
            status: "modified",
            additions: 1,
            deletions: 1,
            before: "chat before",
            after: "chat after",
          },
        ],
      },
    ]

    const change = await resolveDiff({ filePath: "specs/README.md", groupID: "agent:chat", agentID: "chat" }, groups)

    expect(change).toEqual(groups[1]!.changes[0]!)
  })
})
