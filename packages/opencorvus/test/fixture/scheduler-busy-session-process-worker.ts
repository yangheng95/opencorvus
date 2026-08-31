import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import {
  AutomationFireAttemptTable,
  AutomationFireTable,
  AutomationRunReceiptTable,
  AutomationRunTable,
} from "@/scheduler/automation.sql"
import { currentAutomationFrontiersInTransaction } from "@/scheduler/automation-projection"
import { AutomationService } from "@/scheduler/automation-service"
import { Session } from "@/session"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { Database, eq } from "@/storage/db"
import fs from "node:fs"
import path from "node:path"

const [mode, projectPath, barrierPath] = process.argv.slice(2)
if ((mode !== "seed" && mode !== "hold" && mode !== "poll") || !projectPath) {
  throw new Error("Scheduler busy-Session worker requires seed|hold|poll and project path")
}
if (mode === "hold" && !barrierPath) throw new Error("Scheduler busy-Session hold worker requires a barrier path")

const SESSION_ID = Identifier.deterministic("session", "scheduler-busy-session-cross-process")
const USER_MESSAGE_ID = Identifier.deterministic("message", "scheduler-busy-session-cross-process-user")
const ASSISTANT_MESSAGE_ID = Identifier.deterministic("message", "scheduler-busy-session-cross-process-assistant")

function recurrence(start: number) {
  const stamp = new Date(start)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
  return `DTSTART:${stamp}\nRRULE:FREQ=SECONDLY;INTERVAL=120`
}

async function waitForBarrier(name: string) {
  const target = path.join(barrierPath!, name)
  while (!fs.existsSync(target)) await Bun.sleep(10)
}

async function run() {
  return Instance.provide({
    directory: projectPath,
    fn: async () => {
      if (mode === "seed") {
        await Session.createNext({
          id: SESSION_ID,
          kind: "assistant",
          directory: projectPath,
          title: "Cross-process busy Automation target",
        })
        const automation = await AutomationService.create({
          name: "cross-process busy exact Session",
          target: { scope: "session", sessionId: SESSION_ID },
          recurrence: recurrence(Date.now() + 4_000),
          prompt: "preserve this exact due occurrence across processes",
        })
        return { mode, automationID: automation.id, sessionID: SESSION_ID, nextRun: automation.nextRun }
      }

      if (mode === "hold") {
        const user = await Session.updateMessage({
          id: USER_MESSAGE_ID,
          role: "user",
          sessionID: SESSION_ID,
          author: "user",
          time: { created: Date.now() },
          agent: "assistant",
          model: { providerID: "test", modelID: "test" },
        })
        const owner = SessionPromptOwner.acquire({
          sessionID: SESSION_ID,
          projectID: Instance.project.id,
          directory: Instance.directory,
        })
        if (!owner.acquired) throw new Error("Holder did not acquire the durable Session Prompt owner")
        const assistant = await Session.beginAssistantReply({
          id: ASSISTANT_MESSAGE_ID,
          sessionID: SESSION_ID,
          role: "assistant",
          author: "assistant",
          parentID: user.id,
          acceptedInputMessageIDs: [user.id],
          agent: "assistant",
          modelID: "test",
          providerID: "test",
          path: { cwd: projectPath, root: projectPath },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        fs.writeFileSync(
          path.join(barrierPath!, "ready.json"),
          JSON.stringify({
            sessionID: SESSION_ID,
            assistantMessageID: assistant.id,
            promptOwnerGeneration: owner.authority.generation,
          }),
        )
        try {
          await waitForBarrier("release")
          assistant.finish = "stop"
          assistant.time.completed = Date.now()
          await Session.updateMessage(assistant)
          if (!SessionPromptOwner.release(owner.authority)) {
            throw new Error("Holder lost its durable Session Prompt owner before release")
          }
          return { mode, sessionID: SESSION_ID, assistantMessageID: assistant.id, outcome: "settled" }
        } finally {
          SessionPromptOwner.release(owner.authority)
        }
      }

      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
        sessionID: input.sessionID!,
        messageID: input.messageID!,
        activation: Promise.resolve({ owner: new AbortController().signal }),
        completion: Promise.resolve({ ok: true as const }),
      }))
      await AutomationService.runDueNow()
      const frontier = Database.use((db) =>
        currentAutomationFrontiersInTransaction(db, { status: "active" }).find(
          (candidate) => candidate.session_id === SESSION_ID,
        ),
      )
      if (!frontier) throw new Error("Poll worker did not find the Session Automation frontier")
      const facts = Database.use((db) => {
        const fires = db
          .select()
          .from(AutomationFireTable)
          .where(eq(AutomationFireTable.automation_revision_id, frontier.revision_id))
          .all()
        const fireIDs = new Set(fires.map((fire) => fire.id))
        const attempts = db.select().from(AutomationFireAttemptTable).all().filter((row) => fireIDs.has(row.fire_id))
        const runs = db.select().from(AutomationRunTable).all().filter((row) => fireIDs.has(row.fire_id))
        const runIDs = new Set(runs.map((row) => row.id))
        const receipts = db.select().from(AutomationRunReceiptTable).all().filter((row) => runIDs.has(row.run_id))
        return { fires, attempts, runs, receipts }
      })
      return { mode, frontier, facts }
    },
  })
}

try {
  process.stdout.write(`${JSON.stringify(await run())}\n`)
} finally {
  await Instance.disposeAll()
  Database.close()
}
