import fs from "node:fs/promises"
import path from "node:path"

// Manual acceptance evidence only: public HTTP owner setup and authoritative
// reads. All continuous-goal UI interactions are performed in the real browser.
const root = import.meta.dir
const ready = JSON.parse(await fs.readFile(path.join(root, "runtime-2/ready.json"), "utf8"))
const preflight = JSON.parse(await fs.readFile(path.join(root, "runtime-2/preflight.json"), "utf8"))
const [action, label = action] = process.argv.slice(2)
const ownerFile = (kind: string) => path.join(root, `${kind}-owner.json`)
async function request(route: string, directory: string, body?: unknown, method = "POST") {
  const url = new URL(route, ready.url)
  url.searchParams.set("directory", directory)
  const response = await fetch(url, {
    method: body ? method : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(JSON.stringify({ status: response.status, result }))
  return result
}
const setupInput =
  "持续目标 UI/UX 隔离验收准备。本轮只回复‘准备好了’并正常结束当前输入，暂不创建持续目标，保持会话可继续。禁止委派 Agent、创建子 Task、定时等待、外部网站、文件修改、部署、凭据或权限操作。"
if (action === "seed-task" || action === "seed-mission") {
  const kind = action.slice(5)
  const input =
    kind === "task"
      ? {
          requestID: crypto.randomUUID(),
          productPillar: "code",
          title: "持续目标 UI Task 验收",
          source: "continuous-goal-ui-acceptance",
          promptProfile: "base",
          request: setupInput + " 本 Task 当前负责人用 no_action 结算这次准备输入，稍后用户从界面设置目标。",
          model: ready.sourceModel,
        }
      : {
          requestID: crypto.randomUUID(),
          productPillar: "work",
          text: setupInput + " 保持本 Mission opened，不调用完成 Mission；稍后用户从界面设置目标。",
          model: ready.sourceModel,
          expertSquadIDs: ["base"],
        }
  const result = await request(kind === "task" ? "/task" : "/mission/wake", ready.project, input)
  const id = kind === "task" ? result.task_id : result.sessionID
  const board = kind === "task" ? await request(`/task/${id}`, ready.project) : undefined
  const sessionID =
    kind === "task" ? (board.sessionID ?? board.session_id ?? board.task?.sessionID ?? board.task?.session_id) : id
  if (!id || !sessionID) throw new Error(`Canonical ${kind} owner identity missing`)
  await fs.writeFile(
    ownerFile(kind),
    JSON.stringify({ kind, id, sessionID, directory: ready.project, input, result, board }, null, 2) + "\n",
  )
  console.log(JSON.stringify({ kind, id, sessionID, directory: ready.project }))
} else {
  const kind = action === "read-chat" ? "chat" : action?.slice(5)
  if (!["chat", "task", "mission", "sidechat"].includes(kind))
    throw new Error("Use seed-task, seed-mission or read-chat/task/mission/sidechat")
  const owner =
    kind === "chat"
      ? { kind, id: preflight.session.id, sessionID: preflight.session.id, directory: preflight.session.directory }
      : JSON.parse(await fs.readFile(ownerFile(kind), "utf8"))
  const goal = await request(`/continuous-goal/${kind === "sidechat" ? "chat" : kind}/${owner.id}`, owner.directory)
  const conversation = await request(
    kind === "task" ? `/task/${owner.id}/conversation` : `/session/${owner.sessionID}/conversation`,
    owner.directory,
  )
  const messages =
    kind === "task" ? conversation.transcript : await request(`/session/${owner.sessionID}/message`, owner.directory)
  const ledger = await request("/work-ledger", owner.directory)
  const result = { observedAt: Date.now(), owner, goal, messages, conversation, ledger }
  await fs.writeFile(path.join(root, `${label}.json`), JSON.stringify(result, null, 2) + "\n")
  console.log(
    JSON.stringify({ owner: { kind, id: owner.id, sessionID: owner.sessionID }, goal, messages: messages.length }),
  )
}
