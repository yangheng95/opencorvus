import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

type WorkflowStep = {
  id?: string
  if?: string
  name?: string
  shell?: string
  uses?: string
  run?: string
  env?: Record<string, string>
  with?: Record<string, unknown>
}

type WorkflowJob = {
  name?: string
  permissions?: Record<string, string>
  uses?: string
  with?: Record<string, unknown>
  secrets?: Record<string, string>
  concurrency?: Record<string, unknown>
  if?: string
  needs?: string | string[]
  outputs?: Record<string, string>
  strategy?: {
    matrix?: {
      include?: Array<{ runner: string; platform: string }>
    }
  }
  steps?: WorkflowStep[]
}

type Workflow = {
  on?: Record<string, unknown>
  permissions?: Record<string, string>
  concurrency?: Record<string, unknown>
  jobs?: Record<string, WorkflowJob>
}

const workflowRoot = path.join(import.meta.dir, "..", ".github", "workflows")

async function readWorkflow(file: string): Promise<Workflow> {
  return Bun.YAML.parse(await Bun.file(path.join(workflowRoot, file)).text()) as Workflow
}

describe("GitHub Actions workflow contract", () => {
  test("every native packaging caller grants the reusable workflow's required permissions", async () => {
    const callee = await readWorkflow("package-overlay.yml")
    const callers: string[] = []
    for (const file of (await fs.readdir(workflowRoot)).filter((file) => file.endsWith(".yml"))) {
      const workflow = await readWorkflow(file)
      for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
        if (job.uses !== "./.github/workflows/package-overlay.yml") continue
        callers.push(`${file}:${id}`)
        expect(job.permissions ?? workflow.permissions, `${file}:${id}`).toEqual(callee.permissions)
      }
    }
    expect(callers.sort()).toEqual(["build-overlays.yml:build-overlay", "build.yml:package-overlay"])
  })

  test("executes complete native and website outcome contracts under the shared deadline owners", async () => {
    const release = await readWorkflow("build.yml")
    const website = await readWorkflow("deploy-opencorvus-com.yml")
    expect(release.jobs?.deadline?.steps?.at(-1)?.run).toBe("bun script/release-automation.ts watch-release")
    expect(website.jobs?.deadline?.steps?.at(-1)).toMatchObject({
      env: { RELEASE_RUN_ID: "${{ inputs.release_run_id || github.run_id }}" },
      run: "bun script/release-automation.ts watch-website",
    })
    const bash = process.platform === "win32" ? "C:/Program Files/Git/usr/bin/bash.exe" : "bash"
    for (const scenario of [
      { workflow: release, env: { PREPARE: "success", OVERLAY: "success", CLI: "success", ASSETS: "success", PUBLICATION: "success" }, exit: 0 },
      { workflow: release, env: { PREPARE: "success", OVERLAY: "failure", CLI: "success", ASSETS: "success", PUBLICATION: "skipped" }, exit: 1 },
      { workflow: release, env: { PREPARE: "success", OVERLAY: "success", CLI: "success", ASSETS: "success", PUBLICATION: "failure" }, exit: 1 },
      { workflow: website, env: { SOURCE: "success", ARCHIVES: "success", BUILD: "success", DEPLOY: "success", DEPLOY_REQUIRED: "true" }, exit: 0 },
      { workflow: website, env: { SOURCE: "success", ARCHIVES: "success", BUILD: "success", DEPLOY: "failure", DEPLOY_REQUIRED: "true" }, exit: 1 },
      { workflow: website, env: { SOURCE: "success", ARCHIVES: "success", BUILD: "success", DEPLOY: "skipped", DEPLOY_REQUIRED: "false" }, exit: 0 },
    ]) {
      const resultJob = scenario.workflow.jobs?.result
      expect(resultJob?.if).toBe("${{ !cancelled() }}")
      const result = Bun.spawnSync([bash, "-e", "-o", "pipefail", "-c", resultJob!.steps![0]!.run!], {
        env: { ...process.env, ...scenario.env }, stdout: "pipe", stderr: "pipe",
      })
      expect(result.exitCode, result.stderr.toString()).toBe(scenario.exit)
    }
  })

  test("executes the required CI checker for full, documentation, failed and cancelled outcomes", async () => {
    const workflow = await readWorkflow("test.yml")
    const checker = workflow.jobs?.required?.steps?.find(({ name }) => name === "Verify applicable checks passed")?.run
    expect(typeof checker).toBe("string")
    const bash = process.platform === "win32" ? "C:/Program Files/Git/usr/bin/bash.exe" : "bash"
    for (const input of [
      {
        scope: "code",
        unit: "success",
        services: "success",
        verify: "success",
        event: "push",
        review: "skipped",
        exit: 0,
      },
      {
        scope: "docs",
        unit: "skipped",
        services: "skipped",
        verify: "success",
        event: "pull_request",
        review: "success",
        exit: 0,
      },
      {
        scope: "code",
        unit: "failure",
        services: "success",
        verify: "success",
        event: "push",
        review: "skipped",
        exit: 1,
      },
      {
        scope: "code",
        unit: "cancelled",
        services: "success",
        verify: "success",
        event: "push",
        review: "skipped",
        exit: 1,
      },
      {
        scope: "docs",
        unit: "skipped",
        services: "skipped",
        verify: "failure",
        event: "push",
        review: "skipped",
        exit: 1,
      },
      {
        scope: "docs",
        unit: "skipped",
        services: "skipped",
        verify: "success",
        event: "pull_request",
        review: "failure",
        exit: 1,
      },
    ]) {
      for (const audit of ["success", "failure", "cancelled", "skipped"]) {
        const result = Bun.spawnSync([bash, "-e", "-c", checker!], {
          env: {
            ...process.env,
            AUDIT: audit,
            VERIFY: input.verify,
            SCOPE: input.scope,
            UNIT: input.unit,
            SERVICES: input.services,
            GITHUB_EVENT_NAME: input.event,
            DEPENDENCY_REVIEW: input.review,
          },
        })
        expect(result.exitCode).toBe(audit === "success" ? input.exit : 1)
      }
    }
  })

  test("retains every ordinary verification once and limits CodeQL by source and ref", async () => {
    const ci = await readWorkflow("test.yml")
    const steps = ci.jobs?.verify?.steps ?? []
    expect(steps.map(({ run }) => run).filter(Boolean)).toEqual([
      "bun run script/secret-scan.ts",
      "bun run docs:check\nbun run check:architecture-index\n",
      "bun ./script/sync-version.ts --check\nbun ./script/generate.ts\nbun ./script/generated-artifacts.ts --check-clean-worktree\n",
      "bun run typecheck",
      "bun test ./script/ci-scope.test.ts ./script/github-actions-workflow-contract.test.ts",
      "sudo bash script/install-ubuntu-packages.sh ripgrep\n",
      "bun run --cwd packages/opencorvus build --single --skip-install",
    ])
    expect(ci.jobs?.audit?.steps).toEqual([
      {
        name: "Checkout repository",
        uses: "actions/checkout@v6",
        with: { "persist-credentials": false },
      },
      {
        name: "Setup Bun",
        uses: "./.github/actions/setup-bun",
        with: { install_dependencies: "false" },
      },
      { name: "Audit locked dependencies", run: "bun audit" },
    ])
    expect(ci.jobs?.required?.steps?.find(({ name }) => name === "Verify applicable checks passed")?.env?.AUDIT).toBe(
      "${{ needs.audit.result }}",
    )
    expect(ci.jobs?.unit?.steps?.find(({ name }) => name === "Run utility filesystem tests")?.run).toBe(
      "bun run --cwd packages/util test",
    )
    expect(ci.jobs?.unit?.steps?.find(({ uses }) => uses === "./.github/actions/setup-bun")?.with).toEqual({
      prepare_sdk: "true",
    })
    expect(ci.jobs?.services?.steps?.map(({ run }) => run).filter(Boolean)).toEqual([
      "bun run --cwd packages/channel-runtime test",
      "bun run test",
    ])
    const codeql = await readWorkflow("codeql.yml")
    expect(codeql.on).toEqual({
      push: { branches: ["main"], "paths-ignore": ["docs/**/*.md", "specs/**/*.md", "*.md"] },
      pull_request: { "paths-ignore": ["docs/**/*.md", "specs/**/*.md", "*.md"] },
      schedule: [{ cron: "17 2 * * 2" }],
      workflow_dispatch: null,
    })
    expect(codeql.concurrency).toEqual({
      group: "codeql-${{ github.event_name == 'workflow_dispatch' && github.run_id || github.ref }}",
      "cancel-in-progress": true,
    })
  })

  test("shares one native overlay workflow with independent Linux format jobs and complete assembly", async () => {
    const release = await readWorkflow("build.yml")
    const debug = await readWorkflow("build-overlays.yml")
    const overlay = await readWorkflow("package-overlay.yml")
    expect([release.jobs?.["package-overlay"]?.uses, debug.jobs?.["build-overlay"]?.uses]).toEqual([
      "./.github/workflows/package-overlay.yml",
      "./.github/workflows/package-overlay.yml",
    ])
    const jobs = overlay.jobs!
    expect(jobs["bundle-linux"]?.needs).toBe("build")
    expect(jobs["bundle-linux"]?.strategy).toEqual({ "fail-fast": false, matrix: { kind: ["deb", "rpm", "appimage"] } })
    expect(jobs.build?.outputs).toEqual({ "input-artifact-id": "${{ steps.input-upload.outputs.artifact-id }}" })
    expect(jobs.build?.steps?.find(({ name }) => name === "Compile Linux installer input")?.run).toContain(
      "package:gui-installer-matrix --build-only",
    )
    for (const job of ["bundle-linux", "assemble-linux"]) {
      expect(jobs[job]?.steps?.find(({ uses }) => uses === "actions/download-artifact@v8")?.with).toEqual({
        "artifact-ids": "${{ needs.build.outputs.input-artifact-id }}",
        path: ".scratch/gui-input",
        "merge-multiple": true,
      })
    }
    expect(jobs["bundle-linux"]?.steps?.find(({ name }) => name === "Bundle one Linux format")?.run).toContain(
      'script/build.ts --bundle "$BUNDLE_KIND"',
    )
    expect(jobs["bundle-linux"]?.steps?.find(({ name }) => name === "Retain completed Linux format")?.with).toEqual({
      name: "gui-bundle-${{ inputs.platform }}-${{ matrix.kind }}",
      path: "gui-bundle-${{ matrix.kind }}.tar",
      "if-no-files-found": "error",
      "compression-level": 0,
      overwrite: true,
      "retention-days": "${{ inputs.retention-days }}",
    })
    expect(jobs["assemble-linux"]?.needs).toEqual(["build", "bundle-linux"])
    expect(
      jobs["assemble-linux"]?.steps?.find(({ name }) => name === "Assemble and validate complete installer row")?.run,
    ).toContain("package:gui-installer-matrix --skip-build")
    expect(jobs["assemble-linux"]?.steps?.find(({ uses }) => uses === "actions/upload-artifact@v7")?.with?.name).toBe(
      "overlay-${{ inputs.platform }}",
    )
    expect(jobs.build?.steps?.find(({ name }) => name === "Verify version alignment")?.run).toBe(
      'bun ./script/sync-version.ts ${VERSION:+"$VERSION"} --check',
    )
  })

  test("retains first-run evidence at the packaging runtime and stages the two package families", async () => {
    const release = await readWorkflow("build.yml")
    const build = await readWorkflow("test.yml")
    const overlay = await readWorkflow("package-overlay.yml")
    const evidence = [build.jobs?.verify, overlay.jobs?.build, release.jobs?.["package-cli"]].map((job) =>
      job?.steps?.find((step) => step.name === "Retain failed native first-run diagnostics"),
    )
    expect(evidence.map((step) => ({ if: step?.if, uses: step?.uses, with: step?.with }))).toEqual(
      [
        "failed-native-first-run",
        "first-run-diagnostics-overlay-${{ inputs.platform }}",
        "first-run-diagnostics-cli-${{ matrix.platform }}",
      ].map((name, index) => ({
        if: "failure()",
        uses: "actions/upload-artifact@v7",
        with: {
          name,
          path: ".scratch/package-runtime/tmp/opencorvus-first-run-*/",
          "include-hidden-files": true,
          "if-no-files-found": "ignore",
          "retention-days": index === 1 ? "${{ inputs.retention-days }}" : 7,
          ...(index === 1 ? { overwrite: true } : {}),
        },
      })),
    )
    expect(
      release.jobs?.["publish-release-assets"]?.steps
        ?.filter((step) => step.uses === "actions/download-artifact@v8")
        .map((step) => step.with),
    ).toEqual([{ pattern: "{cli,overlay}-*", path: "/tmp/release-assets" }])
  })

  test("uses the current checkout action across every active workflow", async () => {
    const workflowFiles = (await fs.readdir(workflowRoot)).filter((file) => file.endsWith(".yml")).sort()
    const checkoutReferences: Array<{ file: string; job: string; uses: string }> = []

    for (const file of workflowFiles) {
      const workflow = await readWorkflow(file)
      for (const [job, definition] of Object.entries(workflow.jobs ?? {})) {
        for (const step of definition.steps ?? []) {
          if (step.uses?.startsWith("actions/checkout@")) checkoutReferences.push({ file, job, uses: step.uses })
        }
      }
    }

    expect(checkoutReferences).toEqual([
      { file: "build.yml", job: "deadline", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "prepare", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "package-cli", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "publish-release-assets", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "publish-release", uses: "actions/checkout@v6" },
      { file: "codeql.yml", job: "analyze", uses: "actions/checkout@v6" },
      { file: "deploy-opencorvus-com.yml", job: "deadline", uses: "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803" },
      { file: "deploy-opencorvus-com.yml", job: "resolve-source", uses: "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803" },
      {
        file: "deploy-opencorvus-com.yml",
        job: "archive-determinism",
        uses: "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
      },
      {
        file: "deploy-opencorvus-com.yml",
        job: "build",
        uses: "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
      },
      { file: "deploy-opencorvus-com.yml", job: "sign-and-deploy", uses: "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803" },
      { file: "package-overlay.yml", job: "build", uses: "actions/checkout@v6" },
      { file: "package-overlay.yml", job: "bundle-linux", uses: "actions/checkout@v6" },
      { file: "package-overlay.yml", job: "assemble-linux", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "changes", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "audit", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "verify", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "unit", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "services", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "dependency-review", uses: "actions/checkout@v6" },
    ])
  })

  test("resolves the release version to canonical SemVer before any job reads it", async () => {
    /*
     * Every packaging job exports this value as OPENCORVUS_VERSION, and packages/script accepts
     * canonical SemVer only. A `v0.0.48-beta` tag is already canonical once the `v` is stripped,
     * so the tag path never exercised the gap; the dispatch path documents compact input
     * ("0.0.1"-style, and README/RELEASE.md promise `0.0.48beta` works) and passed it through
     * untouched. `0.0.48beta` therefore reached all ten packaging legs and failed each one with
     * "Invalid OPENCORVUS_VERSION", after prepare had reported success.
     *
     * The guard is on the resolve step rather than on a job env, because that step is the single
     * place both trigger paths meet.
     */
    const workflow = await readWorkflow("build.yml")
    const resolve = (workflow.jobs?.prepare?.steps ?? []).find(
      (step: { name?: string }) => step.name === "Resolve release version",
    )

    expect(resolve, "build.yml lost its release-version resolve step").toBeDefined()
    expect(resolve.id).toBe("meta")
    expect(resolve.run).toContain("normalizeReleaseVersion")
    expect(resolve.run).toContain('echo "version=$VERSION" >> "$GITHUB_OUTPUT"')

    expect(resolve.run.match(/^\s*RAW_VERSION=.*$/gm)?.map((line: string) => line.trim())).toEqual([
      'RAW_VERSION="${GITHUB_REF_NAME#v}"',
      'RAW_VERSION="${{ inputs.version }}"',
    ])
  })

  test("dispatches the canonical release workflow from the exact checked upstream source", async () => {
    const dispatcher = await Bun.file(path.join(import.meta.dir, "release")).text()
    const commands = dispatcher
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) =>
        [
          'git fetch --quiet "$REMOTE"',
          "HEAD_SHA=$(git rev-parse 'HEAD^{commit}')",
          "UPSTREAM_SHA=$(git rev-parse '@{upstream}^{commit}')",
          'bun ./script/sync-version.ts "$VERSION" --check',
          "gh workflow run build.yml \\",
          '--repo "$REPOSITORY" \\',
          '--ref "$REMOTE_BRANCH" \\',
          '-f "expected_source_sha=$HEAD_SHA"',
        ].includes(line),
      )
    expect(commands).toEqual([
      'git fetch --quiet "$REMOTE"',
      "HEAD_SHA=$(git rev-parse 'HEAD^{commit}')",
      "UPSTREAM_SHA=$(git rev-parse '@{upstream}^{commit}')",
      'bun ./script/sync-version.ts "$VERSION" --check',
      "gh workflow run build.yml \\",
      '--repo "$REPOSITORY" \\',
      '--ref "$REMOTE_BRANCH" \\',
      '-f "expected_source_sha=$HEAD_SHA"',
    ])
  })

  test("admits the exact Release tag and draft writer before native builds and verifies them before upload", async () => {
    /*
     * prepare freezes source-sha and reserves the tag/draft before native work.
     * A failed preparation never admits a matrix; the same run can resume its
     * draft and retain successful artifacts when a later platform build fails.
     *
     * Upload and public publication each verify both authorities again before mutation.
     */
    const workflow = await readWorkflow("build.yml")
    const prepareSteps = workflow.jobs?.prepare?.steps ?? []
    const assetSteps = workflow.jobs?.["publish-release-assets"]?.steps ?? []
    const claim = prepareSteps.find((step: { name?: string }) => step.name === "Claim immutable release identity")
    const claimPublication = prepareSteps.find(
      (step: { name?: string }) => step.name === "Claim draft publication owner",
    )
    const verifyUpload = assetSteps.find((step: { name?: string }) => step.name === "Verify upload release identity")
    const verifyUploadPublication = assetSteps.find(
      (step: { name?: string }) => step.name === "Verify draft publication owner",
    )
    const stage = assetSteps.find((step: { name?: string }) => step.name === "Upload release assets to GitHub Release")

    expect(claim?.env).toEqual({
      GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      VERSION: "${{ steps.meta.outputs.version }}",
      SOURCE_SHA: "${{ steps.meta.outputs.source-sha }}",
      EVENT_NAME: "${{ github.event_name }}",
      EXPECTED_SOURCE_SHA: "${{ inputs.expected_source_sha || '' }}",
      IDENTITY_MODE: "claim",
    })
    expect(claimPublication?.env).toEqual({
      GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      VERSION: "${{ steps.meta.outputs.version }}",
      SOURCE_SHA: "${{ steps.meta.outputs.source-sha }}",
      EVENT_NAME: "${{ github.event_name }}",
      EXPECTED_SOURCE_SHA: "${{ inputs.expected_source_sha || '' }}",
      RELEASE_RUN_ID: "${{ github.run_id }}",
      PRERELEASE: "${{ steps.meta.outputs.prerelease }}",
      IDENTITY_MODE: "claim-publication",
    })
    expect(verifyUpload?.env).toEqual({
      ...claim?.env,
      VERSION: "${{ needs.prepare.outputs.version }}",
      SOURCE_SHA: "${{ needs.prepare.outputs.source-sha }}",
      IDENTITY_MODE: "verify-owned",
    })
    expect(verifyUploadPublication?.env).toEqual({
      ...claimPublication?.env,
      VERSION: "${{ needs.prepare.outputs.version }}",
      SOURCE_SHA: "${{ needs.prepare.outputs.source-sha }}",
      PRERELEASE: "${{ needs.prepare.outputs.prerelease }}",
      IDENTITY_MODE: "verify-publication",
    })
    expect(prepareSteps.indexOf(claim!)).toBeLessThan(prepareSteps.indexOf(claimPublication!))
    expect(["package-overlay", "package-cli"].map((job) => workflow.jobs?.[job]?.needs)).toEqual(["prepare", "prepare"])
    expect(assetSteps.indexOf(verifyUpload!)).toBeLessThan(assetSteps.indexOf(verifyUploadPublication!))
    expect(assetSteps.indexOf(verifyUploadPublication!)).toBeLessThan(assetSteps.indexOf(stage!))
    expect(stage, "build.yml lost its Release upload step").toBeDefined()
    expect(stage.run).toContain('gh release upload "v${VERSION}" "${FILES[@]}" --clobber')

    const publicationSteps = workflow.jobs?.["publish-release"]?.steps ?? []
    const verifyPublic = publicationSteps.find(
      (step: { name?: string }) => step.name === "Verify public release identity",
    )
    const settlePublic = publicationSteps.find((step: { name?: string }) => step.name === "Settle public release")
    expect(verifyPublic?.env).toEqual({
      GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      VERSION: "${{ needs.prepare.outputs.version }}",
      SOURCE_SHA: "${{ needs.prepare.outputs.source-sha }}",
      EVENT_NAME: "${{ github.event_name }}",
      EXPECTED_SOURCE_SHA: "${{ inputs.expected_source_sha || '' }}",
      IDENTITY_MODE: "verify-owned",
    })
    expect(settlePublic?.env).toEqual({
      GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      VERSION: "${{ needs.prepare.outputs.version }}",
      SOURCE_SHA: "${{ needs.prepare.outputs.source-sha }}",
      EVENT_NAME: "${{ github.event_name }}",
      EXPECTED_SOURCE_SHA: "${{ inputs.expected_source_sha || '' }}",
      RELEASE_RUN_ID: "${{ github.run_id }}",
      PRERELEASE: "${{ needs.prepare.outputs.prerelease }}",
      IDENTITY_MODE: "settle-publication",
    })
    const immutableManifest = publicationSteps.find(
      (step: { name?: string }) => step.name === "Download immutable update manifest",
    )
    const settleChannel = publicationSteps.find(
      (step: { name?: string }) => step.name === "Settle monotonic desktop update channel",
    )
    expect(publicationSteps.indexOf(verifyPublic!)).toBeLessThan(publicationSteps.indexOf(settlePublic!))
    expect(publicationSteps.indexOf(settlePublic!)).toBeLessThan(publicationSteps.indexOf(immutableManifest!))
    expect(publicationSteps.indexOf(immutableManifest!)).toBeLessThan(publicationSteps.indexOf(settleChannel!))

    const dispatch = publicationSteps.find(
      (step: { name?: string }) => step.name === "Dispatch public download page deployment",
    )
    expect(dispatch.id).toBe("website")
    expect(dispatch.env?.SOURCE_SHA).toBe("${{ needs.prepare.outputs.source-sha }}")
    expect(dispatch.run).toBe("bun script/release-automation.ts dispatch-website")
    expect(publicationSteps.find((step) => step.name === "Await exact website deployment result")).toMatchObject({
      env: { WEBSITE_RUN_ID: "${{ steps.website.outputs.run-id }}" },
      run: "bun script/release-automation.ts wait-website",
    })
  })

  test("packages all five native GUI and CLI rows before publishing the release", async () => {
    const workflow = await readWorkflow("build.yml")
    const jobs = workflow.jobs ?? {}

    expect(workflow.on).toEqual({
      push: { tags: ["v*"] },
      workflow_dispatch: {
        inputs: {
          version: {
            description: "Release version (for example 0.0.1 or v0.0.1).",
            required: true,
          },
          expected_source_sha: {
            description: "Exact commit SHA already reviewed and pushed for this release.",
            required: true,
          },
        },
      },
    })
    expect(workflow.concurrency).toEqual({
      group: "opencorvus-release-publication",
      queue: "max",
      "cancel-in-progress": false,
    })

    const nativeMatrix = [
      { runner: "ubuntu-latest", platform: "linux-x64" },
      { runner: "ubuntu-24.04-arm", platform: "linux-arm64" },
      { runner: "macos-latest", platform: "darwin-arm64" },
      { runner: "macos-15-intel", platform: "darwin-x64" },
      { runner: "windows-latest", platform: "windows-x64" },
    ]

    expect(jobs["package-overlay"]?.strategy?.matrix?.include).toEqual(nativeMatrix)
    expect(jobs["package-cli"]?.strategy?.matrix?.include).toEqual(nativeMatrix)
    expect(jobs["package-cli"]?.steps?.find(({ uses }) => uses === "./.github/actions/setup-bun")?.with).toEqual({
      prepare_compile_runtimes: "true",
    })
    expect(jobs["package-cli"]?.steps?.map(({ run }) => run)).toContain("bun run package:binary-matrix")
    const workArtifactQualification = jobs["package-cli"]?.steps?.find(
      ({ name }) => name === "Verify packaged Work Artifact lifecycle",
    )
    expect(workArtifactQualification?.run).toContain("bun packages/opencorvus/script/check-work-artifact-profile.ts \\")
    expect(workArtifactQualification?.run).toContain("--profile office.presentation@1 \\")
    expect(workArtifactQualification?.run).toContain('--package-root "$bundle" | tee "$evidence"')
    expect(workArtifactQualification?.run).toContain('test "$verified" -gt 0')
    for (const job of ["package-cli"]) {
      expect(jobs[job]?.steps?.find(({ name }) => name?.startsWith("Install Windows"))).toEqual({
        name: "Install Windows CLI runtime dependencies",
        if: "runner.os == 'Windows'",
        shell: "pwsh",
        run: "./script/install-windows-ripgrep.ps1",
      })
    }
    const overlayWorkflow = await readWorkflow("package-overlay.yml")
    const runtimeAction = Bun.YAML.parse(
      await Bun.file(path.join(workflowRoot, "../actions/setup-overlay-runtime/action.yml")).text(),
    ) as { runs: { steps: WorkflowStep[] } }
    expect(
      runtimeAction.runs.steps.find(({ name }) => name === "Install Windows overlay runtime dependencies"),
    ).toEqual({
      name: "Install Windows overlay runtime dependencies",
      if: "runner.os == 'Windows'",
      shell: "pwsh",
      run: "./script/install-windows-ripgrep.ps1",
    })
    expect(overlayWorkflow.jobs?.build?.steps?.find(({ name }) => name === "Package GUI installers")?.env).toEqual({
      OPENCORVUS_VERSION: "${{ inputs.version }}",
      OPENCORVUS_CHANNEL: "latest",
      TAURI_SIGNING_PRIVATE_KEY: "${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}",
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}",
    })
    expect(jobs["package-cli"]?.steps?.find(({ uses }) => uses === "actions/upload-artifact@v7")?.with).toEqual({
      name: "cli-${{ matrix.platform }}",
      path: "packages/opencorvus/dist/opencorvus-${{ matrix.platform }}\npackages/opencorvus/dist/opencorvus-${{ matrix.platform }}.tar.gz\npackages/opencorvus/dist/opencorvus-${{ matrix.platform }}-baseline\npackages/opencorvus/dist/opencorvus-${{ matrix.platform }}-baseline.tar.gz\npackages/opencorvus/dist/work-artifact-qualification-opencorvus-${{ matrix.platform }}*.json\n",
      "if-no-files-found": "error",
      "retention-days": 7,
    })
    expect(jobs["publish-release-assets"]?.needs).toEqual(["prepare", "package-overlay", "package-cli"])
    expect(jobs["publish-release"]?.needs).toEqual(["prepare", "publish-release-assets"])
    expect(jobs["publish-release"]?.if).toBe(
      "${{ !cancelled() && needs.publish-release-assets.result == 'success' && needs.publish-release-assets.outputs.complete == 'true' }}",
    )
    expect(jobs.prepare?.outputs).toEqual({
      version: "${{ steps.meta.outputs.version }}",
      prerelease: "${{ steps.meta.outputs.prerelease }}",
      "update-channel": "${{ steps.meta.outputs.update-channel }}",
      "source-sha": "${{ steps.meta.outputs.source-sha }}",
    })
    expect(jobs.prepare?.steps?.find(({ name }) => name === "Resolve release version")?.run).toContain(
      "releaseVersionMetadata(Bun.argv.at(-1)).prerelease",
    )
    expect(jobs.prepare?.steps?.find(({ name }) => name === "Resolve release version")?.run).toContain(
      "git rev-parse 'HEAD^{commit}'",
    )
    const releaseIdentity = jobs.prepare?.steps?.find(({ name }) => name === "Verify immutable release identity")
    expect(releaseIdentity).toEqual({
      name: "Verify immutable release identity",
      shell: "bash",
      env: {
        GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
        VERSION: "${{ steps.meta.outputs.version }}",
        SOURCE_SHA: "${{ steps.meta.outputs.source-sha }}",
        EVENT_NAME: "${{ github.event_name }}",
        EXPECTED_SOURCE_SHA: "${{ inputs.expected_source_sha || '' }}",
        IDENTITY_MODE: "probe",
      },
      run: "bun ./script/verify-release-identity.ts",
    })
    const frozenDependencyGraph = jobs.prepare?.steps?.find(({ name }) => name === "Verify frozen dependency graph")
    expect(frozenDependencyGraph).toEqual({
      name: "Verify frozen dependency graph",
      shell: "bash",
      env: { HUSKY: "0" },
      run: "bun install --frozen-lockfile --no-progress --ignore-scripts",
    })
    expect(jobs.prepare?.steps?.find(({ name }) => name === "Build generated Software Development Kit")).toEqual({
      name: "Build generated Software Development Kit",
      shell: "bash",
      run: "bun run --cwd packages/sdk/js build",
    })
    expect(jobs.prepare?.steps?.find(({ name }) => name === "Verify generated repository fixed point")).toEqual({
      name: "Verify generated repository fixed point",
      shell: "bash",
      run: "bun ./script/generate.ts\nbun ./script/generated-artifacts.ts --check-clean-worktree\n",
    })
    const prepareStepNames = jobs.prepare?.steps?.map(({ name }) => name) ?? []
    expect(prepareStepNames.slice(-9)).toEqual([
      "Verify version alignment",
      "Verify remaining release budget",
      "Verify immutable release identity",
      "Verify frozen dependency graph",
      "Build generated Software Development Kit",
      "Verify generated repository fixed point",
      "Verify publication budget before claiming identity",
      "Claim immutable release identity",
      "Claim draft publication owner",
    ])
    expect(
      ["prepare", "package-cli"].flatMap((job) =>
        (jobs[job]?.steps ?? [])
          .filter(({ name }) => name === "Verify version alignment")
          .map(({ name, run }) => ({ job, name, run })),
      ),
    ).toEqual([
      {
        job: "prepare",
        name: "Verify version alignment",
        run: 'bun ./script/sync-version.ts "${{ steps.meta.outputs.version }}" --check',
      },
      {
        job: "package-cli",
        name: "Verify version alignment",
        run: 'bun ./script/sync-version.ts "${{ needs.prepare.outputs.version }}" --check',
      },
    ])
    expect(jobs.prepare?.steps?.find(({ name }) => name === "Claim draft publication owner")?.env?.PRERELEASE).toBe(
      "${{ steps.meta.outputs.prerelease }}",
    )
    expect(jobs["package-overlay"]?.with).toEqual({
      platform: "${{ matrix.platform }}",
      runner: "${{ matrix.runner }}",
      version: "${{ needs.prepare.outputs.version }}",
      "retention-days": 7,
      "release-run-id": "${{ github.run_id }}",
    })
    expect(jobs["package-overlay"]?.secrets).toEqual({
      TAURI_SIGNING_PRIVATE_KEY: "${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}",
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}",
    })
    expect(
      jobs["publish-release-assets"]?.steps?.find(({ name }) => name === "Upload release assets to GitHub Release")
        ?.run,
    ).toContain("generate-desktop-update-manifest.ts")
    expect(jobs["publish-release"]?.concurrency).toEqual({
      group: "opencorvus-desktop-update-${{ needs.prepare.outputs.update-channel }}",
      queue: "max",
      "cancel-in-progress": false,
    })
    expect(
      jobs["publish-release"]?.steps?.find(({ name }) => name === "Settle monotonic desktop update channel"),
    ).toEqual({
      name: "Settle monotonic desktop update channel",
      id: "update-channel",
      env: {
        GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
        VERSION: "${{ needs.prepare.outputs.version }}",
        UPDATE_CHANNEL: "${{ needs.prepare.outputs.update-channel }}",
        CANDIDATE_MANIFEST: "/tmp/version-update-channel/latest.json",
      },
      run: "bun ./script/settle-desktop-update-channel.ts",
    })
    expect(
      jobs["publish-release"]?.steps?.find(({ name }) => name === "Dispatch public download page deployment"),
    ).toEqual({
      name: "Dispatch public download page deployment",
      id: "website",
      env: {
        GH_TOKEN: "${{ github.token }}",
        VERSION: "${{ needs.prepare.outputs.version }}",
        SOURCE_SHA: "${{ needs.prepare.outputs.source-sha }}",
      },
      run: "bun script/release-automation.ts dispatch-website",
    })
  })

  test("converges every production trigger on the current release download manifest", async () => {
    const workflow = await readWorkflow("deploy-opencorvus-com.yml")
    const jobs = workflow.jobs ?? {}
    expect(workflow.on?.workflow_dispatch).toMatchObject({ inputs: {
      release_version: { type: "string", default: "" },
      release_source_sha: { type: "string", default: "" },
      release_run_id: { type: "string", default: "" },
    } })
    expect(workflow.concurrency).toEqual({
      group: "opencorvus-com-production",
      queue: "max",
      "cancel-in-progress": false,
    })
    expect(jobs["resolve-source"]?.outputs).toEqual({
      "source-sha": "${{ steps.source.outputs.source-sha }}",
    })
    const sourceStep = jobs["resolve-source"]?.steps?.find(({ name }) => name === "Resolve and verify website source")
    expect(sourceStep?.env).toEqual({
      GH_TOKEN: "${{ github.token }}",
      EVENT_SHA: "${{ github.sha }}",
      VERSION: "${{ inputs.release_version || '' }}",
      SOURCE_SHA: "${{ inputs.release_source_sha || '' }}",
      RELEASE_RUN_ID: "${{ inputs.release_run_id || '' }}",
    })
    expect(sourceStep?.run).toBe("bun script/release-automation.ts website-source")
    for (const job of ["archive-determinism", "build"]) {
      expect(jobs[job]?.needs).toBe("resolve-source")
      expect(jobs[job]?.steps?.find(({ uses }) => uses?.startsWith("actions/checkout@"))?.with?.ref).toBe(
        "${{ needs.resolve-source.outputs.source-sha }}",
      )
    }
    expect(jobs["sign-and-deploy"]?.if).toBe(
      "${{ github.event_name == 'workflow_dispatch' || vars.OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED == 'true' }}",
    )
    expect(jobs["sign-and-deploy"]?.needs).toEqual(["resolve-source", "archive-determinism", "build"])
    expect(jobs.build?.steps?.find(({ name }) => name === "Upload frozen unsigned site")?.with?.name).toBe(
      "opencorvus-com-unsigned-${{ needs.resolve-source.outputs.source-sha }}",
    )
    expect(
      jobs["sign-and-deploy"]?.steps?.find(({ name }) => name === "Download frozen unsigned site")?.with?.name,
    ).toBe("opencorvus-com-unsigned-${{ needs.resolve-source.outputs.source-sha }}")
    const freezeStep = jobs["sign-and-deploy"]?.steps?.find(
      ({ name }) => name === "Freeze deploy archive and checksums",
    )
    expect(freezeStep?.env).toEqual({ WEBSITE_SOURCE_SHA: "${{ needs.resolve-source.outputs.source-sha }}" })
    expect(freezeStep?.run).toContain('RELEASE_ID="${WEBSITE_SOURCE_SHA}-')

    const buildSteps = jobs.build?.steps ?? []
    expect(
      buildSteps
        .map(({ name }) => name)
        .filter((name) =>
          ["Install frozen dependencies", "Build SDK dependency", "Verify generated repository fixed point"].includes(
            name ?? "",
          ),
        ),
    ).toEqual(["Install frozen dependencies", "Build SDK dependency", "Verify generated repository fixed point"])
    expect(buildSteps.find(({ name }) => name === "Build SDK dependency")?.run).toBe(
      "bun run --cwd packages/sdk/js build",
    )
    expect(buildSteps.find(({ name }) => name === "Verify generated repository fixed point")).toEqual({
      name: "Verify generated repository fixed point",
      shell: "bash",
      run: "bun ./script/generate.ts\nbun ./script/generated-artifacts.ts --check-clean-worktree\n",
    })
    expect(buildSteps.findIndex(({ name }) => name === "Verify generated repository fixed point")).toBeLessThan(
      buildSteps.findIndex(({ name }) => name === "Generate current public download manifest"),
    )
    const manifestStep = buildSteps.find(({ name }) => name === "Generate current public download manifest")
    expect(manifestStep?.env).toEqual({
      GH_TOKEN: "${{ github.token }}",
      DISPATCH_VERSION: "${{ inputs.release_version || '' }}",
    })
    expect(manifestStep?.run).toContain('gh api --paginate "repos/$GITHUB_REPOSITORY/releases?per_page=100"')
    expect(manifestStep?.run).toContain("generate-website-download-manifest.ts")
    expect(buildSteps.indexOf(manifestStep!)).toBeLessThan(buildSteps.findIndex(({ name }) => name === "Check website"))
  })

  test("consolidates ordinary CI while preserving native, release and website boundaries", async () => {
    const unitWorkflow = await readWorkflow("test.yml")
    const jobs = unitWorkflow.jobs ?? {}
    const releaseWorkflow = await readWorkflow("build.yml")
    const websiteWorkflow = await readWorkflow("deploy-opencorvus-com.yml")

    expect(Object.keys(jobs).sort()).toEqual([
      "audit",
      "changes",
      "dependency-review",
      "required",
      "services",
      "unit",
      "verify",
    ])
    expect(unitWorkflow.on).toEqual({
      push: { branches: ["main"] },
      pull_request: null,
      workflow_dispatch: {
        inputs: {
          test_files: {
            description:
              "Optional newline-separated paths relative to packages/opencorvus; empty runs the complete suite",
            type: "string",
            required: false,
            default: "",
          },
        },
      },
    })
    expect(jobs.unit?.name).toBe(
      "${{ inputs.test_files != '' && 'selected unit' || 'unit' }} (${{ matrix.settings.name }})",
    )
    expect(jobs.required?.name).toBe("${{ inputs.test_files != '' && 'Selected CI passed' || 'CI passed' }}")
    expect(jobs.required?.needs).toEqual(["audit", "verify", "unit", "services", "dependency-review"])
    for (const job of ["audit", "verify"]) {
      expect(jobs[job]?.needs).toBe("changes")
      expect(jobs[job]?.concurrency).toEqual({
        group:
          `ci-${job}-` +
          "${{ needs.changes.outputs.scope }}-${{ github.event_name == 'workflow_dispatch' && github.run_id || github.ref }}",
        "cancel-in-progress": true,
      })
    }
    for (const [job, group] of [
      ["unit", "ci-unit-${{ matrix.settings.name }}"],
      ["services", "ci-services"],
    ]) {
      expect(jobs[job!]?.concurrency).toEqual({
        group: `${group}-` + "${{ github.event_name == 'workflow_dispatch' && github.run_id || github.ref }}",
        "cancel-in-progress": true,
      })
    }
    expect(jobs.unit?.needs).toBe("verify")
    expect(jobs.services?.needs).toBe("verify")
    expect(jobs.unit?.if).toBe("needs.verify.outputs.scope == 'code'")
    expect(jobs.unit?.strategy).toEqual({
      "fail-fast": false,
      matrix: {
        settings: [
          { name: "linux", host: "ubuntu-latest" },
          { name: "macos", host: "macos-latest" },
          { name: "windows", host: "windows-latest" },
        ],
      },
    })
    const selectedStep = jobs.unit?.steps?.find(({ name }) => name === "Run unit tests")
    expect(selectedStep?.env).toEqual({ SELECTED_TEST_FILES: "${{ inputs.test_files || '' }}" })
    expect(selectedStep?.run).toBe(
      'SELECTED=()\nwhile IFS= read -r file || [[ -n "$file" ]]; do\n  if [[ -n "$file" ]]; then SELECTED+=("$file"); fi\ndone <<< "$SELECTED_TEST_FILES"\nbunx turbo run test --filter=opencorvus --log-order=stream -- "${SELECTED[@]}"\n',
    )
    expect(releaseWorkflow.on).toEqual({
      push: { tags: ["v*"] },
      workflow_dispatch: {
        inputs: {
          version: {
            description: "Release version (for example 0.0.1 or v0.0.1).",
            required: true,
          },
          expected_source_sha: {
            description: "Exact commit SHA already reviewed and pushed for this release.",
            required: true,
          },
        },
      },
    })
    expect(websiteWorkflow.on?.push).toEqual({
      branches: ["main"],
      paths: expect.any(Array),
    })

    for (const job of ["verify", "services"]) {
      expect(jobs[job]?.steps?.find(({ uses }) => uses === "./.github/actions/setup-bun")?.with).toEqual({
        prepare_sdk: "true",
      })
    }
    // Every apt install in CI is bounded. The v0.0.47-beta release build held
    // `Install Linux system dependencies` for over an hour, never reached the
    // compiler, and published nothing: `-y` stops neither a debconf prompt nor
    // the runner's own unattended-upgrades holding the lock.
    const boundedApt = (run: string) => ({ "timeout-minutes": 15, env: { DEBIAN_FRONTEND: "noninteractive" }, run })
    const aptRipgrep = "sudo bash script/install-ubuntu-packages.sh ripgrep\n"
    expect(jobs.verify?.steps?.find(({ name }) => name === "Install critical build runtime dependencies")).toEqual({
      name: "Install critical build runtime dependencies",
      if: "needs.changes.outputs.scope == 'code'",
      ...boundedApt(aptRipgrep),
    })
    const unitSteps = jobs.unit?.steps ?? []
    const windowsPythonIndex = unitSteps.findIndex(({ name }) => name === "Setup Windows Python test runtime")
    const unitExecutionIndex = unitSteps.findIndex(({ name }) => name === "Run unit tests")
    expect({
      step: unitSteps[windowsPythonIndex],
      beforeUnitExecution: windowsPythonIndex >= 0 && windowsPythonIndex < unitExecutionIndex,
    }).toEqual({
      step: {
        name: "Setup Windows Python test runtime",
        if: "runner.os == 'Windows'",
        uses: "actions/setup-python@v6",
        with: { "python-version": "3.13" },
      },
      beforeUnitExecution: true,
    })
    expect(jobs.unit?.steps?.filter(({ name }) => name?.startsWith("Install "))).toEqual([
      {
        name: "Install Linux test runtime dependencies",
        if: "runner.os == 'Linux'",
        ...boundedApt(aptRipgrep),
      },
      {
        name: "Install macOS test runtime dependencies",
        if: "runner.os == 'macOS'",
        run: "brew install ripgrep",
      },
      {
        name: "Install Windows test runtime dependencies",
        if: "runner.os == 'Windows'",
        shell: "pwsh",
        run: "./script/install-windows-ripgrep.ps1\nbun packages/opencorvus/script/prepare-test-process-supervisor.ts\n",
      },
    ])
  })

  test("bootstraps every generator consumer and preserves the preload-owned unit process", async () => {
    for (const file of ["test.yml"]) {
      const workflow = await readWorkflow(file)
      const setup = (workflow.jobs?.verify?.steps ?? []).find(({ uses }) => uses === "./.github/actions/setup-bun")
      expect(setup?.with).toEqual({ prepare_sdk: "true" })
    }

    const packageDefinition = await Bun.file(
      path.join(import.meta.dir, "..", "packages", "opencorvus", "package.json"),
    ).json()
    expect(packageDefinition.scripts.test).toBe("bun script/run-tests.ts")
  })
})
