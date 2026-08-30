// SDK means Software Development Kit; JSON means JavaScript Object Notation.

import { describe, expect, test } from "bun:test"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import {
  EXPERT_SQUAD_MANIFEST_PATH,
  validateExpertSquadPackageDefinition,
  type ExpertSquadManifestV2,
  type ExpertSquadPackageDefinition,
  type ExpertSquadPackageFile,
} from "../src/expert-squad-authoring"

const repositoryRoot = path.resolve(import.meta.dir, "../../../..")

/** Authoring root shipped as the generated payload; `<namespace>/<id>/...`. */
const AUTHORING_ROOT = "expert-squads"
/** Bundled runtime packages share the same manifest contract. */
const BUILTIN_ROOT = "packages/opencorvus/src/expert-squad/builtin"
/** Version means YYYY.MM.DD.N with a positive daily revision. */
const CANONICAL_VERSION = /^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/

/**
 * Every repository-authored package is discovered from the Git index, which is
 * the same authority the payload generator uses. A hand-maintained roster would
 * silently exempt a newly added Squad from this calibration and would go stale
 * on every legitimate version bump.
 */
function discoverRepositorySquadRoots(): string[] {
  const result = Bun.spawnSync({
    cmd: [
      "git",
      "ls-files",
      "--cached",
      "-z",
      "--",
      `${BUILTIN_ROOT}/*/${EXPERT_SQUAD_MANIFEST_PATH}`,
      `${AUTHORING_ROOT}/*/*/${EXPERT_SQUAD_MANIFEST_PATH}`,
    ],
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.exitCode !== 0) {
    throw new Error(
      `Repository Squad discovery could not read the Git index: ${new TextDecoder().decode(result.stderr)}`,
    )
  }
  const roots = new TextDecoder()
    .decode(result.stdout)
    .split("\0")
    .filter(Boolean)
    .map((entry) => path.posix.dirname(entry.replaceAll("\\", "/")))
  if (roots.length === 0) throw new Error("Repository Squad discovery found no authored expert squad packages")
  return [...new Set(roots)].sort()
}

function parseJsonc<T>(source: string): T {
  return JSON.parse(source.replace(/,(\s*[}\]])/g, "$1")) as T
}

async function readPackageFiles(root: string): Promise<Record<string, ExpertSquadPackageFile>> {
  const files: Record<string, ExpertSquadPackageFile> = {}
  const pending = [root]
  while (pending.length > 0) {
    const directory = pending.pop()!
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        pending.push(absolute)
        continue
      }
      if (!entry.isFile()) continue
      const relative = path.relative(root, absolute).split(path.sep).join("/")
      if (relative === EXPERT_SQUAD_MANIFEST_PATH) continue
      files[relative] = await readFile(absolute)
    }
  }
  return files
}

async function readPackage(relativeRoot: string): Promise<ExpertSquadPackageDefinition> {
  const root = path.join(repositoryRoot, ...relativeRoot.split("/"))
  const manifest = parseJsonc<ExpertSquadManifestV2>(
    await readFile(path.join(root, EXPERT_SQUAD_MANIFEST_PATH), "utf8"),
  )
  return {
    manifest,
    files: await readPackageFiles(root),
  }
}

describe("repository Expert Squad fact and Turn calibration", () => {
  test("SDK authoring documentation binds both transports to one canonical publisher", async () => {
    const source = await readFile(path.join(repositoryRoot, "packages/sdk/js/src/expert-squad-authoring.ts"), "utf8")
    expect(source).toContain("payload_json")
    expect(source).toContain("strict JSON text with unique object keys")
    expect(source).toContain("`resources` is required")
    expect(source).toContain("engineArtifacts.publish")
    expect(source).toContain("same canonical publisher")
  })

  for (const root of discoverRepositorySquadRoots()) {
    test(`${root} validates through the SDK and projects a complete package contract`, async () => {
      const definition = await readPackage(root)

      expect(validateExpertSquadPackageDefinition(definition)).toBe(definition)
      expect(definition.manifest.id).toBe(path.posix.basename(root))
      expect(definition.manifest.version).toMatch(CANONICAL_VERSION)
      expect(definition.manifest.description.length).toBeGreaterThan(20)
      expect(definition.files[definition.manifest.readme]).toBeDefined()
      expect(definition.files[definition.manifest.selector.instructions]).toBeDefined()
      expect(Object.keys(definition.manifest.capability_projection.agents).length).toBeGreaterThan(0)
    })
  }

  test("portable authoring source validates as a complete SDK package", async () => {
    const artifactRoot = path.join(repositoryRoot, "templates/portable-expert-squad-template")
    const definition = await readPackage("templates/portable-expert-squad-template/package")

    expect(validateExpertSquadPackageDefinition(definition)).toBe(definition)
    expect(definition.manifest.version).toBe("2026.08.21.3")
    const reconciliationPolicyTool = definition.files["tools/reconciliation-policy.ts"]
    if (reconciliationPolicyTool === undefined) throw new Error("portable reconciliation policy tool is missing")
    expect(
      typeof reconciliationPolicyTool === "string"
        ? reconciliationPolicyTool
        : new TextDecoder().decode(reconciliationPolicyTool),
    ).toContain("context.host.engineArtifacts.publish")
    expect(await readFile(path.join(artifactRoot, "authoring-skill/SKILL.md"), "utf8")).toContain(
      "validateExpertSquadPackageDefinition",
    )
    expect(
      await readFile(path.join(artifactRoot, "authoring-skill/references/authoring-quality-method.md"), "utf8"),
    ).toContain("Decide whether to create a Squad")
  })
})
