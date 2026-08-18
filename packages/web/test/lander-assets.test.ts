import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

/**
 * Landing material inventory.
 *
 * Two failure modes, both of which already happened here:
 *
 *   Orphans. Retiring six public pages left eighteen images behind — twenty megabytes of
 *   screenshots of surfaces that no longer exist. Nothing referenced them and nothing complained.
 *
 *   Silent staleness. The gallery shipped a v0.0.42-beta window, with an empty Mission Board and a
 *   stray selection highlight, long after the app moved on. A screenshot never fails a build.
 *
 * So: every asset on disk must be referenced somewhere, and every asset must declare where it came
 * from in captured.json. Neither test can judge whether a screenshot looks current — that still
 * needs eyes — but both make the question visible instead of invisible.
 */

const landerDir = fileURLToPath(new URL("../src/assets/lander", import.meta.url))
const componentsDir = fileURLToPath(new URL("../src/components", import.meta.url))

function walk(dir: string, base = ""): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    const rel = base ? `${base}/${entry}` : entry
    return statSync(full).isDirectory() ? walk(full, rel) : [rel]
  })
}

const assets = walk(landerDir).filter((name) => /\.(png|gif|jpg|webp|svg)$/i.test(name))

function readRepoFile(relative: string): string {
  try {
    return readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), "utf8")
  } catch {
    return ""
  }
}

/**
 * Components plus the repository READMEs. The READMEs matter: after the landing page dropped its
 * screenshot gallery, the two surviving shots are embedded in README.md and nowhere else. A
 * components-only search would report them as dead and invite deleting the images off the front
 * page of the repository.
 */
const referencingSource = [
  ...readdirSync(componentsDir)
    .filter((name) => name.endsWith(".astro"))
    .map((name) => readFileSync(join(componentsDir, name), "utf8")),
  readRepoFile("README.md"),
  readRepoFile("README.zh-CN.md"),
].join("\n")

const manifest = JSON.parse(readFileSync(join(landerDir, "captured.json"), "utf8")) as {
  assets: { file: string; capturedAppVersion: string; capturedOn: string; knownIssues: string[] }[]
}

describe("landing material inventory", () => {
  test("every asset on disk is referenced by a component or a README", () => {
    const orphans = assets.filter((name) => !referencingSource.includes(name.split("/").pop()!))
    expect(orphans, "delete these or use them; they are dead weight in the repository").toEqual([])
  })

  test("every asset declares its provenance", () => {
    const declared = new Set(manifest.assets.map((entry) => entry.file))
    const undeclared = assets.filter((name) => !declared.has(name))
    expect(undeclared, "add these to captured.json with the app version they were captured from").toEqual([])
  })

  test("captured.json has no entries for assets that no longer exist", () => {
    const present = new Set(assets)
    const stale = manifest.assets.map((entry) => entry.file).filter((file) => !present.has(file))
    expect(stale).toEqual([])
  })

  test("each provenance entry is complete enough to act on", () => {
    for (const entry of manifest.assets) {
      expect(entry.capturedAppVersion, `${entry.file} has no captured version`).toMatch(/^\d+\.\d+\.\d+/)
      expect(entry.capturedOn, `${entry.file} has no capture date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Array.isArray(entry.knownIssues), `${entry.file} knownIssues must be a list`).toBe(true)
    }
  })
})
