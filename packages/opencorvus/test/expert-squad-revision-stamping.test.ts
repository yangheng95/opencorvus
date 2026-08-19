import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  nextVersionFor,
  packageContentDigest,
  planExpertSquadRevisions,
  readManifestVersion,
} from "../script/generate-expert-squad-revisions"

/**
 * A built-in package's version has to move whenever its bytes move, because the site registry keys
 * a revision on `(namespace, id, version)` and refuses a second `package_digest` under a version it
 * already holds. `squad-sdk` proved on 2026-08-19 that nothing enforced it: a refactor edited its
 * authoring Skill, the version stayed at `2026.08.13.1`, and the deploy failed at the registry
 * import with `Immutable revision conflict`.
 *
 * These cover the derivation rather than the file writing: given a baseline and a tree, which
 * packages need a new version and what it should be.
 */

const MANIFEST = "expert-squad.jsonc"

function repoWith(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opencorvus-revision-"))
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
  // The digest reads the git index, so the fixture needs to be a repository with the files tracked.
  for (const args of [["init", "-q"], ["add", "-A"], ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "fixture"]]) {
    const done = Bun.spawnSync({ cmd: ["git", ...args], cwd: root, stdout: "pipe", stderr: "pipe" })
    if (done.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${new TextDecoder().decode(done.stderr)}`)
  }
  return root
}

const manifest = (version: string) => `{\n  "id": "sample",\n  "version": "${version}",\n  "name": "Sample"\n}\n`

describe("expert squad content digest", () => {
  test("ignores the version field, so a stamp cannot chase its own tail", () => {
    const root = repoWith({ [`expert-squads/builtin/sample/${MANIFEST}`]: manifest("2026.08.13.1") })
    const packageRoot = path.join(root, "expert-squads", "builtin", "sample")
    const before = packageContentDigest(root, packageRoot)

    fs.writeFileSync(path.join(packageRoot, MANIFEST), manifest("2026.08.19.4"))
    expect(readManifestVersion(packageRoot)).toBe("2026.08.19.4")
    // Same content, different version: the digest that decides whether to stamp must not move, or
    // stamping would itself look like a content change on the next run and never settle.
    expect(packageContentDigest(root, packageRoot)).toBe(before)
  })

  test("moves when anything else in the package moves", () => {
    const root = repoWith({
      [`expert-squads/builtin/sample/${MANIFEST}`]: manifest("2026.08.13.1"),
      "expert-squads/builtin/sample/skills/authoring/SKILL.md": "original\n",
    })
    const packageRoot = path.join(root, "expert-squads", "builtin", "sample")
    const before = packageContentDigest(root, packageRoot)
    fs.writeFileSync(path.join(packageRoot, "skills", "authoring", "SKILL.md"), "edited\n")
    expect(packageContentDigest(root, packageRoot)).not.toBe(before)
  })
})

describe("next version", () => {
  test("is today's date, or the next revision of a version already stamped today", () => {
    const day = new Date(Date.UTC(2026, 7, 19))
    expect(nextVersionFor("2026.08.13.1", day)).toBe("2026.08.19.1")
    expect(nextVersionFor("2026.08.19.1", day)).toBe("2026.08.19.2")
    expect(nextVersionFor("2026.08.19.9", day)).toBe("2026.08.19.10")
  })
})

describe("revision plan", () => {
  const day = new Date(Date.UTC(2026, 7, 19))

  test("stamps a package whose content moved under a version the baseline already published", () => {
    const root = repoWith({
      [`expert-squads/builtin/sample/${MANIFEST}`]: manifest("2026.08.13.1"),
      "expert-squads/builtin/sample/README.md": "edited after publication\n",
    })
    const baseline = { sample: { version: "2026.08.13.1", contentDigest: "0".repeat(64) } }
    const plan = planExpertSquadRevisions({ repoRoot: root, baseline, now: day })
    expect(plan.stamped).toEqual([{ id: "sample", from: "2026.08.13.1", to: "2026.08.19.1" }])
    expect(plan.records.find((record) => record.id === "sample")?.version).toBe("2026.08.19.1")
  })

  test("leaves a package alone when its content is what the baseline recorded", () => {
    const root = repoWith({ [`expert-squads/builtin/sample/${MANIFEST}`]: manifest("2026.08.13.1") })
    const digest = packageContentDigest(root, path.join(root, "expert-squads", "builtin", "sample"))
    const plan = planExpertSquadRevisions({
      repoRoot: root,
      baseline: { sample: { version: "2026.08.13.1", contentDigest: digest } },
      now: day,
    })
    expect(plan.stamped).toEqual([])
  })

  test("leaves a package alone when the author already bumped it", () => {
    // The author moving the version is the same outcome by another route; stamping again would
    // discard their choice and publish a revision nobody asked for.
    const root = repoWith({
      [`expert-squads/builtin/sample/${MANIFEST}`]: manifest("2026.08.19.3"),
      "expert-squads/builtin/sample/README.md": "edited\n",
    })
    const plan = planExpertSquadRevisions({
      repoRoot: root,
      baseline: { sample: { version: "2026.08.13.1", contentDigest: "0".repeat(64) } },
      now: day,
    })
    expect(plan.stamped).toEqual([])
    expect(plan.records.find((record) => record.id === "sample")?.version).toBe("2026.08.19.3")
  })

  test("records a package the baseline has never seen without inventing a version for it", () => {
    const root = repoWith({ [`expert-squads/builtin/sample/${MANIFEST}`]: manifest("2026.08.13.1") })
    const plan = planExpertSquadRevisions({ repoRoot: root, baseline: {}, now: day })
    expect(plan.stamped).toEqual([])
    expect(plan.records.find((record) => record.id === "sample")?.version).toBe("2026.08.13.1")
  })
})
