import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

type WorkflowStep = {
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

type WorkflowJob = {
  needs?: string | string[]
  strategy?: {
    matrix?: {
      include?: Array<{ runner: string; platform: string }>
    }
  }
  steps?: WorkflowStep[]
}

type Workflow = {
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

    expect(checkoutReferences).toHaveLength(16)
    expect(checkoutReferences.map(({ uses }) => uses)).toEqual(checkoutReferences.map(() => "actions/checkout@v6"))
  })

  test("packages all five native GUI and CLI rows before publishing the release", async () => {
    const workflow = await readWorkflow("build.yml")
    const jobs = workflow.jobs ?? {}

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
    expect(jobs["package-cli"]?.steps?.find(({ uses }) => uses === "actions/upload-artifact@v7")?.with).toEqual({
      name: "cli-${{ matrix.platform }}",
      path: "packages/opencorvus/dist/opencorvus-${{ matrix.platform }}\npackages/opencorvus/dist/opencorvus-${{ matrix.platform }}.tar.gz\npackages/opencorvus/dist/opencorvus-${{ matrix.platform }}-baseline\npackages/opencorvus/dist/opencorvus-${{ matrix.platform }}-baseline.tar.gz\n",
      "if-no-files-found": "error",
      "retention-days": 7,
    })
    expect(jobs["publish-release-assets"]?.needs).toEqual(["prepare", "package-overlay", "package-cli"])
    expect(jobs["publish-release"]?.needs).toEqual(["prepare", "publish-release-assets"])
  })
})
