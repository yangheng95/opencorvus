import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

// Public HTTP evidence for this dated occurrence. Goal controls are operated manually in /ui.
const root = import.meta.dir
const read = async (name: string) => JSON.parse(await fs.readFile(path.join(root, name), "utf8"))
const ready = await read("ready.json")
const preflight = await read("preflight.json")
const [action, kind, label = kind] = process.argv.slice(2)
async function request(route: string, directory: string, input?: unknown, expectedStatus = 200) {
  const url = new URL(route, ready.url)
  url.searchParams.set("directory", directory)
  const response = await fetch(url, {
    method: input === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    signal: AbortSignal.timeout(30_000),
  })
  const body = await response.json() as any
  assert.equal(response.status, expectedStatus, JSON.stringify({ route, status: response.status, body }))
  return body
}
async function owner(kind: string) {
  if (kind === "chat") return { kind, id: preflight.session.id, sessionID: preflight.session.id, directory: preflight.session.directory }
  return read(`${kind}-owner.json`)
}
async function fact(kind: string) {
  const target = await owner(kind)
  const goal = await request(`/continuous-goal/${kind}/${target.id}`, target.directory)
  const conversation = await request(kind === "task" ? `/task/${target.id}/conversation` : `/session/${target.sessionID}/conversation`, target.directory)
  return { observedAt: Date.now(), owner: target, goal, conversation }
}
if (action === "seed") {
  assert(["task", "mission"].includes(kind!))
  const setup = "当前合并版本持续目标验收准备。只回复‘准备好了’，正常结束这次输入，稍后用户通过界面设置目标。禁止委派 Agent、创建子 Task、定时等待、外站、文件修改、部署、凭据或权限操作。"
  const input = kind === "task" ? {
    requestID: crypto.randomUUID(), productPillar: "code", title: "当前基线 Goal Task 验收",
    source: "continuous-goal-final-acceptance", promptProfile: "base", model: ready.sourceModel,
    request: setup + " 使用 no_action 正常结算本次准备输入。",
  } : {
    requestID: crypto.randomUUID(), productPillar: "work", model: ready.sourceModel,
    text: setup + " 保持 Mission opened，不调用完成 Mission。", expertSquadIDs: ["base"],
  }
  await fs.writeFile(path.join(root, `${kind}-seed-input.json`), JSON.stringify(input, null, 2) + "\n")
  const result = await request(kind === "task" ? "/task" : "/mission/wake", ready.project, input, kind === "task" ? 202 : 200)
  const id = kind === "task" ? result.task_id : result.sessionID
  const board = kind === "task" ? await request(`/task/${id}`, ready.project) : undefined
  const sessionID = kind === "task" ? board.sessionID : id
  assert.equal(typeof id, "string")
  assert.equal(typeof sessionID, "string")
  await fs.writeFile(path.join(root, `${kind}-owner.json`), JSON.stringify({ kind, id, sessionID, directory: ready.project, input, result, board }, null, 2) + "\n")
  console.log(JSON.stringify({ kind, id, sessionID }))
} else if (action === "recover-task") {
  assert(kind?.startsWith("tsk_"))
  const board = await request(`/task/${kind}`, ready.project)
  assert.equal(typeof board.sessionID, "string")
  const conversation = await request(`/task/${kind}/conversation`, ready.project)
  await fs.writeFile(path.join(root, "task-owner.json"), JSON.stringify({ kind: "task", id: kind, sessionID: board.sessionID, directory: ready.project, board, recoveredAcceptedTask: true, conversation }, null, 2) + "\n")
  console.log(JSON.stringify({ kind: "task", id: kind, sessionID: board.sessionID, messages: conversation.transcript.length }))
} else if (action === "read") {
  assert(["chat", "task", "mission"].includes(kind!))
  const result = await fact(kind!)
  await fs.writeFile(path.join(root, `${kind}-${label}-fact.json`), JSON.stringify(result, null, 2) + "\n")
  console.log(JSON.stringify({ kind, goal: result.goal, messages: result.conversation.transcript.length }))
} else if (action === "verify") {
  assert(["before-restart", "after-restart"].includes(kind!))
  const facts = []
  for (const kind of ["chat", "task", "mission"]) {
    const current = await fact(kind)
    assert.equal(current.goal.status, "complete", kind)
    assert.equal(current.goal.turnsAccepted, 2, kind)
    assert.equal(current.goal.turnBudget, 2, kind)
    assert.deepEqual(current.goal.owner, { kind, id: current.owner.id })
    assert(current.goal.tokensUsed > 0)
    assert(current.goal.reason.trim().length > 0)
    const controllers = current.conversation.transcript.filter((entry: any) => entry.info.author === "goal-controller")
    assert.equal(controllers.length, 2, kind)
    for (const controller of controllers) {
      const display = current.conversation.view.messages.find((entry: any) => entry.messageID === controller.info.id)
      assert.equal(display?.stage, "user")
      assert.equal(controller.info.role, "user")
      const reply = current.conversation.transcript.find((entry: any) => entry.info.role === "assistant" &&
        (kind === "task" ? entry.parts.some((part: any) => part.type === "tool" && part.tool === "read_task_message" &&
          part.state.status === "completed" && part.state.input.message_id === controller.info.id) : entry.info.parentID === controller.info.id))
      assert(reply?.info.time.completed, "Real settled reply for the exact accepted controller input")
      assert(reply.parts.some((part: any) => part.type === "text" && part.text.trim()))
      if (kind === "task")
        assert(reply.parts.some((part: any) => part.type === "tool" && part.tool === "no_action" && part.state.status === "completed"))
    }
    if (kind === "task") {
      const paused = await read("task-paused-settled-fact.json")
      assert.equal(paused.goal.status, "paused")
      assert.equal(paused.goal.turnsAccepted, 1)
      assert(paused.goal.tokensUsed > 0)
      assert.equal(paused.goal.id, current.goal.id)
      const settled = paused.conversation.transcript.find((entry: any) => entry.info.role === "assistant" &&
        entry.parts.some((part: any) => part.type === "tool" && part.tool === "read_task_message" &&
          part.state.status === "completed" && part.state.input.message_id === controllers[0].info.id))
      assert(settled.info.time.completed > paused.goal.updatedAt, "The admitted reply settled after explicit pause")
    }
    if (process.argv[3] === "after-restart") {
      const before = await read("before-restart.json")
      assert.deepEqual(current.goal, before.facts.find((entry: any) => entry.owner.kind === kind).goal, "Exact durable goal after cold restart")
    }
    facts.push(current)
  }
  await fs.writeFile(path.join(root, `${kind}.json`), JSON.stringify({ status: "passed", baseline: ready.baseline, observedAt: Date.now(), facts }, null, 2) + "\n")
  console.log(JSON.stringify({ status: "passed", stage: kind, goals: 3, acceptedTurns: 6 }))
} else throw new Error("Use seed task/mission, read chat/task/mission label, or verify before-restart/after-restart")
