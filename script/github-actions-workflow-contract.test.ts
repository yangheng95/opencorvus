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
  "working-directory"?: string
}

type WorkflowJob = {
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
  concurrency?: Record<string, unknown>
  jobs?: Record<string, WorkflowJob>
}

const workflowRoot = path.join(import.meta.dir, "..", ".github", "workflows")

async function readWorkflow(file: string): Promise<Workflow> {
  return Bun.YAML.parse(await Bun.file(path.join(workflowRoot, file)).text()) as Workflow
}

describe("GitHub Actions workflow contract", () => {
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
      { file: "build-check.yml", job: "version-sync", uses: "actions/checkout@v6" },
      { file: "build-check.yml", job: "build-critical", uses: "actions/checkout@v6" },
      { file: "build-overlays.yml", job: "build-overlay", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "prepare", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "package-overlay", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "package-cli", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "publish-release-assets", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "publish-release", uses: "actions/checkout@v6" },
      { file: "codeql.yml", job: "analyze", uses: "actions/checkout@v6" },
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
      { file: "generate.yml", job: "verify", uses: "actions/checkout@v6" },
      { file: "security.yml", job: "repository", uses: "actions/checkout@v6" },
      { file: "security.yml", job: "dependency-review", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "unit", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "channel-runtime-unit", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "overlay-unit", uses: "actions/checkout@v6" },
      { file: "typecheck.yml", job: "typecheck", uses: "actions/checkout@v6" },
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

    // The normalized value is what leaves the step, so the raw input must land somewhere else.
    for (const assignment of ['VERSION="${GITHUB_REF_NAME#v}"', 'VERSION="${{ inputs.version }}"']) {
      expect(resolve.run, `raw input still assigned straight to VERSION: ${assignment}`).not.toContain(
        `\n            ${assignment}`,
      )
    }
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

  test("atomically owns the Release tag and draft writer at the commit its binaries were built from", async () => {
    /*
     * prepare freezes source-sha at the start of the run. Two workflow dispatches can race after
     * prepare has observed the same version as available, including when both use the same source.
     * The publication boundary therefore atomically creates the Git ref and rereads its canonical
     * target, then atomically assigns the draft to exactly one workflow-run receipt.
     *
     * Upload and public publication each verify both authorities again before mutation.
     */
    const workflow = await readWorkflow("build.yml")
    const assetSteps = workflow.jobs?.["publish-release-assets"]?.steps ?? []
    const claim = assetSteps.find((step: { name?: string }) => step.name === "Claim immutable release identity")
    const claimPublication = assetSteps.find((step: { name?: string }) => step.name === "Claim draft publication owner")
    const verifyUpload = assetSteps.find((step: { name?: string }) => step.name === "Verify upload release identity")
    const verifyUploadPublication = assetSteps.find(
      (step: { name?: string }) => step.name === "Verify draft publication owner",
    )
    const stage = assetSteps.find((step: { name?: string }) => step.name === "Upload release assets to GitHub Release")

    expect(claim?.env).toEqual({
      GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      VERSION: "${{ needs.prepare.outputs.version }}",
      SOURCE_SHA: "${{ needs.prepare.outputs.source-sha }}",
      EVENT_NAME: "${{ github.event_name }}",
      EXPECTED_SOURCE_SHA: "${{ inputs.expected_source_sha || '' }}",
      IDENTITY_MODE: "claim",
    })
    expect(claimPublication?.env).toEqual({
      GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      VERSION: "${{ needs.prepare.outputs.version }}",
      SOURCE_SHA: "${{ needs.prepare.outputs.source-sha }}",
      EVENT_NAME: "${{ github.event_name }}",
      EXPECTED_SOURCE_SHA: "${{ inputs.expected_source_sha || '' }}",
      RELEASE_RUN_ID: "${{ github.run_id }}",
      PRERELEASE: "${{ needs.prepare.outputs.prerelease }}",
      IDENTITY_MODE: "claim-publication",
    })
    expect(verifyUpload?.env).toEqual({ ...claim?.env, IDENTITY_MODE: "verify-owned" })
    expect(verifyUploadPublication?.env).toEqual({
      ...claimPublication?.env,
      IDENTITY_MODE: "verify-publication",
    })
    expect(assetSteps.indexOf(claim!)).toBeLessThan(assetSteps.indexOf(claimPublication!))
    expect(assetSteps.indexOf(claimPublication!)).toBeLessThan(assetSteps.indexOf(verifyUpload!))
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
    expect(dispatch.if).toBe("${{ steps.update-channel.outputs.promoted == 'true' }}")
    expect(dispatch.env?.SOURCE_SHA).toBe("${{ needs.prepare.outputs.source-sha }}")
    expect(dispatch.run).toContain("client_payload[source_sha]=$SOURCE_SHA")
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
    for (const job of ["package-overlay", "package-cli"]) {
      expect(jobs[job]?.steps?.find(({ name }) => name?.startsWith("Install Windows"))).toEqual({
        name:
          job === "package-overlay"
            ? "Install Windows overlay runtime dependencies"
            : "Install Windows CLI runtime dependencies",
        if: "runner.os == 'Windows'",
        shell: "pwsh",
        run: "./script/install-windows-ripgrep.ps1",
      })
    }
    const overlayWorkflow = await readWorkflow("build-overlays.yml")
    expect(
      overlayWorkflow.jobs?.["build-overlay"]?.steps?.find(
        ({ name }) => name === "Install Windows runtime dependencies",
      ),
    ).toEqual({
      name: "Install Windows runtime dependencies",
      if: "runner.os == 'Windows'",
      shell: "pwsh",
      run: "./script/install-windows-ripgrep.ps1",
    })
    expect(
      overlayWorkflow.jobs?.["build-overlay"]?.steps?.find(({ name }) => name === "Package GUI installers")?.env,
    ).toEqual({
      OPENCORVUS_VERSION: "${{ steps.version.outputs.version }}",
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
    const prepareStepNames = jobs.prepare?.steps?.map(({ name }) => name) ?? []
    expect(prepareStepNames.slice(-3)).toEqual([
      "Verify version alignment",
      "Verify immutable release identity",
      "Verify frozen dependency graph",
    ])
    expect(
      ["prepare", "package-overlay", "package-cli"].flatMap((job) =>
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
        job: "package-overlay",
        name: "Verify version alignment",
        run: 'bun ./script/sync-version.ts "${{ needs.prepare.outputs.version }}" --check',
      },
      {
        job: "package-cli",
        name: "Verify version alignment",
        run: 'bun ./script/sync-version.ts "${{ needs.prepare.outputs.version }}" --check',
      },
    ])
    expect(
      jobs["publish-release-assets"]?.steps?.find(({ name }) => name === "Claim draft publication owner")?.env
        ?.PRERELEASE,
    ).toBe("${{ needs.prepare.outputs.prerelease }}")
    expect(jobs["package-overlay"]?.steps?.find(({ name }) => name === "Package GUI installers")?.env).toEqual({
      OPENCORVUS_VERSION: "${{ needs.prepare.outputs.version }}",
      OPENCORVUS_CHANNEL: "latest",
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
      if: "${{ steps.update-channel.outputs.promoted == 'true' }}",
      env: {
        GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
        VERSION: "${{ needs.prepare.outputs.version }}",
        SOURCE_SHA: "${{ needs.prepare.outputs.source-sha }}",
      },
      run: 'TAG="v${VERSION}"\ngh api --method POST "repos/$GITHUB_REPOSITORY/dispatches" \\\n  -f event_type=opencorvus-release-published \\\n  -f "client_payload[version]=$VERSION" \\\n  -f "client_payload[tag]=$TAG" \\\n  -f "client_payload[source_sha]=$SOURCE_SHA"\n',
    })
  })

  test("converges every production trigger on the current release download manifest", async () => {
    const workflow = await readWorkflow("deploy-opencorvus-com.yml")
    const jobs = workflow.jobs ?? {}
    expect(workflow.on?.repository_dispatch).toEqual({ types: ["opencorvus-release-published"] })
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
      EVENT_NAME: "${{ github.event_name }}",
      EVENT_SHA: "${{ github.sha }}",
      DISPATCH_VERSION: "${{ github.event.client_payload.version || '' }}",
      DISPATCH_TAG: "${{ github.event.client_payload.tag || '' }}",
      DISPATCH_SOURCE_SHA: "${{ github.event.client_payload.source_sha || '' }}",
    })
    expect(sourceStep?.run).toContain('gh api "repos/$GITHUB_REPOSITORY/git/ref/tags/$DISPATCH_TAG"')
    expect(sourceStep?.run).toContain('gh api "repos/$GITHUB_REPOSITORY/git/tags/$OBJECT_SHA"')
    expect(sourceStep?.run).toContain('test "$OBJECT_TYPE" = "commit"')
    expect(sourceStep?.run).toContain('test "$OBJECT_SHA" = "$DISPATCH_SOURCE_SHA"')
    expect(sourceStep?.run).toContain('echo "source-sha=$SOURCE_SHA" >> "$GITHUB_OUTPUT"')
    for (const job of ["archive-determinism", "build"]) {
      expect(jobs[job]?.needs).toBe("resolve-source")
      expect(jobs[job]?.steps?.find(({ uses }) => uses?.startsWith("actions/checkout@"))?.with?.ref).toBe(
        "${{ needs.resolve-source.outputs.source-sha }}",
      )
    }
    expect(jobs["sign-and-deploy"]?.if).toBe(
      "${{ github.event_name == 'workflow_dispatch' || github.event_name == 'repository_dispatch' || vars.OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED == 'true' }}",
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
    const manifestStep = buildSteps.find(({ name }) => name === "Generate current public download manifest")
    expect(manifestStep?.env).toEqual({
      GH_TOKEN: "${{ github.token }}",
      DISPATCH_VERSION: "${{ github.event.client_payload.version || '' }}",
    })
    expect(manifestStep?.run).toContain('gh api --paginate "repos/$GITHUB_REPOSITORY/releases?per_page=100"')
    expect(manifestStep?.run).toContain("generate-website-download-manifest.ts")
    expect(buildSteps.indexOf(manifestStep!)).toBeLessThan(buildSteps.findIndex(({ name }) => name === "Check website"))

    const archiveVerification = jobs["archive-determinism"]?.steps?.find(
      ({ name }) => name === "Verify fixed canonical archive bytes",
    )
    expect(archiveVerification).toMatchObject({
      "working-directory": "packages/opencorvus",
      run: "bun test test/expert-squad/static-distribution-archive.test.ts",
    })
    expect(buildSteps.find(({ name }) => name === "Verify canonical OpenCorvus Expert Squad archives")).toMatchObject({
      "working-directory": "packages/opencorvus",
      run: "bun test test/expert-squad/static-distribution-archive.test.ts",
    })
    expect(buildSteps.find(({ name }) => name === "Verify canonical website Expert Squad archives")).toMatchObject({
      "working-directory": "packages/web",
      run: "bun test test/expert-squad-static-distribution.test.ts test/expert-squad-publication.test.ts",
    })
  })

  test("separates unit, build, and website workflows with their required preparation", async () => {
    const unitWorkflow = await readWorkflow("test.yml")
    const jobs = unitWorkflow.jobs ?? {}
    const buildWorkflow = await readWorkflow("build-check.yml")
    const buildJobs = buildWorkflow.jobs ?? {}
    const releaseWorkflow = await readWorkflow("build.yml")
    const websiteWorkflow = await readWorkflow("deploy-opencorvus-com.yml")

    expect(Object.keys(jobs).sort()).toEqual(["channel-runtime-unit", "overlay-unit", "required", "unit"])
    expect(Object.keys(buildJobs).sort()).toEqual(["build-critical", "required", "version-sync"])
    expect(unitWorkflow.on).toEqual({ push: { branches: ["**"] }, pull_request: null, workflow_dispatch: null })
    expect(buildWorkflow.on).toEqual({ push: { branches: ["**"] }, pull_request: null, workflow_dispatch: null })
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

    for (const job of ["channel-runtime-unit", "overlay-unit"]) {
      expect(jobs[job]?.steps?.find(({ uses }) => uses === "./.github/actions/setup-bun")?.with).toEqual({
        prepare_sdk: "true",
      })
    }
    // Every apt install in CI is bounded. The v0.0.47-beta release build held
    // `Install Linux system dependencies` for over an hour, never reached the
    // compiler, and published nothing: `-y` stops neither a debconf prompt nor
    // the runner's own unattended-upgrades holding the lock.
    const boundedApt = (run: string) => ({ "timeout-minutes": 15, env: { DEBIAN_FRONTEND: "noninteractive" }, run })
    // Retries and a short per-request timeout because the x64 runner's Ubuntu
    // mirror served packages at a flat thirty seconds each during v0.0.47-beta,
    // regardless of size — a stalled connection, not bandwidth. Failing that
    // request fast and retrying beats waiting out every package in the tree.
    const aptOptions = "-o DPkg::Lock::Timeout=300 -o Acquire::Retries=5 -o Acquire::http::Timeout=20"
    const aptRipgrep = `sudo apt-get ${aptOptions} update\nsudo apt-get ${aptOptions} install -y ripgrep\n`
    expect(
      buildJobs["build-critical"]?.steps?.find(({ name }) => name === "Install critical build runtime dependencies"),
    ).toEqual({
      name: "Install critical build runtime dependencies",
      ...boundedApt(aptRipgrep),
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
    for (const file of ["generate.yml", "typecheck.yml"]) {
      const workflow = await readWorkflow(file)
      const setup = Object.values(workflow.jobs ?? {})
        .flatMap((job) => job.steps ?? [])
        .find(({ uses }) => uses === "./.github/actions/setup-bun")
      expect(setup?.with).toEqual({ prepare_sdk: "true" })
    }

    const packageDefinition = await Bun.file(
      path.join(import.meta.dir, "..", "packages", "opencorvus", "package.json"),
    ).json()
    expect(packageDefinition.scripts.test).toBe("bun script/run-tests.ts")
  })
})
