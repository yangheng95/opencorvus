import { afterEach, expect, spyOn, test } from "bun:test"
import yargs from "yargs"
import { MissionCommand } from "../../src/cli/cmd/mission"
import { TaskCommand } from "../../src/cli/cmd/task"
import { QuestionCommand } from "../../src/cli/cmd/question"
import { PermissionCommand } from "../../src/cli/cmd/permission"
import { LedgerCommand } from "../../src/cli/cmd/ledger"
import { UI } from "../../src/cli/ui"
import { Server } from "../../src/server/server"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

function cli() {
  return yargs()
    .exitProcess(false)
    .strict()
    .command(MissionCommand)
    .command(TaskCommand)
    .command(QuestionCommand)
    .command(PermissionCommand)
    .command(LedgerCommand)
}

const mutations = [
  {
    args: ["mission", "create", "--pillar", "code", "--title", "Draft", "--request", "Inspect"],
    result: { missionID: "m1", productPillar: "code" },
  },
  { args: ["mission", "dispatch", "m1"], result: { missionID: "m1", sessionID: "s1" } },
  {
    args: ["mission", "send", "--pillar", "code", "--text", "Inspect"],
    result: { missionID: "m1", sessionID: "s1", created: true },
  },
  { args: ["mission", "abort", "m1", "--reason", "Done"], result: true },
  {
    args: ["task", "create", "--pillar", "code", "--request", "Inspect"],
    result: { task_id: "t1", directory: "/srv/project" },
  },
  {
    args: ["task", "message", "t1", "--text", "Inspect"],
    result: { wake_status: "not_woken", message: "Already awake" },
  },
  { args: ["task", "cancel", "t1", "--reason", "Done"], result: { taskID: "t1", status: "cancelling" } },
  { args: ["question", "reply", "q1", "--answers", '[["Use alpha, then beta"],["a,b"," c "]]'], result: true },
  { args: ["question", "reject", "q1"], result: true },
  {
    args: ["permission", "reply", "p1", "--decision", "deny"],
    result: { decision: "deny", request: { toolName: "write", id: "p1" } },
  },
  { args: ["permission", "revoke", "g1"], result: true },
]

for (const item of mutations) {
  test(`attached ${item.args.slice(0, 2).join(" ")} emits its HTTP receipt as JSON`, async () => {
    const bodies: unknown[] = []
    const directories: Array<string | null> = []
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        directories.push(new URL(request.url).searchParams.get("directory"))
        const body = await request.text()
        bodies.push(body ? JSON.parse(body) : null)
        return Response.json(item.result)
      },
    })
    const output: string[] = []
    const capture = spyOn(console, "log").mockImplementation((value) => {
      output.push(String(value))
    })
    try {
      await cli().parseAsync([...item.args, "--url", server.url.origin, "--dir", "/a/project", "--format", "json"])
      expect(output.map((value) => JSON.parse(value))).toEqual([item.result])
      expect(directories).toEqual(["/a/project"])
      if (item.args[0] === "task" && item.args[1] === "cancel") {
        const lines: string[] = []
        const humanOutput = spyOn(UI, "println").mockImplementation((value) => {
          lines.push(String(value))
        })
        try {
          await cli().parseAsync([...item.args, "--url", server.url.origin, "--format", "table"])
          expect(lines).toEqual(["Task t1: cancelling"])
        } finally {
          humanOutput.mockRestore()
        }
      }
      if (item.args[0] === "question" && item.args[1] === "reply") {
        expect(bodies).toEqual([{ answers: [["Use alpha, then beta"], ["a,b", " c "]] }])
      }
    } finally {
      capture.mockRestore()
      await server.stop(true)
    }
  })
}

for (const action of ["list", "archive"]) {
  test(`Ledger ${action} forwards the complete server continuation`, async () => {
    const observed: URL[] = []
    const page = { rows: [], nextCursor: null }
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        observed.push(new URL(request.url))
        return Response.json(page)
      },
    })
    const capture = spyOn(console, "log").mockImplementation(() => {})
    try {
      await cli().parseAsync([
        "ledger",
        action,
        "--url",
        server.url.origin,
        "--format",
        "json",
        "--cursor-updated",
        "123",
        "--cursor-pinned",
        "false",
        "--cursor-row-key",
        "task:t1",
      ])
      expect(Object.fromEntries(observed[0]!.searchParams)).toMatchObject({
        cursorUpdated: "123",
        cursorPinned: "false",
        cursorRowKey: "task:t1",
      })
    } finally {
      capture.mockRestore()
      await server.stop(true)
    }
  })
}

test("Mission CLI creates and reads a draft through the real isolated server", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: Server.App().fetch })
      const output: string[] = []
      const capture = spyOn(console, "log").mockImplementation((value) => {
        output.push(String(value))
      })
      try {
        const common = ["--url", server.url.origin, "--dir", project.path, "--format", "json"]
        await cli().parseAsync([
          "mission",
          "create",
          "--pillar",
          "code",
          "--title",
          "CLI draft",
          "--request",
          "Inspect only",
          ...common,
        ])
        const created = JSON.parse(output[0]!)
        expect(typeof created.missionID).toBe("string")
        expect(created.productPillar).toBe("code")
        output.length = 0
        await cli().parseAsync(["mission", "list", ...common])
        expect(JSON.parse(output[0]!).map((entry: { missionID: string }) => entry.missionID)).toContain(
          created.missionID,
        )
      } finally {
        capture.mockRestore()
        await server.stop(true)
      }
    },
  })
}, 60_000)
