import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { TodoStore } from "../../src/session/todo-store"
import { TodoTool } from "../../src/tool/todo"
import { Tool } from "../../src/tool/tool"
import { PanelLeafTools, createPanelUIRequestToolContext } from "../../src/tool/panel"
import { EngineService } from "../../src/task-api"
import { Identifier } from "../../src/id/id"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { findInteractionByExternal } from "../../src/engine/store"
import { Question } from "../../src/question"
import { PanelQueryTaskOutput } from "../../src/panel/task-query"
import { ControlLocalAction } from "../../src/control/message-schema"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { persistEstablishedTask } from "../fixture/engine-task"

afterEach(resetMemoryDatabase)

async function panel(name: string) {
  const definition = PanelLeafTools.find((tool) => tool.id === name)
  if (!definition) throw new Error(`Missing consolidated Tool ${name}`)
  return definition.init({ agentID: "panel_ui" })
}

function panelContext() {
  return createPanelUIRequestToolContext({ surface: "panel", requestID: crypto.randomUUID() })
}

async function taskFixture() {
  const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Consolidated query" })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const packageRevision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "base",
    version: "2026.09.03.1",
    packageDigest: "a".repeat(64),
  }
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: root.title,
    request: "Exercise consolidated tools",
    productPillar: "work",
    source: "test",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  return { root, taskID }
}

describe("consolidated built-in tool effects", () => {
  test("todo reads, replaces, completes and clears the canonical Session checklist", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Checklist" })
        const other = await Session.create({ kind: "assistant", title: "Other checklist" })
        const tool = await TodoTool.init()
        const context: Tool.Context = {
          sessionID: session.id,
          messageID: "checklist-message",
          agent: "chat",
          abort: new AbortController().signal,
          messages: [],
          executionSurface: Tool.executionSurface(["todo"], []),
          metadata() {},
        }
        expect(JSON.parse((await tool.execute({ action: "read" }, context)).output)).toEqual([])
        const todos = [
          { content: "Verify tool consolidation", status: "in_progress" as const, priority: "high" as const },
        ]
        const written = await tool.execute({ action: "write", todos }, context)
        expect({ output: JSON.parse(written.output), persisted: TodoStore.get(session.id) }).toEqual({
          output: todos,
          persisted: todos,
        })
        expect(JSON.parse((await tool.execute({ action: "read" }, context)).output)).toEqual(todos)
        const completed = todos.map((item) => ({ ...item, status: "completed" as const }))
        expect((await tool.execute({ action: "write", todos: completed }, context)).metadata.todos).toEqual(completed)
        expect(
          JSON.parse((await tool.execute({ action: "read" }, { ...context, sessionID: other.id })).output),
        ).toEqual([])
        expect((await tool.execute({ action: "write", todos: [] }, context)).metadata.todos).toEqual([])
      },
    })
  })

  test("Task query returns list identities and explicit status with selected board and plan details", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, root } = await taskFixture()
        const tool = await panel("panel_query_task")
        const listed = PanelQueryTaskOutput.parse(JSON.parse((await tool.execute({}, panelContext())).output))
        expect(listed).toEqual({ tasks: [{ taskID, title: root.title, status: "active" }] })
        const detail = await tool.execute(
          { taskIDs: [taskID], include: ["board", "plan"], includeInteractions: true },
          panelContext(),
        )
        expect(PanelQueryTaskOutput.parse(JSON.parse(detail.output))).toMatchObject({
          tasks: [
            {
              taskID,
              title: root.title,
              status: "active",
              result: { status: "active" },
              pendingInteractions: 0,
              board: expect.any(Object),
              plan: { goals: [], artifacts: [] },
            },
          ],
        })
      },
    })
  })

  for (const kind of ["answer", "reject"] as const) {
    test(`interaction response ${kind} settles the actual Question and persisted interaction`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          EngineService.init()
          const { root, taskID } = await taskFixture()
          const questionID = Identifier.ascending("question")
          const pending = Question.ask({
            sessionID: root.id,
            requestID: questionID,
            expireOnDeadline: false,
            questions: [{ header: "Delivery", question: "Preferred output?", options: [] }],
          }).catch((error) => error)
          let interaction = findInteractionByExternal(questionID)
          for (let attempt = 0; !interaction && attempt < 80; attempt++) {
            await Bun.sleep(25)
            interaction = findInteractionByExternal(questionID)
          }
          if (!interaction) throw new Error("Real Question was not projected")
          const tool = await panel("panel_respond_interaction")
          const response = await tool.execute(
            { interactionID: interaction.id, response: { kind, message: "Markdown" } },
            panelContext(),
          )
          expect(JSON.parse(response.output)).toMatchObject({
            kind: "interaction",
            task_id: taskID,
            interaction_id: interaction.id,
          })
          expect(findInteractionByExternal(questionID)?.status).toBe(kind === "answer" ? "answered" : "rejected")
          const result = await pending
          if (kind === "answer") expect(result).toEqual([["Markdown"]])
          else expect(result).toBeInstanceOf(Question.RejectedError)
        },
      })
    })
  }

  for (const kind of ["allow_once", "allow_project"] as const) {
    test(`interaction response maps ${kind} to the exact permission decision contract`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const calls: unknown[] = []
          const reply = spyOn(EngineService, "replyInteraction").mockImplementation(async (id, input) => {
            calls.push({ id, input })
            return { id, taskID: "task-permission" } as Awaited<ReturnType<typeof EngineService.replyInteraction>>
          })
          try {
            const tool = await panel("panel_respond_interaction")
            await tool.execute({ interactionID: "interaction-permission", response: { kind } }, panelContext())
            expect(calls).toEqual([{ id: "interaction-permission", input: { decision: kind, autoReply: false } }])
          } finally {
            reply.mockRestore()
          }
        },
      })
    })
  }

  test("workspace selection emits the exact local Task and Session actions", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const tool = await panel("panel_select_workspace")
        for (const kind of ["task", "session"] as const) {
          const id = `selected-${kind}`
          const response = JSON.parse((await tool.execute({ target: { kind, id } }, panelContext())).output)
          expect(ControlLocalAction.parse(response.local_action)).toEqual(
            kind === "task" ? { type: "select_task", taskID: id } : { type: "select_session", sessionID: id },
          )
        }
        await expect(
          tool.execute(
            { target: { kind: "session", id: "selected-session" } },
            createPanelUIRequestToolContext({ surface: "slack", requestID: crypto.randomUUID() }),
          ),
        ).rejects.toThrow("not permitted for actor panel_ui on surface slack")
      },
    })
  })
})
