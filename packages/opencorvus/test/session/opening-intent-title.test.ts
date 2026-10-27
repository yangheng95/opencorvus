import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { createRightSidebarConversationSession } from "@/chat/session"
import { createContinuousGoal, resolveGoalOwner } from "@/continuous-goal/store"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { setSessionTitleFromFirstUserMessage } from "@/session/first-message-title"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

test.each(["chat", "work", "mission"] as const)(
  "%s names the original outcome while retaining its visible launch references",
  async (kind) => {
    await using project = await memoryProject(`opening-reference-${kind}`)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session =
          kind === "mission"
            ? await ensureMissionSession({
                missionID: randomUUID(),
                defaultCwd: project.path,
                productPillar: "work",
                heldExpertSquadIDs: ["base"],
              })
            : await createRightSidebarConversationSession(kind)
        const text = '@squad("base") @skill("review")\n核对本地订单\n说明计算依据'
        const original = await message(session.id, "user", text)
        await setSessionTitleFromFirstUserMessage(original)
        expect(await Session.get(session.id)).toMatchObject({
          id: session.id,
          projectID: session.projectID,
          title: "核对本地订单",
          metadata: session.metadata,
        })
        expect(await Session.messages({ sessionID: session.id })).toMatchObject([
          { info: { id: original.messageID, author: "user" }, parts: [{ type: "text", text }] },
        ])
      },
    })
  },
)

test("a Goal title uses the outcome while its structured objective keeps the references", async () => {
  await using project = await memoryProject("opening-reference-goal")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await createRightSidebarConversationSession("work")
      const objective = '@squad("base")\n核对本地订单'
      const goal = createContinuousGoal(
        resolveGoalOwner({ kind: "chat", id: session.id }),
        { requestID: "reference-title", objective, turnBudget: 1 },
        "user",
      )
      expect({
        title: (await Session.get(session.id)).title,
        owner: goal.owner,
        objective: goal.objective,
      }).toMatchObject({ title: "核对本地订单", owner: { kind: "chat", id: session.id }, objective })
    },
  })
})

async function message(sessionID: string, author: string, text: string) {
  const id = Identifier.ascending("message")
  const parts = [{ id: Identifier.ascending("part"), sessionID, messageID: id, type: "text" as const, text }]
  await Session.persistMessage({
    info: {
      id,
      sessionID,
      role: "user",
      author,
      agent: "work",
      model: { providerID: "test", modelID: "title" },
      time: { created: Date.now() },
    },
    parts,
  })
  return { sessionID, messageID: id, parts }
}

test("a Goal names each default conversation from its structured outcome", async () => {
  await using project = await memoryProject("opening-goal-title")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const missionID = randomUUID()
      const mission = await ensureMissionSession({
        missionID,
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      Database.immediateTransaction(() =>
        ProtocolStore.appendEventInTransaction({
          kind: "event",
          type: "mission.execution.opened",
          aggregate: "session",
          aggregate_id: mission.id,
          source: "mission.wake",
          correlation_id: randomUUID(),
          payload: { missionID, requestID: "title-open", requestFingerprint: "a".repeat(64) },
        }),
      )
      const conversations = [
        await createRightSidebarConversationSession("chat"),
        await createRightSidebarConversationSession("work"),
        await Session.create({ kind: "assistant" }),
        mission,
      ]
      for (const session of conversations) {
        const owner = resolveGoalOwner({ kind: session.kind === "mission" ? "mission" : "chat", id: session.id })
        const goal = createContinuousGoal(
          owner,
          { requestID: "title", objective: "验证用户成果命名\n保留实际消息和执行合同", turnBudget: 1 },
          "user",
        )
        const current = await Session.get(session.id)
        expect({
          id: current.id,
          projectID: current.projectID,
          title: current.title,
          metadata: current.metadata,
          objective: goal.objective,
        }).toEqual({
          id: session.id,
          projectID: session.projectID,
          title: "验证用户成果命名",
          metadata: session.metadata,
          objective: "验证用户成果命名\n保留实际消息和执行合同",
        })
      }
    },
  })
})

test("a Goal and its replay retain the operator's current title and exact identity", async () => {
  await using project = await memoryProject("opening-custom-title")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await createRightSidebarConversationSession("work", { title: "用户自选项目成果" })
      const owner = resolveGoalOwner({ kind: "chat", id: session.id })
      const input = { requestID: "title-replay", objective: "另一项持续目标", turnBudget: 1 }
      const goal = createContinuousGoal(owner, input, "user")
      expect((await Session.get(session.id)).title).toBe("用户自选项目成果")
      await Session.setTitle({ sessionID: session.id, title: "执行期间的新名称" })
      expect(createContinuousGoal(owner, input, "user")).toEqual(goal)
      expect(await Session.get(session.id)).toMatchObject({
        id: session.id,
        title: "执行期间的新名称",
        metadata: session.metadata,
      })
    },
  })
})

test("the first human input supplies the title after host inputs and multiple accepted humans", async () => {
  await using project = await memoryProject("opening-human-title")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await createRightSidebarConversationSession("work")
      const host = await message(session.id, "goal-controller", "Technical controller input")
      await setSessionTitleFromFirstUserMessage(host)
      const first = await message(session.id, "user", "真正的首个人类成果\n下一行说明")
      await message(session.id, "user", "已接收的后续人类输入")
      await setSessionTitleFromFirstUserMessage(first)
      expect((await Session.get(session.id)).title).toBe("真正的首个人类成果")
      expect(
        (await Session.messages({ sessionID: session.id })).map((m) => ({
          author: m.info.author,
          text: m.parts.find((p) => p.type === "text")?.text,
        })),
      ).toEqual([
        { author: "goal-controller", text: "Technical controller input" },
        { author: "user", text: "真正的首个人类成果\n下一行说明" },
        { author: "user", text: "已接收的后续人类输入" },
      ])
    },
  })
})

test("a late automatic title returns the current operator choice through the canonical setter", async () => {
  await using project = await memoryProject("opening-title-cas")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant" })
      const accepted = await Session.setTitle({ sessionID: session.id, title: "用户刚刚选择的名称" })
      const delayed = { sessionID: session.id, title: "迟到的自动标题", expectedTitle: session.title }
      const result = await Session.setTitle(delayed)
      expect({ result, stored: await Session.get(session.id) }).toEqual({ result: accepted, stored: accepted })
    },
  })
})

test("Task-owned Goals preserve the actual Task session title", async () => {
  await using project = await memoryProject("opening-task-title")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Work" })
      const taskID = Identifier.ascending("task")
      Database.immediateTransaction((db) => {
        db.insert(EngineTaskTable)
          .values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: session.id,
            source: "test",
            product_pillar: "work",
            title: "Work",
            request: "Task's own request",
            time_created: Date.now(),
            time_updated: Date.now(),
          })
          .run()
        appendTaskOpenedInTransaction({ db, taskID, sessionID: session.id, now: Date.now(), source: "test" })
      })
      const goal = createContinuousGoal(
        resolveGoalOwner({ kind: "task", id: taskID }),
        { requestID: "task-title", objective: "Task持续成果" },
        "user",
      )
      expect({ owner: goal.owner, session: await Session.get(session.id) }).toMatchObject({
        owner: { kind: "task", id: taskID },
        session: { id: session.id, title: "Work" },
      })
    },
  })
})

test("parallel project inputs retain their own human title and ownership", async () => {
  await using firstProject = await memoryProject("opening-project-first")
  await using secondProject = await memoryProject("opening-project-second")
  const results = await Promise.all(
    [
      [firstProject, "第一项目成果"],
      [secondProject, "第二项目成果"],
    ].map(async ([project, title]) => {
      const directory = (project as typeof firstProject).path
      return Instance.provide({
        directory,
        fn: async () => {
          const session = await createRightSidebarConversationSession("chat")
          await message(session.id, "scheduler", "Runtime delivery")
          const human = await message(session.id, "user", title as string)
          await setSessionTitleFromFirstUserMessage(human)
          return { expected: title, current: await Session.get(session.id), directory }
        },
      })
    }),
  )
  for (const result of results)
    expect({ title: result.current.title, directory: result.current.directory }).toEqual({
      title: result.expected,
      directory: result.directory,
    })
})
