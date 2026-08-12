import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import {
  IsolatedWorkspaceRecoveryBlockedError,
  recoverOrphanedIsolatedCheckWorkspaces,
} from "@/project/isolated-check-workspace"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { RuntimeServerOwnership } from "@/server/runtime-server-ownership"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("successor recovery removes only exact prior/dead request and workspace occurrences", async () => {
  if (process.platform !== "win32") return
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ownership = RuntimeServerOwnership.acquire({ database: Database.Path() })
      const current = RuntimeServerOwnership.currentProcessOccurrence()
      const deadPID = 2_000_000_000
      const deadOccurrence = "prior-dead-runtime-occurrence"
      const liveOccurrence = "foreign-live-runtime-occurrence"
      let physicalOwnerObservations = 0
      const observeProcessOccurrence = RuntimeServerOwnership.cachedProcessOccurrenceObserver((owner) => {
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
          currentOccurrenceID: ownership.owner.occurrenceID,
          observeProcessOccurrence,
        })
        const workspaces = await recoverOrphanedIsolatedCheckWorkspaces({
          currentOccurrenceID: ownership.owner.occurrenceID,
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
        const requestFailure = await ProcessSupervisor.recoverOrphanedWindowsRequests({
          currentOccurrenceID: ownership.owner.occurrenceID,
          observeProcessOccurrence,
        }).catch((error) => error)
        expect(requestFailure).toBeInstanceOf(ProcessSupervisor.WindowsOrphanRequestRecoveryBlockedError)
        expect((requestFailure as ProcessSupervisor.WindowsOrphanRequestRecoveryBlockedError).result).toMatchObject({
          retainedCurrent: 1,
          retainedLive: 1,
          retainedUnknown: 1,
        })

        const unknownWorkspaceRoot = path.join(workspaceParent, "workspace-unknown-owner")
        await fs.mkdir(path.join(unknownWorkspaceRoot, "workspace"), { recursive: true })
        const workspaceFailure = await recoverOrphanedIsolatedCheckWorkspaces({
          currentOccurrenceID: ownership.owner.occurrenceID,
          observeProcessOccurrence,
        }).catch((error) => error)
        expect(workspaceFailure).toBeInstanceOf(IsolatedWorkspaceRecoveryBlockedError)
        expect((workspaceFailure as IsolatedWorkspaceRecoveryBlockedError).result).toMatchObject({
          retainedCurrent: 1,
          retainedLive: 1,
          retainedUnknown: 1,
        })

        await fs.rm(project.path, { recursive: true, force: true })
        expect(
          await recoverOrphanedIsolatedCheckWorkspaces({
            currentOccurrenceID: ownership.owner.occurrenceID,
            observeProcessOccurrence,
          }),
        ).toEqual({ inspected: 0, removed: 0, retainedCurrent: 0, retainedLive: 0, retainedUnknown: 0 })
      } finally {
        await Promise.all(requestRoots.map((root) => fs.rm(root, { recursive: true, force: true })))
        await RuntimeServerOwnership.releaseWithRetry(ownership)
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
          const error = await ProcessSupervisor.recoverOrphanedWindowsRequests({
            currentOccurrenceID: "current",
            timeoutMilliseconds: 20,
            observeProcessOccurrence: () => "dead_or_reused",
          }).catch((cause) => cause)
          expect(error).toBeInstanceOf(ProcessSupervisor.WindowsOrphanRequestRecoveryBlockedError)
          expect({ result: error.result, detail: String(error.errors[0]?.cause) }).toEqual({
            result: { inspected: 1, removed: 0, retainedCurrent: 0, retainedLive: 0, retainedUnknown: 1 },
            detail: expect.stringContaining(item.message),
          })
        } finally {
          await fs.rm(root, { recursive: true, force: true })
        }
      }
    },
  })
}, 60_000)
