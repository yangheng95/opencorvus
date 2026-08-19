/**
 * `generated/expert-squad-payload.ts` carries the bytes of every built-in
 * Expert Squad package. It is derived from `expert-squads/builtin/**`, and
 * nothing local noticed when the two drifted: `bun run test` and
 * `bun run typecheck` never compare them, and the eleven tests that consume
 * `payloadPackageSources` assert other things about it. The only check was
 * `--check-clean-worktree` in CI, so a stale payload survived until push —
 * and a stale payload is what the market install and update paths hand the
 * user, not the source sitting in the repo.
 */
import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import {
  discoverExpertSquadPayloadPackages,
  renderExpertSquadPayloadModule,
  resolveExpertSquadPayloadModulePath,
} from "../script/generate-expert-squad-payload"

const repoRoot = path.resolve(import.meta.dir, "../../..")

describe("generated Expert Squad payload", () => {
  test("matches a fresh render of the built-in packages", async () => {
    const modulePath = resolveExpertSquadPayloadModulePath(repoRoot)
    const [rendered, current] = await Promise.all([
      renderExpertSquadPayloadModule(repoRoot),
      fs.readFile(modulePath, "utf8"),
    ])

    if (rendered !== current) {
      throw new Error(
        `${path.relative(repoRoot, modulePath)} is stale. ` +
          `received: ${current.length} bytes on disk, expected: ${rendered.length} bytes rendered from ` +
          `expert-squads/builtin. Re-run \`bun ./packages/opencorvus/script/generate-expert-squad-payload.ts\` ` +
          `after changing any built-in Expert Squad package.`,
      )
    }
    expect(rendered).toBe(current)
  }, 120_000)

  /**
   * The authoring root holds repository tooling beside the packages —
   * `expert-squads/tsconfig.json`, so the behavior tests can name what they
   * import. Discovery required every tracked path to be
   * `<namespace>/<id>/<file>`, so the moment that file was tracked, generation
   * threw and both the typecheck and build-critical jobs went red on a release
   * tag. A short path at the root is tooling; a short path deeper is a mistake.
   */
  test("passes over repository tooling at the authoring root", async () => {
    const packages = await discoverExpertSquadPayloadPackages(repoRoot)
    expect(packages.length).toBeGreaterThan(0)
    expect(packages.every((entry) => entry.namespace && entry.id)).toBe(true)
  }, 120_000)
})
