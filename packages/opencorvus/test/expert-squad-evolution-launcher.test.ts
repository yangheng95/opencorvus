import { describe, expect, test } from "bun:test"
import path from "node:path"
import os from "node:os"
import { createHash } from "node:crypto"
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import {
  EvolutionBenchmarkLaunchSchema,
  EvolutionBenchmarkFinalizedRunError,
  EvolutionServerExitedBeforeReadinessError,
  CONTROLLER_ENVIRONMENT_WRAPPER_SOURCE,
  captureExactHostCommand,
  controllerServiceEnvironment,
  directoryTreeDigest,
  resumeEvolutionBenchmark,
  startEvolutionBenchmark,
  systemdRunEnvironmentArguments,
  type EvolutionBenchmarkRuntime,
  waitForEvolutionServerURL,
} from "../script/benchmark/expert-squad-evolution"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { executionCapsuleTreeDigest } from "../src/execution-capsule/tree-digest"
import { ExecutionCapsuleRuntimeDescriptorSchema } from "../src/execution-capsule/runtime"
import { artifactRuntimeNodeModuleNames } from "../script/build-artifact"

const digest = "a".repeat(64)
const resource = (name: string) => ({ path: path.resolve(import.meta.dir, name), sha256: digest })
const fileDigest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")

describe("Expert Squad evolution launcher", () => {
  test("runs runtime attestation through the explicit Host process authority", async () => {
    const command =
      process.platform === "win32"
        ? {
            executable: process.env.ComSpec!,
            args: ["/d", "/s", "/c", "echo exact-host-runtime-attestation"],
          }
        : {
            executable: process.execPath,
            args: ["-e", "process.stdout.write('exact-host-runtime-attestation')"],
          }
    const output = await captureExactHostCommand(command.executable, command.args)

    expect(output).toBe("exact-host-runtime-attestation")
  })

  test("starts the controller process with exactly the declared environment", async () => {
    const declared = {
      OPENCORVUS_HOME: "/run/home",
      DEEPSEEK_API_KEY: "test-provider-value",
      XDG_RUNTIME_DIR: "/run/user/1000",
    }
    const serviceEnvironment = {
      ...controllerServiceEnvironment(declared),
      UNDECLARED_MANAGER_CREDENTIAL: "must-not-reach-controller",
    }
    const child = Bun.spawn(
      [
        "wsl.exe",
        "-d",
        "Ubuntu-24.04",
        "--exec",
        "/usr/bin/env",
        "-i",
        ...Object.entries(serviceEnvironment).map(([name, value]) => `${name}=${value}`),
        "/usr/local/bin/node",
        "-e",
        CONTROLLER_ENVIRONMENT_WRAPPER_SOURCE,
        "/usr/local/bin/node",
        "-e",
        "process.stdout.write(JSON.stringify(process.env))",
      ],
      { stdout: "pipe", stderr: "pipe" },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])

    expect({ exitCode, stderr, environment: JSON.parse(stdout) }).toEqual({
      exitCode: 0,
      stderr: "",
      environment: declared,
    })
  })

  test("forwards controller environment by systemd variable name without serializing values", () => {
    expect(
      systemdRunEnvironmentArguments({
        OPENCORVUS_HOME: "/run/home",
        DEEPSEEK_API_KEY: "provider-secret-value",
        XDG_RUNTIME_DIR: "/run/user/1000",
      }),
    ).toEqual([
      "--setenv=DEEPSEEK_API_KEY",
      "--setenv=OPENCORVUS_HOME",
      "--setenv=XDG_RUNTIME_DIR",
    ])
  })

  test("preserves exact controller output in the typed early-exit readiness error", async () => {
    const error = await waitForEvolutionServerURL(
      ["controller startup failed: exact diagnostic\n"],
      Promise.resolve(23),
    ).catch((cause) => cause)

    expect(error).toMatchObject({
      name: "EvolutionServerExitedBeforeReadinessError",
      exitCode: 23,
      output: "controller startup failed: exact diagnostic\n",
      message: "OpenCorvus server exited before readiness with code 23:\ncontroller startup failed: exact diagnostic\n",
    } satisfies Partial<EvolutionServerExitedBeforeReadinessError>)
  })

  test("accepts readiness output recorded at the prior inactivity boundary", async () => {
    let now = 0
    const output: string[] = []
    const activity = { lastActivityAt: now }
    const url = await waitForEvolutionServerURL(
      output,
      new Promise<number>(() => {}),
      activity,
      {
        now: () => now,
        sleep: async (milliseconds) => {
          now += milliseconds
          if (now === 15_000) {
            output.push("opencorvus server listening on http://127.0.0.1:4567\n")
            activity.lastActivityAt = now
          }
        },
      },
    )

    expect(url).toBe("http://127.0.0.1:4567")
  })

  test("accepts one complete development-only 18-slot launch envelope", () => {
    const trialSlots = ["case-03", "case-04", "case-10"].flatMap((caseID) =>
      ["baseline", "candidate"].flatMap((arm) =>
        [1, 2, 3].map((repetition) => ({ case_id: caseID, arm, repetition })),
      ),
    )
    const parsed = EvolutionBenchmarkLaunchSchema.parse({
      schema_version: 1,
      run_id: "prism-development-001",
      server_runtime: { source_directory: path.resolve(import.meta.dir, "server-runtime"), tree_sha256: digest },
      server_isolation: {
        kind: "wsl2-rootless-oci-v1",
        systemd_run: resource("systemd-run"),
        systemctl: resource("systemctl"),
        unshare: resource("unshare"),
        runc: resource("runc"),
        node: resource("node"),
        ripgrep: resource("rg"),
        runtime_identity: resource("runtime-identity.json"),
        child_environment_names: [],
        lsp_server_ids: [],
        toolchain: { source_directory: path.resolve(import.meta.dir, "toolchain"), tree_sha256: digest },
        resources: {
          memory_max_bytes: 4_294_967_296,
          tasks_max: 512,
          nofile_max: 4096,
          tmpfs_max_bytes: 2_147_483_648,
          cpu_quota_percent: 100,
        },
      },
      benchmark_resource_root: path.resolve(import.meta.dir, "../../.."),
      output_root: path.resolve(import.meta.dir, "runs"),
      runtime_config: resource("runtime-config.json"),
      project_seed: { source_directory: path.resolve(import.meta.dir, "seed"), tree_sha256: digest },
      inherited_environment_names: ["PATH", "SYSTEMROOT", "OPENAI_API_KEY"],
      credential_source_identity: "environment:OPENAI_API_KEY",
      benchmark_tenant: "evolution-development-tenant",
      external_side_effect_policy: "test_tenant_only",
      workspace_identity: "prism-development-workspace-v1",
      environment_identity: "windows-x64-opencorvus-v0.0.33beta",
      permission_snapshot: resource("permission-snapshot.json"),
      scorer_assets: [resource("judge-scorer.json")],
      statistics_contract: resource("statistics-contract.json"),
      repetitions: 3,
      trial_slots: trialSlots,
      budget: { max_runs: 18, max_cost: 100, currency: "CNY" },
      mission_id: "prism-development-001",
      model: "openai/gpt-5.4-mini",
      mission_request: resource("mission-request.md"),
      benchmark_catalog: resource("manifest.json"),
      development_manifest: resource("development-manifest.json"),
      target_package: {
        source_directory: path.resolve(import.meta.dir, "prism"),
        namespace: "mirror",
        id: "prism",
        package_digest: digest,
      },
      evolution_lab_package: {
        source_directory: path.resolve(import.meta.dir, "evolution-lab"),
        package_digest: digest,
      },
      inactivity_window_ms: 600_000,
      evidence_scheduling_margin_ms: 60_000,
    })
    expect({
      datasetPartition: "development",
      repetitions: parsed.repetitions,
      trialSlots: parsed.trial_slots.length,
      uniqueSlots: new Set(parsed.trial_slots.map((slot) => `${slot.case_id}:${slot.arm}:${slot.repetition}`)).size,
      externalSideEffects: parsed.external_side_effect_policy,
      isolationKind: parsed.server_isolation.kind,
    }).toEqual({
      datasetPartition: "development",
      repetitions: 3,
      trialSlots: 18,
      uniqueSlots: 18,
      externalSideEffects: "test_tenant_only",
      isolationKind: "wsl2-rootless-oci-v1",
    })
  })

  test("executes start and resume through the exact Mission-only runtime surface", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "opencorvus-evolution-launcher-"))
    try {
      const repositoryRoot = path.resolve(import.meta.dir, "../../..")
      const seed = path.join(temporary, "seed")
      await mkdir(seed)
      await writeFile(path.join(seed, "README.md"), "isolated benchmark seed\n")
      const outputRoot = path.join(temporary, "runs")
      const serverRuntime = path.join(temporary, "server-runtime")
      const binary = path.join(serverRuntime, "opencorvus")
      const runtimePackage = path.join(serverRuntime, "package.json")
      const runtimeOfficeCli = path.join(serverRuntime, "bin", "officecli")
      const runtimeRipgrep = path.join(serverRuntime, "bin", "rg")
      const browserRuntime = path.join(serverRuntime, "browser-mcp-node")
      const browserModule = path.join(browserRuntime, "browser.mjs")
      const browserNode = path.join(browserRuntime, "node")
      const browserPackage = path.join(browserRuntime, "package.json")
      const runtimeConfig = path.join(temporary, "runtime-config.json")
      const missionRequest = path.join(temporary, "mission-request.md")
      const permission = path.join(temporary, "permission.json")
      const scorer = path.join(temporary, "scorer.json")
      const statistics = path.join(temporary, "statistics.json")
      const systemdRun = path.join(temporary, "systemd-run")
      const systemctl = path.join(temporary, "systemctl")
      const unshare = path.join(temporary, "unshare")
      const runc = path.join(temporary, "runc")
      const node = path.join(temporary, "node")
      const ripgrep = path.join(temporary, "rg")
      const runtimeIdentity = path.join(temporary, "runtime-identity.json")
      const toolchain = path.join(temporary, "toolchain")
      await mkdir(path.join(serverRuntime, "bin"), { recursive: true })
      await mkdir(browserRuntime)
      await mkdir(path.join(toolchain, "usr"), { recursive: true })
      await writeFile(path.join(toolchain, "usr", "identity"), "toolchain\n")
      const resources = [
        [binary, "binary"],
        [runtimePackage, '{"name":"test-server-runtime"}\n'],
        [runtimeOfficeCli, "officecli\n"],
        [runtimeRipgrep, "rg\n"],
        [browserModule, "export {}\n"],
        [browserNode, "node\n"],
        [browserPackage, '{"name":"test-browser-runtime"}\n'],
        [runtimeConfig, "{}\n"],
        [missionRequest, "Run the exact development Expert Squad evolution campaign.\n"],
        [permission, '{"scope":"isolated"}\n'],
        [scorer, '{"kind":"judge"}\n'],
        [statistics, '{"method":"paired"}\n'],
        [systemdRun, "systemd-run\n"],
        [systemctl, "systemctl\n"],
        [unshare, "unshare\n"],
        [runc, "runc\n"],
        [node, "node\n"],
        [ripgrep, "rg\n"],
        [runtimeIdentity, '{"runtime":"test"}\n'],
      ] as const
      for (const [file, content] of resources) await writeFile(file, content)
      for (const runtimeRoot of [serverRuntime, browserRuntime]) {
        for (const packageName of artifactRuntimeNodeModuleNames({ os: "linux", arch: "x64" })) {
          const packageRoot = path.join(runtimeRoot, "node_modules", ...packageName.split("/"))
          await mkdir(packageRoot, { recursive: true })
          await writeFile(path.join(packageRoot, "package.json"), `${JSON.stringify({ name: packageName })}\n`)
        }
      }
      await Promise.all([binary, runtimeOfficeCli, runtimeRipgrep, browserNode].map((file) => chmod(file, 0o755)))
      const exact = async (file: string) => ({ path: file, sha256: fileDigest(await readFile(file)) })
      const benchmarkCatalogPath = path.join(repositoryRoot, "packages/opencorvus/test/fixtures/expert-squad-evolution-benchmark/manifest.json")
      const developmentManifestPath = path.join(
        repositoryRoot,
        "packages/opencorvus/test/fixtures/expert-squad-evolution-benchmark/development-manifest.json",
      )
      const targetSource = path.join(repositoryRoot, "expert-squads/mirror/prism")
      const evolutionLabSource = path.join(repositoryRoot, "expert-squads/builtin/evolution-lab")
      const slots = ["case-03", "case-04", "case-10"].flatMap((caseID) =>
        ["baseline", "candidate"].flatMap((arm) =>
          [1, 2, 3].map((repetition) => ({ case_id: caseID, arm, repetition })),
        ),
      )
      const launch = {
        schema_version: 1,
        run_id: "behavior-start",
        server_runtime: {
          source_directory: serverRuntime,
          tree_sha256: await executionCapsuleTreeDigest(serverRuntime),
        },
        server_isolation: {
          kind: "wsl2-rootless-oci-v1",
          systemd_run: await exact(systemdRun),
          systemctl: await exact(systemctl),
          unshare: await exact(unshare),
          runc: await exact(runc),
          node: await exact(node),
          ripgrep: await exact(ripgrep),
          runtime_identity: await exact(runtimeIdentity),
          child_environment_names: [],
          lsp_server_ids: [],
          toolchain: {
            source_directory: toolchain,
            tree_sha256: await executionCapsuleTreeDigest(toolchain),
          },
          resources: {
            memory_max_bytes: 4_294_967_296,
            tasks_max: 512,
            nofile_max: 4096,
            tmpfs_max_bytes: 2_147_483_648,
            cpu_quota_percent: 100,
          },
        },
        benchmark_resource_root: repositoryRoot,
        output_root: outputRoot,
        runtime_config: await exact(runtimeConfig),
        project_seed: { source_directory: seed, tree_sha256: await directoryTreeDigest(seed) },
        inherited_environment_names: ["PATH"],
        credential_source_identity: "environment:test-provider",
        benchmark_tenant: "development-test-tenant",
        external_side_effect_policy: "test_tenant_only",
        workspace_identity: "seed-v1",
        environment_identity: "test-runtime-v1",
        permission_snapshot: await exact(permission),
        scorer_assets: [await exact(scorer)],
        statistics_contract: await exact(statistics),
        repetitions: 3,
        trial_slots: slots,
        budget: { max_runs: 18, max_cost: 100, currency: "CNY" },
        mission_id: "behavior-start",
        model: "test/model",
        mission_request: await exact(missionRequest),
        benchmark_catalog: await exact(benchmarkCatalogPath),
        development_manifest: await exact(developmentManifestPath),
        target_package: {
          source_directory: targetSource,
          namespace: "mirror",
          id: "prism",
          package_digest: await ExpertSquadRegistry.packageDigest(targetSource),
        },
        evolution_lab_package: {
          source_directory: evolutionLabSource,
          package_digest: await ExpertSquadRegistry.packageDigest(evolutionLabSource),
        },
        inactivity_window_ms: 10,
        evidence_scheduling_margin_ms: 2,
      }
      const cursor = {
        mission_id: "behavior-start",
        session_id: "session-behavior",
        source: "message" as const,
        id: "message-behavior",
        time_updated: 1,
        activity_sha256: "b".repeat(64),
        tasks: [],
      }
      const calls: string[] = []
      let runtimeMissionID = launch.mission_id
      let missionWakeRequest: { text: string } | undefined
      let openedIsolation:
        | { isolationKind: string; workspaceCount: number; benchmarkResources: string[]; controlResources: string[] }
        | undefined
      const client = {
        expertSquad: {
          async installPayload() {
            calls.push("expertSquad.installPayload")
            return {
              data: {
                operation: "installed",
                before: null,
                after: {
                  namespace: "builtin",
                  id: "evolution-lab",
                  installationScope: "project",
                  packageDigest: launch.evolution_lab_package.package_digest,
                },
              },
            }
          },
          async importFolder() {
            calls.push("expertSquad.importFolder")
            return { data: { after: { ...launch.target_package, packageDigest: launch.target_package.package_digest } } }
          },
          async catalog() {
            calls.push("expertSquad.catalog")
            return {
              data: {
                installations: [
                  { id: "evolution-lab", package_digest: launch.evolution_lab_package.package_digest },
                  { id: "prism", package_digest: launch.target_package.package_digest },
                ],
              },
            }
          },
        },
        mission: {
          async wake(request: { text: string }) {
            calls.push("mission.wake")
            missionWakeRequest = request
            return { data: { missionID: runtimeMissionID, sessionID: cursor.session_id, created: true } }
          },
          async activityCursor() {
            calls.push("mission.activityCursor")
            return { data: { ...cursor, mission_id: runtimeMissionID } }
          },
          async status() {
            calls.push("mission.status")
            return { data: { missionID: runtimeMissionID } }
          },
        },
        session: {
          async turnArtifacts() {
            calls.push("session.turnArtifacts")
            return { data: [] }
          },
        },
      }
      const runtime: EvolutionBenchmarkRuntime = {
        async validateRuntimeIdentity() {
          calls.push("runtime.validateRuntimeIdentity")
        },
        async openServer(openLaunch, openPaths) {
          calls.push("runtime.openServer")
          runtimeMissionID = openLaunch.mission_id
          if (openLaunch.run_id === "behavior-start") {
            openedIsolation = {
              isolationKind: openLaunch.server_isolation.kind,
              workspaceCount: (await readdir(path.join(openPaths.project, "trial-workspaces"))).length,
              benchmarkResources: (await readdir(path.join(openPaths.project, "benchmark-resources"))).sort(),
              controlResources: (await readdir(openPaths.control)).sort(),
            }
          }
          return {
            client: client as never,
            exited: new Promise<number>(() => {}),
            async close() {
              calls.push("runtime.close")
            },
            log: () => "test server log\n",
          }
        },
      }
      const configPath = path.join(temporary, "start.json")
      await writeFile(configPath, `${JSON.stringify(launch, null, 2)}\n`)
      await startEvolutionBenchmark(configPath, runtime)
      expect(calls).toEqual([
        "runtime.validateRuntimeIdentity",
        "runtime.openServer",
        "expertSquad.installPayload",
        "expertSquad.importFolder",
        "expertSquad.catalog",
        "mission.wake",
        "mission.activityCursor",
        "mission.activityCursor",
        "mission.status",
        "session.turnArtifacts",
        "runtime.close",
      ])
      expect(openedIsolation).toEqual({
        isolationKind: "wsl2-rootless-oci-v1",
        workspaceCount: 18,
        benchmarkResources: ["case-03.md", "case-04.md", "case-10.md", "development-manifest.json", "frozen-control"],
        controlResources: ["server-runtime", "target-package", "toolchain"],
      })
      const benchmarkEnvelope = JSON.parse(
        missionWakeRequest!.text.match(/<evolution_benchmark_envelope>\n([\s\S]+)\n<\/evolution_benchmark_envelope>/)![1]!,
      )
      expect({
        inactivity_window_ms: benchmarkEnvelope.inactivity_window_ms,
        evidence_scheduling_margin_ms: benchmarkEnvelope.evidence_scheduling_margin_ms,
        wait_contract: benchmarkEnvelope.wait_contract,
      }).toEqual({
        inactivity_window_ms: 10,
        evidence_scheduling_margin_ms: 2,
        wait_contract: {
          maximum_wait_ms: 8,
          instruction:
            "Every wait must complete within maximum_wait_ms after the latest visible activity so dispatch and evidence publication retain the exact scheduling margin.",
        },
      })
      expect(JSON.parse(await readFile(path.join(outputRoot, "behavior-start", "result.json"), "utf8"))).toMatchObject({
        run_id: "behavior-start",
        benchmark_outcome: {
          status: "inactive",
          reason: "inactivity_timeout",
          inactivity_deadline_ms: 11,
        },
        terminal_inactivity_cursor: cursor,
      })
      expect(
        ExecutionCapsuleRuntimeDescriptorSchema.parse(
          JSON.parse(await readFile(path.join(outputRoot, "behavior-start", "capsule-runtime.json"), "utf8")),
        ).server_runtime_tree_sha256,
      ).toBe(launch.server_runtime.tree_sha256)

      const resumeLaunch = { ...launch, run_id: "behavior-resume", mission_id: "behavior-resume" }
      const resumeConfigPath = path.join(temporary, "resume.json")
      const resumeConfigBytes = `${JSON.stringify(resumeLaunch, null, 2)}\n`
      await writeFile(resumeConfigPath, resumeConfigBytes)
      const resumeRoot = path.join(outputRoot, resumeLaunch.run_id)
      await startEvolutionBenchmark(resumeConfigPath, runtime)
      let finalizedError: unknown
      try {
        await resumeEvolutionBenchmark(resumeConfigPath, runtime)
      } catch (error) {
        finalizedError = error
      }
      expect(finalizedError).toMatchObject({
        name: EvolutionBenchmarkFinalizedRunError.name,
        code: "EVOLUTION_BENCHMARK_RUN_FINALIZED",
      })
      await rm(path.join(resumeRoot, "result.json"))
      calls.length = 0
      await resumeEvolutionBenchmark(resumeConfigPath, runtime)
      expect(calls).toEqual([
        "runtime.validateRuntimeIdentity",
        "runtime.openServer",
        "expertSquad.catalog",
        "mission.activityCursor",
        "mission.activityCursor",
        "mission.status",
        "session.turnArtifacts",
        "runtime.close",
      ])
      expect(JSON.parse(await readFile(path.join(resumeRoot, "checkpoint.json"), "utf8"))).toMatchObject({
        run_id: "behavior-resume",
        inactivity_deadline_ms: 11,
      })
    } finally {
      await rm(temporary, { recursive: true, force: true })
    }
  }, 0)
})
