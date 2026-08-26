import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { replaceGeneratedArtifactsAfterSuccessfulBuild } from "../script/generation-transaction"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function packageRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "sdk-generation-"))
  roots.push(root)
  return root
}

const artifacts = [
  { stagingRelative: "first.txt", targetRelative: "first.txt", kind: "file" as const },
  { stagingRelative: "second.txt", targetRelative: "second.txt", kind: "file" as const },
]

async function build(root: string, first: string, second: string) {
  await mkdir(root, { recursive: true })
  await writeFile(path.join(root, "first.txt"), first)
  await writeFile(path.join(root, "second.txt"), second)
}

async function published(root: string) {
  return {
    first: await readFile(path.join(root, "first.txt"), "utf8").catch(() => undefined),
    second: await readFile(path.join(root, "second.txt"), "utf8").catch(() => undefined),
  }
}

/** The occurrences the journal still holds. A settled generation leaves none. */
async function openOccurrences(root: string): Promise<string[]> {
  return readdir(path.join(root, ".generation-journal", "sdk-generation")).catch(() => [])
}

async function waitForPath(target: string) {
  const deadline = Date.now() + 30_000
  while (
    !(await readFile(target).then(
      () => true,
      () => false,
    ))
  ) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
    await Bun.sleep(10)
  }
}

/**
 * Write the exact durable state a death mid-publication leaves: an occurrence
 * naming the generation's whole target set, with the backups still holding the
 * previous generation.
 */
async function abandonGeneration(root: string, targets: { targetRelative: string; existed: boolean }[]): Promise<void> {
  const journal = path.join(root, ".generation-journal", "sdk-generation", "abandoned-generation")
  await mkdir(journal, { recursive: true })
  await writeFile(
    path.join(journal, "intent.json"),
    JSON.stringify({
      schemaVersion: 1,
      occurrenceID: "abandoned-generation",
      kind: "sdk-generation",
      subject: `sdk-generation:${root}`,
      payload: {
        packageRoot: root,
        targets: targets.map((target) => ({
          targetRelative: target.targetRelative,
          backupRelative: path.join(".staging-backup", target.targetRelative),
          kind: "file",
          existed: target.existed,
        })),
      },
      timeCreated: Date.now(),
    }),
  )
}

describe("a generation publishes all of its outputs or none", () => {
  test("equivalent package-root spellings serialize two process publishers onto one generation lock", async () => {
    const root = await packageRoot()
    const barrier = await mkdtemp(path.join(tmpdir(), "sdk-generation-lock-barrier-"))
    roots.push(barrier)
    const worker = path.join(import.meta.dir, "fixture", "generation-transaction-process-worker.ts")
    const equivalentRoot = `${root}${path.sep}..${path.sep}${path.basename(root)}`
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (packageRootSpelling: string, label: "first" | "second") => {
      const child = Bun.spawn([process.execPath, worker, packageRootSpelling, barrier, label], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as {
        label: "first" | "second"
        previousGenerationAtEntry?: { first?: string; second?: string }
      }
    }

    const first = spawn(root, "first")
    try {
      await waitForPath(path.join(barrier, "first-entered"))
      const second = spawn(equivalentRoot, "second")
      const results = await Promise.all([read(first), read(second)])
      const secondResult = results.find((result) => result.label === "second")
      expect({
        generationAtSecondEntry: secondResult?.previousGenerationAtEntry,
        artifacts: await published(root),
        occurrences: await openOccurrences(root),
      }).toEqual({
        generationAtSecondEntry: { first: "first-first", second: "first-second" },
        artifacts: { first: "second-first", second: "second-second" },
        occurrences: [],
      })
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill()
      }
      await Promise.allSettled(children.map((child) => child.exited))
    }
  }, 60_000)

  test("a completed generation replaces every target and settles its occurrence", async () => {
    const root = await packageRoot()
    await replaceGeneratedArtifactsAfterSuccessfulBuild({
      packageRoot: root,
      stagingRelative: ".staging",
      artifacts,
      build: (staging) => build(staging, "gen-1-first", "gen-1-second"),
    })
    expect({ ...(await published(root)), occurrences: await openOccurrences(root) }).toEqual({
      first: "gen-1-first",
      second: "gen-1-second",
      occurrences: [],
    })
  }, 60_000)

  test("a generation that fails while publishing restores the previous complete generation", async () => {
    const root = await packageRoot()
    await replaceGeneratedArtifactsAfterSuccessfulBuild({
      packageRoot: root,
      stagingRelative: ".staging",
      artifacts,
      build: (staging) => build(staging, "gen-1-first", "gen-1-second"),
    })

    // The second generation's build succeeds but its publication fails: the
    // staged tree is missing one of the two final outputs, so the copy loop
    // throws after having already replaced the first target — exactly the
    // mixed generation this transaction exists to prevent.
    await expect(
      replaceGeneratedArtifactsAfterSuccessfulBuild({
        packageRoot: root,
        stagingRelative: ".staging",
        artifacts,
        build: async (staging) => {
          await mkdir(staging, { recursive: true })
          await writeFile(path.join(staging, "first.txt"), "gen-2-first")
        },
      }),
    ).rejects.toThrow()

    // Neither half of generation 2 survives, and the failed occurrence settled.
    expect({ ...(await published(root)), occurrences: await openOccurrences(root) }).toEqual({
      first: "gen-1-first",
      second: "gen-1-second",
      occurrences: [],
    })
  }, 60_000)

  test("the next build converges an abandoned generation before it stages anything", async () => {
    const root = await packageRoot()
    const backupRoot = path.join(root, ".staging-backup")
    await mkdir(backupRoot, { recursive: true })
    await writeFile(path.join(backupRoot, "first.txt"), "gen-1-first")
    await writeFile(path.join(backupRoot, "second.txt"), "gen-1-second")
    await writeFile(path.join(root, "first.txt"), "gen-2-first-partial")
    await writeFile(path.join(root, "second.txt"), "gen-1-second")
    await abandonGeneration(root, [
      { targetRelative: "first.txt", existed: true },
      { targetRelative: "second.txt", existed: true },
    ])

    // This build's own publication never runs, so the only thing that can put
    // generation 1 back on disk is convergence.
    await expect(
      replaceGeneratedArtifactsAfterSuccessfulBuild({
        packageRoot: root,
        stagingRelative: ".staging",
        artifacts,
        build: async () => {
          throw new Error("generation 3 never built")
        },
      }),
    ).rejects.toThrow("generation 3 never built")

    expect({ ...(await published(root)), occurrences: await openOccurrences(root) }).toEqual({
      first: "gen-1-first",
      second: "gen-1-second",
      occurrences: [],
    })
  }, 60_000)

  test("a journal naming a different tree is refused instead of rolled back from", async () => {
    const root = await packageRoot()
    const backupRoot = path.join(root, ".staging-backup")
    await mkdir(backupRoot, { recursive: true })
    await writeFile(path.join(backupRoot, "first.txt"), "another-tree-gen-1")
    await writeFile(path.join(root, "first.txt"), "this-tree-content")

    // A journal that arrived with a copied checkout: it names a tree that is
    // not this one, so its backups describe a different generation entirely.
    const journal = path.join(root, ".generation-journal", "sdk-generation", "foreign-generation")
    await mkdir(journal, { recursive: true })
    await writeFile(
      path.join(journal, "intent.json"),
      JSON.stringify({
        schemaVersion: 1,
        occurrenceID: "foreign-generation",
        kind: "sdk-generation",
        subject: `sdk-generation:${root}`,
        payload: {
          packageRoot: path.join(root, "..", "some-other-checkout"),
          targets: [
            {
              targetRelative: "first.txt",
              backupRelative: path.join(".staging-backup", "first.txt"),
              kind: "file",
              existed: true,
            },
          ],
        },
        timeCreated: Date.now(),
      }),
    )

    await expect(
      replaceGeneratedArtifactsAfterSuccessfulBuild({
        packageRoot: root,
        stagingRelative: ".staging",
        artifacts,
        build: (staging) => build(staging, "gen-x-first", "gen-x-second"),
      }),
    ).rejects.toThrow("belongs to")

    // The build stopped before staging anything, so this tree is exactly as it
    // was rather than wearing another tree's generation.
    expect(await readFile(path.join(root, "first.txt"), "utf8")).toBe("this-tree-content")
  }, 60_000)

  test("convergence leaves a target the abandoned generation never named untouched", async () => {
    const root = await packageRoot()
    const backupRoot = path.join(root, ".staging-backup")
    await mkdir(backupRoot, { recursive: true })
    await writeFile(path.join(backupRoot, "first.txt"), "gen-1-first")
    await writeFile(path.join(root, "first.txt"), "gen-2-first-partial")

    // A tracked file that a later build learned to generate. The abandoned
    // generation predates it and never touched it, so its rollback must not
    // reach it — the build's own artifact list is not the rollback's authority.
    await writeFile(path.join(root, "second.txt"), "tracked-and-never-generated")
    await abandonGeneration(root, [{ targetRelative: "first.txt", existed: true }])

    await expect(
      replaceGeneratedArtifactsAfterSuccessfulBuild({
        packageRoot: root,
        stagingRelative: ".staging",
        artifacts,
        build: async () => {
          throw new Error("the build after the artifact list grew")
        },
      }),
    ).rejects.toThrow("the build after the artifact list grew")

    expect(await published(root)).toEqual({
      first: "gen-1-first",
      second: "tracked-and-never-generated",
    })
  }, 60_000)
})
