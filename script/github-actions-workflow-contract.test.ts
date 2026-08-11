import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

type WorkflowStep = {
  name?: string
  shell?: string
  uses?: string
  run?: string
  env?: Record<string, string>
  with?: Record<string, unknown>
}

type WorkflowJob = {
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
      { file: "build-overlays.yml", job: "build-overlay", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "prepare", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "package-overlay", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "package-cli", uses: "actions/checkout@v6" },
      { file: "build.yml", job: "publish-release-assets", uses: "actions/checkout@v6" },
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
      { file: "test.yml", job: "version-sync", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "unit", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "build-critical", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "channel-runtime-unit", uses: "actions/checkout@v6" },
      { file: "test.yml", job: "overlay-unit", uses: "actions/checkout@v6" },
      { file: "typecheck.yml", job: "typecheck", uses: "actions/checkout@v6" },
    ])
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
        },
      },
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
    expect(jobs["package-cli"]?.steps?.find(({ uses }) => uses === "actions/upload-artifact@v7")?.with).toEqual({
      name: "cli-${{ matrix.platform }}",
      path: "packages/opencorvus/dist/opencorvus-${{ matrix.platform }}\npackages/opencorvus/dist/opencorvus-${{ matrix.platform }}.tar.gz\npackages/opencorvus/dist/opencorvus-${{ matrix.platform }}-baseline\npackages/opencorvus/dist/opencorvus-${{ matrix.platform }}-baseline.tar.gz\n",
      "if-no-files-found": "error",
      "retention-days": 7,
    })
    expect(jobs["publish-release-assets"]?.needs).toEqual(["prepare", "package-overlay", "package-cli"])
    expect(jobs["publish-release"]?.needs).toEqual(["prepare", "publish-release-assets"])
    expect(jobs.prepare?.outputs).toEqual({
      version: "${{ steps.meta.outputs.version }}",
      prerelease: "${{ steps.meta.outputs.prerelease }}",
      "update-channel": "${{ steps.meta.outputs.update-channel }}",
    })
    expect(jobs.prepare?.steps?.find(({ name }) => name === "Resolve release version")?.run).toContain(
      "releaseVersionMetadata(Bun.argv.at(-1)).prerelease",
    )
    expect(
      jobs["publish-release-assets"]?.steps?.find(({ name }) => name === "Upload release assets to GitHub Release")
        ?.run,
    ).toContain('--prerelease="${{ needs.prepare.outputs.prerelease }}"')
    expect(jobs["package-overlay"]?.steps?.find(({ name }) => name === "Package GUI installers")?.env).toEqual({
      OPENCORVUS_VERSION: "${{ needs.prepare.outputs.version }}",
      OPENCORVUS_CHANNEL: "latest",
      OPENCORVUS_UPDATER_PUBLIC_KEY: "${{ secrets.OPENCORVUS_UPDATER_PUBLIC_KEY }}",
      TAURI_SIGNING_PRIVATE_KEY: "${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}",
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}",
    })
    expect(
      jobs["publish-release-assets"]?.steps?.find(({ name }) => name === "Upload release assets to GitHub Release")
        ?.run,
    ).toContain("generate-desktop-update-manifest.ts")
    expect(jobs["publish-release"]?.steps?.find(({ name }) => name === "Publish verified draft")).toEqual({
      name: "Publish verified draft",
      env: {
        GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
        VERSION: "${{ needs.prepare.outputs.version }}",
        PRERELEASE: "${{ needs.prepare.outputs.prerelease }}",
        UPDATE_CHANNEL: "${{ needs.prepare.outputs.update-channel }}",
      },
      run: 'gh release edit "v${VERSION}" --draft=false --prerelease="${PRERELEASE}" --repo "$GITHUB_REPOSITORY"\nCHANNEL_TAG="desktop-update-${UPDATE_CHANNEL}"\nif ! gh release view "$CHANNEL_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then\n  gh release create "$CHANNEL_TAG" \\\n    --prerelease \\\n    --title "OpenCorvus ${UPDATE_CHANNEL} desktop update channel" \\\n    --notes "Mutable signed desktop update metadata. Installers remain in immutable versioned releases." \\\n    --repo "$GITHUB_REPOSITORY"\nfi\nCHANNEL_DIR="$(mktemp -d)"\ngh release download "v${VERSION}" --pattern latest.json --dir "$CHANNEL_DIR" --repo "$GITHUB_REPOSITORY"\ngh release upload "$CHANNEL_TAG" "$CHANNEL_DIR/latest.json" --clobber --repo "$GITHUB_REPOSITORY"\n',
    })
    expect(
      jobs["publish-release"]?.steps?.find(({ name }) => name === "Dispatch public download page deployment"),
    ).toEqual({
      name: "Dispatch public download page deployment",
      env: {
        GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
        VERSION: "${{ needs.prepare.outputs.version }}",
      },
      run: 'gh api --method POST "repos/$GITHUB_REPOSITORY/dispatches" \\\n  -f event_type=opencorvus-release-published \\\n  -F "client_payload[version]=$VERSION"\n',
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
    expect(jobs["sign-and-deploy"]?.if).toBe(
      "${{ github.event_name == 'workflow_dispatch' || github.event_name == 'repository_dispatch' || vars.OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED == 'true' }}",
    )

    const buildSteps = jobs.build?.steps ?? []
    const manifestStep = buildSteps.find(({ name }) => name === "Generate current public download manifest")
    expect(manifestStep?.env).toEqual({
      GH_TOKEN: "${{ github.token }}",
      DISPATCH_VERSION: "${{ github.event.client_payload.version || '' }}",
    })
    expect(manifestStep?.run).toContain('gh api --paginate "repos/$GITHUB_REPOSITORY/releases?per_page=100"')
    expect(manifestStep?.run).toContain("generate-website-download-manifest.ts")
    expect(buildSteps.indexOf(manifestStep!)).toBeLessThan(buildSteps.findIndex(({ name }) => name === "Check website"))
  })

  test("prepares generated dependencies and native runtime tools before push verification", async () => {
    const workflow = await readWorkflow("test.yml")
    const jobs = workflow.jobs ?? {}

    for (const job of ["build-critical", "channel-runtime-unit", "overlay-unit"]) {
      expect(jobs[job]?.steps?.find(({ uses }) => uses === "./.github/actions/setup-bun")?.with).toEqual({
        prepare_sdk: "true",
      })
    }
    expect(
      jobs["build-critical"]?.steps?.find(({ name }) => name === "Install critical build runtime dependencies"),
    ).toEqual({
      name: "Install critical build runtime dependencies",
      run: "sudo apt-get update\nsudo apt-get install -y ripgrep\n",
    })
    expect(jobs.unit?.steps?.filter(({ name }) => name?.startsWith("Install "))).toEqual([
      {
        name: "Install Linux test runtime dependencies",
        if: "runner.os == 'Linux'",
        run: "sudo apt-get update\nsudo apt-get install -y ripgrep\n",
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
        run: "./script/install-windows-ripgrep.ps1",
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
    expect(packageDefinition.scripts.test).toBe(
      "bun script/run-with-inactivity.ts --inactivity-ms 120000 -- bun script/run-test-files.ts --concurrency 2 test",
    )
  })
})
