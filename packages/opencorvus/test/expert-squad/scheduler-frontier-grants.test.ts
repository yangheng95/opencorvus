import { expect, test } from "bun:test"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { schedulerCapabilityGrants } from "./capability-grant-fixture"

test("every shipped scheduler resolves the complete-frontier dispatch capability", async () => {
  const roots = [
    path.resolve(import.meta.dir, "../../src/expert-squad/builtin"),
    path.resolve(import.meta.dir, "../../../../expert-squads/builtin"),
  ]
  for (const root of roots) {
    const directories = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name))
      .sort()
    for (const directory of directories) {
      const source = await ExpertSquadRegistry.loadSourcePackage(directory)
      const scheduler = schedulerCapabilityGrants(source.manifest)
      expect({
        package: source.manifest.id,
        dispatch: scheduler.builtInToolIDs.filter((id) => id.startsWith("dispatch_")),
      }).toEqual({ package: source.manifest.id, dispatch: ["dispatch_agents"] })
    }
  }
}, 180_000)
