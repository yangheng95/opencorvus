import { afterEach, expect, test } from "bun:test"
import { TaskPlan } from "../../src/memory/task-plan"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { NotFoundError } from "../../src/storage/db"
import { PlannerTool } from "../../src/tool/planner"
import { Tool } from "../../src/tool/tool"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await resetMemoryDatabase()
})

function context(sessionID: string): Tool.Context {
  return {
    sessionID,
    messageID: "planner-contract-message",
    agent: "planner-contract",
    abort: new AbortController().signal,
    messages: [],
    executionSurface: Tool.executionSurface([PlannerTool.id], []),
    extra: { projectID: Instance.project.id },
    metadata() {},
  }
}

async function add(sessionID: string, goal: string, parentId?: string) {
  const tool = await PlannerTool.init()
  const result = await tool.execute({ action: "add_task", goal, parentId }, context(sessionID))
  return JSON.parse(result.output) as { id: string; goal: string; parentID: string | null; status: string }
}

test("current-session planner actions publish the owned tree and progress", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Owned plan" })
      const root = await add(session.id, "Build report")
      const child = await add(session.id, "Read evidence", root.id)
      const tool = await PlannerTool.init()
      const updated = await tool.execute(
        {
          action: "update_task",
          taskId: child.id,
          status: "in_progress",
          progressPct: 25,
          notes: "Reading source",
        },
        context(session.id),
      )
      expect(JSON.parse(updated.output)).toEqual({
        id: child.id,
        goal: "Read evidence",
        status: "in_progress",
        progressPct: 25,
        notes: "Reading source",
      })
      const listed = JSON.parse((await tool.execute({ action: "list_tasks" }, context(session.id))).output)
      expect(listed).toEqual({
        count: 2,
        tree: `<task-plan>\n[ ] Build report [${root.id}]\n  [~] Read evidence (25%) — Reading source [${child.id}]\n</task-plan>\n\nUse the planner tool to update task status, add subtasks, or modify the plan.`,
        tasks: [
          { id: root.id, goal: "Build report", status: "pending", parentID: null, progressPct: 0, notes: null },
          {
            id: child.id,
            goal: "Read evidence",
            status: "in_progress",
            parentID: root.id,
            progressPct: 25,
            notes: "Reading source",
          },
        ],
      })
      expect(TaskPlan.get(session.id, child.id)).toMatchObject({
        sessionID: session.id,
        parentID: root.id,
        progressPct: 25,
      })
    },
  })
})

test("another session receives the explicit task-not-found Tool result", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = await Session.create({ kind: "root", title: "Plan owner" })
      const caller = await Session.create({ kind: "root", title: "Other planner" })
      const root = await add(owner.id, "Owner original goal")
      const tool = await PlannerTool.init()
      const result = await tool.execute(
        {
          action: "update_task",
          taskId: root.id,
          status: "completed",
          notes: "Foreign update",
        },
        context(caller.id),
      )
      expect(result.title).toBe("Task not found")
      expect(JSON.parse(result.output)).toEqual({ error: `Task ${root.id} not found` })
      expect(TaskPlan.list(owner.id).map(({ goal, status, notes }) => ({ goal, status, notes }))).toEqual([
        { goal: "Owner original goal", status: "pending", notes: null },
      ])
    },
  })
})

test("foreign and unknown parents map to the named ownership error", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = await Session.create({ kind: "root", title: "Parent owner" })
      const caller = await Session.create({ kind: "root", title: "Child caller" })
      const parent = await add(owner.id, "Owner parent")
      const tool = await PlannerTool.init()
      for (const parentId of [parent.id, "tsk_unknown_parent"]) {
        const error = await tool
          .execute({ action: "add_task", parentId, goal: "Invalid child" }, context(caller.id))
          .catch((error: unknown) => error)
        expect(error).toBeInstanceOf(NotFoundError)
        expect((error as InstanceType<typeof NotFoundError>).data).toEqual({
          message: `Parent task ${parentId} not found for session ${caller.id}`,
        })
      }
      const callerRoot = await add(caller.id, "Caller root")
      const child = await add(caller.id, "Caller child", callerRoot.id)
      expect(TaskPlan.list(caller.id).map(({ id, parentID, goal }) => ({ id, parentID, goal }))).toEqual([
        { id: callerRoot.id, parentID: null, goal: "Caller root" },
        { id: child.id, parentID: callerRoot.id, goal: "Caller child" },
      ])
    },
  })
})

test("independent projects retain their own planner writes", async () => {
  await using first = await memoryProject("planner-first")
  await using second = await memoryProject("planner-second")
  let ownerSession = ""
  let ownerTask = ""
  const projectIDs: string[] = []
  await Instance.provide({
    directory: first.path,
    fn: async () => {
      projectIDs.push(Instance.project.id)
      ownerSession = (await Session.create({ kind: "root", title: "First project plan" })).id
      ownerTask = (await add(ownerSession, "First project goal")).id
    },
  })
  await Instance.provide({
    directory: second.path,
    fn: async () => {
      projectIDs.push(Instance.project.id)
      const caller = await Session.create({ kind: "root", title: "Second project plan" })
      const tool = await PlannerTool.init()
      const result = await tool.execute(
        { action: "update_task", taskId: ownerTask, status: "cancelled" },
        context(caller.id),
      )
      expect(JSON.parse(result.output)).toEqual({ error: `Task ${ownerTask} not found` })
      const local = await add(caller.id, "Second project goal")
      const update = await tool.execute(
        { action: "update_task", taskId: local.id, status: "completed" },
        context(caller.id),
      )
      expect(JSON.parse(update.output)).toMatchObject({
        id: local.id,
        goal: "Second project goal",
        status: "completed",
      })
    },
  })
  expect(new Set(projectIDs).size).toBe(2)
  await Instance.provide({
    directory: first.path,
    fn: async () => {
      expect(TaskPlan.list(ownerSession).map(({ goal, status }) => ({ goal, status }))).toEqual([
        { goal: "First project goal", status: "pending" },
      ])
    },
  })
})

test("root and assistant sessions settle concurrent tool updates in their own plans", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const root = await Session.create({ kind: "root", title: "Root plan" })
      const assistant = await Session.create({ kind: "assistant", parentID: root.id, title: "Assistant plan" })
      const rootTask = await add(root.id, "Root goal")
      const assistantTask = await add(assistant.id, "Assistant goal")
      const tool = await PlannerTool.init()
      const results = await Promise.all([
        tool.execute(
          { action: "update_task", taskId: rootTask.id, status: "completed", progressPct: 100 },
          context(root.id),
        ),
        tool.execute(
          { action: "update_task", taskId: assistantTask.id, status: "blocked", notes: "Needs evidence" },
          context(assistant.id),
        ),
      ])
      expect(results.map((result) => JSON.parse(result.output))).toEqual([
        { id: rootTask.id, goal: "Root goal", status: "completed", progressPct: 100, notes: null },
        { id: assistantTask.id, goal: "Assistant goal", status: "blocked", progressPct: 0, notes: "Needs evidence" },
      ])
    },
  })
})

test("owned updates survive instance disposal and persisted reload", async () => {
  await using project = await memoryProject()
  let sessionID = ""
  let taskID = ""
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      sessionID = (await Session.create({ kind: "root", title: "Persisted plan" })).id
      taskID = (await add(sessionID, "Persisted goal")).id
      expect(TaskPlan.update(sessionID, taskID, { notes: "Saved evidence", progressPct: 60 })).toMatchObject({
        id: taskID,
        sessionID,
        notes: "Saved evidence",
        progressPct: 60,
      })
    },
  })
  await Instance.disposeAll()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      expect(TaskPlan.get(sessionID, taskID)).toMatchObject({
        id: taskID,
        sessionID,
        goal: "Persisted goal",
        notes: "Saved evidence",
        progressPct: 60,
      })
    },
  })
})

test("scoped removal returns a named error or the remaining owned root tree", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = await Session.create({ kind: "root", title: "Removal owner" })
      const caller = await Session.create({ kind: "root", title: "Removal caller" })
      const root = TaskPlan.add({ sessionID: owner.id, goal: "Keep root" })
      const leaf = TaskPlan.add({ sessionID: owner.id, goal: "Remove leaf", parentID: root.id })
      let error: unknown
      try {
        TaskPlan.remove(caller.id, leaf.id)
      } catch (reason) {
        error = reason
      }
      expect(error).toBeInstanceOf(NotFoundError)
      expect((error as InstanceType<typeof NotFoundError>).data).toEqual({
        message: `Task ${leaf.id} not found for session ${caller.id}`,
      })
      TaskPlan.remove(owner.id, leaf.id)
      expect(TaskPlan.list(owner.id).map(({ id, goal, parentID }) => ({ id, goal, parentID }))).toEqual([
        { id: root.id, goal: "Keep root", parentID: null },
      ])
      expect(TaskPlan.toMarkdown(owner.id)).toBe(
        `<task-plan>\n[ ] Keep root [${root.id}]\n</task-plan>\n\nUse the planner tool to update task status, add subtasks, or modify the plan.`,
      )
    },
  })
})
