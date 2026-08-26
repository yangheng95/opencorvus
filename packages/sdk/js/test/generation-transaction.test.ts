import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
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

describe("a generation publishes all of its outputs or none", () => {
  test("a completed generation replaces every target and leaves no journal", async () => {
    const root = await packageRoot()
    await replaceGeneratedArtifactsAfterSuccessfulBuild({
      packageRoot: root,
      stagingRelative: ".staging",
      artifacts,
      build: (staging) => build(staging, "gen-1-first", "gen-1-second"),
    })
    expect({
      ...(await published(root)),
      journal: await readFile(path.join(root, ".generation-journal", "sdk-generation"), "utf8").then(
        () => "present",
        () => "absent",
      ),
    }).toEqual({ first: "gen-1-first", second: "gen-1-second", journal: "absent" })
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

    // Neither half of generation 2 survives.
    expect(await published(root)).toEqual({ first: "gen-1-first", second: "gen-1-second" })
  }, 60_000)

  test("an unsettled generation is converged by the next build before it stages anything", async () => {
    const root = await packageRoot()
    await replaceGeneratedArtifactsAfterSuccessfulBuild({
      packageRoot: root,
      stagingRelative: ".staging",
      artifacts,
      build: (staging) => build(staging, "gen-1-first", "gen-1-second"),
    })

    // The exact durable state a death mid-publication leaves: one target
    // already overwritten, the backups still holding the previous generation,
    // and an open occurrence naming what existed.
    const backupRoot = path.join(root, ".staging-backup")
    await mkdir(backupRoot, { recursive: true })
    await writeFile(path.join(backupRoot, "first.txt"), "gen-1-first")
    await writeFile(path.join(backupRoot, "second.txt"), "gen-1-second")
    await writeFile(path.join(root, "first.txt"), "gen-2-first-partial")
    const journal = path.join(root, ".generation-journal", "sdk-generation", "abandoned-generation")
    await mkdir(journal, { recursive: true })
    await writeFile(
      path.join(journal, "intent.json"),
      JSON.stringify({
        schemaVersion: 1,
        occurrenceID: "abandoned-generation",
        kind: "sdk-generation",
        subject: `sdk-generation:${root}`,
        payload: { packageRoot: root, existingTargets: ["first.txt", "second.txt"] },
        timeCreated: Date.now(),
      }),
    )

    await replaceGeneratedArtifactsAfterSuccessfulBuild({
      packageRoot: root,
      stagingRelative: ".staging",
      artifacts,
      build: (staging) => build(staging, "gen-3-first", "gen-3-second"),
    })

    // The abandoned generation was rolled back to generation 1 first, then
    // generation 3 published whole over it.
    expect(await published(root)).toEqual({ first: "gen-3-first", second: "gen-3-second" })
  }, 60_000)
})
