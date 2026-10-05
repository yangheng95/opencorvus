import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { recoverOrphanedIsolatedCheckWorkspaces } from "@/project/isolated-check-workspace"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import {
  cachedRuntimeProcessOccurrenceObserver,
  currentRuntimeProcessOccurrence,
} from "@/runtime/process-occurrence"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("transferred Windows requests follow the exact successor's live and unknown dispositions", async () => {
  if (process.platform !== "win32") return
  const current = currentRuntimeProcessOccurrence()
  const root = await fs.mkdtemp(path.join(Global.Path.temporary, "supervisor-transfer-contract-"))
  const requestID = "transfer-contract"
  const original = { pid: 2_000_000_000, processInstanceID: "dead-original", occurrenceID: "old" }
  const successor = { ...current, occurrenceID: "transferred-successor" }
  const helper = { pid: 41_005, processInstanceID: "helper-instance" }
  await fs.writeFile(path.join(root, "request.json"), JSON.stringify({ kind: "command", executable: process.execPath, args: [], detached: true,
    ready_file: path.join(root, "ready.json"), launch_failed_file: path.join(root, "launch-failed.json"), cancel_file: path.join(root, "cancel"),
    settled_file: path.join(root, "settled.json"), request_id: requestID, owner_pid: original.pid,
    owner_process_instance_id: original.processInstanceID, runtime_occurrence_id: original.occurrenceID }))
  await fs.writeFile(path.join(root, "helper.json"), JSON.stringify({ protocol: 1, request_id: requestID, runtime_occurrence_id: "old",
    helper_pid: helper.pid, helper_process_instance_id: helper.processInstanceID }))
  await fs.writeFile(path.join(root, "ready.json"), JSON.stringify({ protocol: 3, detached: true, request_id: requestID, runtime_occurrence_id: "old",
    helper_pid: helper.pid, target_pid: successor.pid, target_process_instance_id: successor.processInstanceID }))
  const receipt = { protocol: 1, request_id: requestID, outcome: "committed", previous_owner: original, successor, helper }
  await fs.writeFile(path.join(root, "restart-ready.json"), JSON.stringify({ protocol: 1, request_id: requestID, successor, url: "http://127.0.0.1:1" }))
  await fs.writeFile(path.join(root, "transfer-receipt.json"), JSON.stringify(receipt))
  try {
    const observations: string[] = []
    const live = await ProcessSupervisor.recoverOrphanedWindowsRequests({ currentOccurrenceID: "peer", observeProcessOccurrence: owner => {
      observations.push(owner.occurrenceID)
      return owner.pid === successor.pid ? "exact_live" : "dead_or_reused"
    } })
    expect({ retained: live.retainedLive, observed: observations }).toEqual({ retained: 1, observed: ["transferred-successor"] })
    const unknown = await ProcessSupervisor.recoverOrphanedWindowsRequests({ currentOccurrenceID: "peer", observeProcessOccurrence: () => "unknown_live" })
    expect(unknown.retainedUnknown).toBe(1)
    expect(JSON.parse(await fs.readFile(path.join(root, "transfer-receipt.json"), "utf8"))).toEqual(receipt)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test("successor recovery removes only exact prior/dead request and workspace occurrences", async () => {
  if (process.platform !== "win32") return
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const current = currentRuntimeProcessOccurrence()
      const deadPID = 2_000_000_000
      const deadOccurrence = "prior-dead-runtime-occurrence"
      const liveOccurrence = "foreign-live-runtime-occurrence"
      let physicalOwnerObservations = 0
      const observeProcessOccurrence = cachedRuntimeProcessOccurrenceObserver((owner) => {
        physicalOwnerObservations += 1
        return owner.pid === deadPID ? "dead_or_reused" : "exact_live"
      })
      const requestRoots: string[] = []
      const createRequest = async (name: string, owner: typeof current) => {
        const root = path.join(Global.Path.temporary, `supervisor-${name}`)
        requestRoots.push(root)
        await fs.mkdir(root, { recursive: true })
        const requestID = `request-${name}`
        await fs.writeFile(
          path.join(root, "request.json"),
          JSON.stringify({
            kind: "shell",
            command: "echo recovery",
            shell: "cmd.exe",
            cancel_file: path.join(root, "cancel"),
            ready_file: path.join(root, "ready.json"),
            launch_failed_file: path.join(root, "launch-failed.json"),
            settled_file: path.join(root, "settled.json"),
            request_id: requestID,
            owner_pid: owner.pid,
            owner_process_instance_id: owner.processInstanceID,
            runtime_occurrence_id: owner.occurrenceID,
          }),
        )
        return { root, requestID }
      }
      try {
        const dead = await createRequest("prior-dead", {
          pid: deadPID,
          processInstanceID: "dead-process-instance",
          occurrenceID: deadOccurrence,
        })
        await fs.writeFile(
          path.join(dead.root, "launch-failed.json"),
          JSON.stringify({
            protocol: 1,
            request_id: dead.requestID,
            helper_pid: 41_001,
            stage: "target_not_created",
            active_processes: 0,
            runtime_occurrence_id: deadOccurrence,
          }),
        )
        await createRequest("current", current)
        await createRequest("live", { ...current, occurrenceID: liveOccurrence })

        const workspaceParent = ProjectRuntimePaths.tasklessAcceptancePaths(project.path).checkWorkspaces
        const workspaceRoots = {
          dead: path.join(workspaceParent, "workspace-prior-dead"),
          current: path.join(workspaceParent, "workspace-current"),
          live: path.join(workspaceParent, "workspace-live"),
        }
        const createWorkspace = async (root: string, owner: typeof current) => {
          await fs.mkdir(path.join(root, "workspace"), { recursive: true })
          await fs.writeFile(
            path.join(root, "owner.json"),
            JSON.stringify({
              protocol: 1,
              workspace_id: path.basename(root),
              owner_pid: owner.pid,
              owner_process_instance_id: owner.processInstanceID,
              runtime_occurrence_id: owner.occurrenceID,
            }),
          )
        }
        await createWorkspace(workspaceRoots.dead, {
          pid: deadPID,
          processInstanceID: "dead-process-instance",
          occurrenceID: deadOccurrence,
        })
        await createWorkspace(workspaceRoots.current, current)
        await createWorkspace(workspaceRoots.live, { ...current, occurrenceID: liveOccurrence })

        const requests = await ProcessSupervisor.recoverOrphanedWindowsRequests({
          currentOccurrenceID: current.occurrenceID,
          observeProcessOccurrence,
        })
        const workspaces = await recoverOrphanedIsolatedCheckWorkspaces({
          currentOccurrenceID: current.occurrenceID,
          observeProcessOccurrence,
        })
        expect({ requests, workspaces }).toMatchObject({
          requests: { inspected: 3, removed: 1, retainedCurrent: 1, retainedLive: 1, retainedUnknown: 0 },
          workspaces: { inspected: 3, removed: 1, retainedCurrent: 1, retainedLive: 1, retainedUnknown: 0 },
        })
        expect(physicalOwnerObservations).toBe(2)
        expect((await fs.readdir(workspaceParent)).sort()).toEqual(["workspace-current", "workspace-live"])

        const unknownRequestRoot = path.join(Global.Path.temporary, "supervisor-unknown-owner")
        requestRoots.push(unknownRequestRoot)
        await fs.mkdir(unknownRequestRoot, { recursive: true })
        const unknownRequestRecovery = await ProcessSupervisor.recoverOrphanedWindowsRequests({
          currentOccurrenceID: current.occurrenceID,
          observeProcessOccurrence,
        })
        expect(unknownRequestRecovery).toMatchObject({
          retainedCurrent: 1,
          retainedLive: 1,
          retainedUnknown: 0,
          quarantined: 1,
        })
        expect(String(unknownRequestRecovery.unreconciled[0]?.cause)).toContain("request.json is missing")
        const temporaryEntries = await fs.readdir(Global.Path.temporary)
        expect(temporaryEntries).toContain("quarantine")

        const unknownWorkspaceRoot = path.join(workspaceParent, "workspace-unknown-owner")
        await fs.mkdir(path.join(unknownWorkspaceRoot, "workspace"), { recursive: true })
        const unknownWorkspaceRecovery = await recoverOrphanedIsolatedCheckWorkspaces({
          currentOccurrenceID: current.occurrenceID,
          observeProcessOccurrence,
        })
        expect(unknownWorkspaceRecovery).toMatchObject({
          retainedCurrent: 1,
          retainedLive: 1,
          retainedUnknown: 0,
          quarantined: 1,
        })
        const workspaceEntries = await fs.readdir(workspaceParent)
        expect(workspaceEntries).toContain(".quarantine")

        await fs.rm(project.path, { recursive: true, force: true })
        expect(
          await recoverOrphanedIsolatedCheckWorkspaces({
            currentOccurrenceID: current.occurrenceID,
            observeProcessOccurrence,
          }),
        ).toEqual({
          inspected: 0,
          removed: 0,
          retainedCurrent: 0,
          retainedLive: 0,
          retainedUnknown: 0,
          quarantined: 0,
          unreconciled: [],
        })
      } finally {
        requestRoots.push(path.join(Global.Path.temporary, "quarantine"))
        await Promise.all(requestRoots.map((root) => fs.rm(root, { recursive: true, force: true })))
      }
    },
  })
}, 60_000)

test("successor recovery rejects conflicting and wrongly identified pre-target settlement evidence", async () => {
  if (process.platform !== "win32") return
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const cases = [
        {
          name: "conflicting-ready",
          marker: { request_id: "request-conflicting-ready", helper_pid: 41_001, runtime_occurrence_id: "dead" },
          ready: {
            protocol: 1,
            request_id: "request-conflicting-ready",
            helper_pid: 41_001,
            target_pid: 41_002,
            runtime_occurrence_id: "dead",
          },
          message: "conflicts with target process markers",
        },
        {
          name: "wrong-request",
          marker: { request_id: "another-request", helper_pid: 41_001, runtime_occurrence_id: "dead" },
          message: "identity does not match",
        },
        {
          name: "wrong-runtime",
          marker: {
            request_id: "request-wrong-runtime",
            helper_pid: 41_001,
            runtime_occurrence_id: "another-runtime",
          },
          message: "identity does not match",
        },
        {
          name: "invalid-helper",
          marker: { request_id: "request-invalid-helper", helper_pid: 0, runtime_occurrence_id: "dead" },
          message: "invalid helper process id",
        },
      ] as const

      for (const item of cases) {
        const root = path.join(Global.Path.temporary, `supervisor-${item.name}`)
        const requestID = `request-${item.name}`
        await fs.mkdir(root, { recursive: true })
        await fs.writeFile(
          path.join(root, "request.json"),
          JSON.stringify({
            kind: "shell",
            command: "echo recovery",
            shell: "cmd.exe",
            cancel_file: path.join(root, "cancel"),
            ready_file: path.join(root, "ready.json"),
            launch_failed_file: path.join(root, "launch-failed.json"),
            settled_file: path.join(root, "settled.json"),
            request_id: requestID,
            owner_pid: 2_000_000_000,
            owner_process_instance_id: "dead-process-instance",
            runtime_occurrence_id: "dead",
          }),
        )
        await fs.writeFile(
          path.join(root, "launch-failed.json"),
          JSON.stringify({
            protocol: 1,
            ...item.marker,
            stage: "target_not_created",
            active_processes: 0,
          }),
        )
        if ("ready" in item) await fs.writeFile(path.join(root, "ready.json"), JSON.stringify(item.ready))

        try {
          const { unreconciled, ...counts } = await ProcessSupervisor.recoverOrphanedWindowsRequests({
            currentOccurrenceID: "current",
            timeoutMilliseconds: 20,
            observeProcessOccurrence: () => "dead_or_reused",
          })
          expect({ counts, detail: String(unreconciled[0]?.cause) }).toEqual({
            counts: { inspected: 1, removed: 0, retainedCurrent: 0, retainedLive: 0, retainedUnknown: 0, quarantined: 1 },
            detail: expect.stringContaining(item.message),
          })
        } finally {
          await fs.rm(root, { recursive: true, force: true })
        }
      }
      await fs.rm(path.join(Global.Path.temporary, "quarantine"), { recursive: true, force: true })
    },
  })
}, 60_000)
