import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

// Public backend checker for the real owners exercised manually in /ui.
// This does not control, render, inspect, or assert anything about the UI.
const root = import.meta.dir
const read = async (name: string) => JSON.parse(await fs.readFile(path.join(root, name), "utf8"))
const ready = await read("runtime-2/ready.json")
async function get(route: string, directory: string) {
  const url = new URL(route, ready.url)
  url.searchParams.set("directory", directory)
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  assert.equal(response.status, 200, `Real public read: ${route}`)
  return response.json()
}
const recorded = [
  ["chat-complete-fact.json", 2],
  ["chat-new-goal-complete-fact.json", 1],
  ["task-complete-fact.json", 3],
  ["mission-complete-fact.json", 2],
  ["sidechat-complete-fact.json", 1],
  ["mission-locale-complete-fact.json", 1],
] as const
const goals = []
for (const [file, turns] of recorded) {
  const fact = await read(file)
  assert.equal(fact.goal.status, "complete", file)
  assert.equal(fact.goal.turnsAccepted, turns, file)
  assert.equal(fact.goal.owner.id, fact.owner.id, file)
  assert.equal(typeof fact.goal.reason, "string", file)
  assert(fact.goal.reason.trim().length > 0, `Completion has actual evidence: ${file}`)
  assert(fact.goal.tokensUsed > 0, `Real accounted usage: ${file}`)
  goals.push({ file, goalID: fact.goal.id, owner: fact.goal.owner, turns, tokens: fact.goal.tokensUsed })
}
assert.equal(new Set(goals.map((goal) => goal.goalID)).size, recorded.length, "Each finished goal has its own identity")
const before = await read("mission-reason-precondition.json")
const retained = await read("mission-reason-retained-fact.json")
assert.equal(retained.goal.status, "blocked")
assert.equal(retained.goal.reason, before.input.reason, "Budget-only save retains the actual blocker")
assert.equal(retained.goal.tokenBudget, 200000)
assert.equal(retained.goal.turnBudget, 3)
const paused = await read("task-paused-fact.json")
assert.equal(paused.goal.status, "paused")
assert.equal(paused.goal.turnsAccepted, 2)
assert(paused.goal.tokensUsed > 0, "Accepted work settles while the goal is paused")
const live = await Promise.all(
  ["chat", "task", "mission", "sidechat"].map(async (label) => {
    const owner =
      label === "chat" ? (await read("chat-new-goal-complete-fact.json")).owner : await read(`${label}-owner.json`)
    const kind = label === "sidechat" ? "chat" : label
    const [goal, conversation] = await Promise.all([
      get(`/continuous-goal/${kind}/${owner.id}`, owner.directory),
      get(
        kind === "task" ? `/task/${owner.id}/conversation` : `/session/${owner.sessionID}/conversation`,
        owner.directory,
      ),
    ])
    assert.equal(goal.status, "complete", label)
    assert.deepEqual(goal.owner, { kind, id: owner.id }, label)
    const messages = conversation.transcript
    const controllers = messages.filter(
      (message: any) =>
        message.info.author === "goal-controller" &&
        (kind === "task"
          ? message.info.extra?.task_root_message?.taskID === owner.id
          : message.info.extra?.wake_reason?.goalID === goal.id),
    )
    assert.equal(controllers.length, goal.turnsAccepted, `Actual continuation authors for ${label}`)
    for (const controller of controllers) {
      const projected = conversation.view.messages.find((message: any) => message.messageID === controller.info.id)
      assert.equal(projected?.stage, "user", `Independent participant projection: ${controller.info.id}`)
      assert.equal(controller.info.role, "user", "Provider input role is preserved independently from authorship")
      if (kind !== "task") {
        const reply = messages.find(
          (message: any) => message.info.role === "assistant" && message.info.parentID === controller.info.id,
        )
        assert(reply?.info.time.completed, `The real continuation reply completed for ${label}`)
        assert(
          reply.parts.some((part: any) => part.type === "text" && part.text.trim()),
          `The real reply has content for ${label}`,
        )
      }
    }
    return { label, owner: { kind, id: owner.id }, goal, conversation }
  }),
)
const result = {
  status: "passed",
  observedAt: Date.now(),
  recordedGoals: goals,
  acceptedTurns: goals.reduce((sum, goal) => sum + goal.turns, 0),
  liveOwners: live,
  reasonPreservation: "passed",
  pauseSettlement: "passed",
}
await fs.writeFile(path.join(root, "live-acceptance.json"), JSON.stringify(result, null, 2) + "\n")
console.log(
  JSON.stringify({
    status: result.status,
    goals: goals.length,
    acceptedTurns: result.acceptedTurns,
    liveOwners: live.length,
    reasonPreservation: result.reasonPreservation,
    pauseSettlement: result.pauseSettlement,
  }),
)
