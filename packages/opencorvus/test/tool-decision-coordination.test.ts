import { describe, expect, test } from "bun:test"
import { ToolTurnExecutionConflictError, ToolTurnExecutionCoordinator } from "@/tool/execution-mode"

/**
 * The durable reduction accepts one assistant turn's decision set only when it
 * is a `dispatch_agent` fan-out or a single other decision. Anything mixed is
 * an integrity conflict, which is absorbing: the ingress blocks permanently
 * and head-of-line blocks every later one. A model can emit that combination
 * in ordinary output, so it has to be refused before it becomes a fact.
 */
describe("assistant-turn decision coordination", () => {
  async function attempt(coordinator: ToolTurnExecutionCoordinator, command: string, commits = true) {
    try {
      await coordinator.run("ordinary", async () => `${command}:ok`, { command, commits })
      return "committed"
    } catch (error) {
      return error instanceof ToolTurnExecutionConflictError ? "refused" : `unexpected:${String(error)}`
    }
  }

  test("admits a dispatch_agent fan-out", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    const outcomes = [
      await attempt(coordinator, "dispatch_agent"),
      await attempt(coordinator, "dispatch_agent"),
      await attempt(coordinator, "dispatch_agent"),
    ]
    expect(outcomes).toEqual(["committed", "committed", "committed"])
  })

  test("refuses a second, different decision in the same turn", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    expect([
      await attempt(coordinator, "dispatch_agent"),
      await attempt(coordinator, "wait"),
      await attempt(coordinator, "no_action"),
    ]).toEqual(["committed", "refused", "refused"])
  })

  test("refuses a dispatch that follows a settling decision", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    expect([await attempt(coordinator, "manage_task"), await attempt(coordinator, "dispatch_agent")]).toEqual([
      "committed",
      "refused",
    ])
  })

  test("never conflicts on Tools whose completion is not itself a decision", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    expect([
      // `question` and a coordination redispatch return an operator fact and
      // still owe the next decision, so they claim nothing.
      await attempt(coordinator, "question", false),
      await attempt(coordinator, "respond_agent_coordination", false),
      await attempt(coordinator, "wait"),
    ]).toEqual(["committed", "committed", "committed"])
  })

  test("releases the claim when the first decision fails so the turn can still decide", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    const failed = await coordinator
      .run(
        "ordinary",
        async () => {
          throw new Error("dispatch adapter unavailable")
        },
        { command: "dispatch_agent", commits: true },
      )
      .then(() => "committed")
      .catch((error) => (error as Error).message)
    // A failed call leaves no completed receipt, so it is not in the durable
    // decision set and must not fence the turn's fallback decision.
    expect({ failed, fallback: await attempt(coordinator, "no_action") }).toEqual({
      failed: "dispatch adapter unavailable",
      fallback: "committed",
    })
  })
})
