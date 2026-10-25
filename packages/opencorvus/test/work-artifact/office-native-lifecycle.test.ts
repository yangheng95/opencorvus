import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "../../src/project/instance"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { Process } from "../../src/util/process"
import { runPackagedWorkArtifactAcceptance } from "../../src/work-artifact/packaged-acceptance"
import {
  prepareWorkArtifactRuntimeEnvironment,
  type WorkArtifactPresentationDependencies,
} from "../../src/work-artifact/presentation"
import {
  WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST,
  WorkArtifactTargetPackageManifestSchema,
  verifyWorkArtifactTargetPackageManifest,
} from "../../src/work-artifact/runtime/package-manifest"
import {
  parseWorkArtifactRuntimeLock,
  WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH,
} from "../../src/work-artifact/runtime/runtime-lock"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const packageRoot = process.env.OPENCORVUS_WORK_ARTIFACT_PACKAGE_ROOT
const selectedProfile = process.env.OPENCORVUS_WORK_ARTIFACT_PROFILE
afterAll(resetMemoryDatabase)

for (const profile of ["office.document@1", "office.spreadsheet@1"] as const) {
  const nativeTest = packageRoot && (!selectedProfile || selectedProfile === profile) ? test : test.skip
  nativeTest(
    `${profile} native author, inspect, validate and receipt-authorized delivery`,
    async () => {
      const root = path.resolve(packageRoot!)
      const manifest = WorkArtifactTargetPackageManifestSchema.parse(
        JSON.parse(await fs.readFile(path.join(root, WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST), "utf8")),
      )
      const lock = parseWorkArtifactRuntimeLock(
        JSON.parse(await fs.readFile(path.join(root, WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH), "utf8")),
      )
      await verifyWorkArtifactTargetPackageManifest({ root, target: manifest.target, lock })
      const entry = manifest.files.find((file) => file.kind === "executable")!
      const executable = path.join(root, entry.path)
      const dependencies: WorkArtifactPresentationDependencies = {
        async officeCliPath() {
          return executable
        },
        async runtimeIdentity() {
          return {
            id: "officecli",
            label: `OfficeCLI v${lock.runtimes[0].version}`,
            version: lock.runtimes[0].version,
            lockRevision: manifest.runtime_lock_revision,
            packageSha: entry.sha256,
          }
        },
        async runOfficeCli(input) {
          const result = await Process.runHost([executable, ...input.args], {
            cwd: input.cwd,
            abort: input.abort,
            env: await prepareWorkArtifactRuntimeEnvironment(input.cwd),
            timeoutMs: input.timeoutMs,
            maxOutputBytes: input.maxOutputBytes,
            inactivityTimeoutMs: 45_000,
          })
          return result
        },
      }
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const result = await runPackagedWorkArtifactAcceptance({ profile, dependencies })
          expect({ source: result.source_sha, delivered: result.delivered_sha, display: result.display }).toEqual({
            source: result.source_sha,
            delivered: result.source_sha,
            display: "interactive-artifact",
          })
          expect(result.receipt_sha).toMatch(/^[a-f0-9]{64}$/)
          const data = (result.content as { data: unknown }).data
          if (profile === "office.spreadsheet@1") {
            const column = JSON.parse(
              (
                await Process.runHost(
                  [
                    executable,
                    "get",
                    AttachmentStore.resolveAbsolute(Instance.project.id, `${result.source_sha}.xlsx`)!,
                    "/工时汇总/col[A]",
                    "--depth",
                    "0",
                    "--json",
                  ],
                  {
                    cwd: project.path,
                    env: await prepareWorkArtifactRuntimeEnvironment(project.path),
                    timeoutMs: 30_000,
                    maxOutputBytes: 100_000,
                    inactivityTimeoutMs: 30_000,
                  },
                )
              ).stdout.toString(),
            )
            expect(column.data.results[0].format.customWidth).toBe(true)
            expect(column.data.results[0].format.width).toBeGreaterThan(10)
            const sheets = (
              data as { sheets: Array<{ name: string; rows: Array<{ row: number; cells: Record<string, string> }> }> }
            ).sheets
            expect(sheets.map((sheet) => sheet.name)).toEqual(["工时汇总", "类型"])
            expect(sheets[0]!.rows.find((row) => row.row === 6)?.cells).toEqual({
              A6: "合计",
              B6: "36",
              C6: "25",
              D6: "-11",
            })
            expect(sheets[1]!.rows.find((row) => row.row === 2)?.cells).toEqual({ A2: "001", B2: "=1+1", C2: "TRUE" })
          } else {
            expect(JSON.stringify(data)).toContain("工时周报")
            expect(JSON.stringify(data)).toContain("计划36小时，实际25小时，差值−11小时。")
          }
        },
      })
    },
    180_000,
  )
}
