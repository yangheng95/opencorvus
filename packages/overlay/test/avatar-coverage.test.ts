import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const MESSAGE_TS = readFileSync(join(import.meta.dir, "..", "src", "utils", "message.ts"), "utf8")
const AVATAR_TSX = readFileSync(join(import.meta.dir, "..", "src", "components", "Avatar.tsx"), "utf8")

function agentRolesFromSource(): string[] {
  const match = MESSAGE_TS.match(/export type AgentRole\s*=\s*([\s\S]*?)\n\n\/\*\* Stages/)
  if (!match) throw new Error("AgentRole union not found in message.ts")
  return [...match[1]!.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]!)
}

function avatarMappingsFromSource(): Record<string, string> {
  const match = AVATAR_TSX.match(/AVATAR_ICON_BY_ROLE:\s*Record<AgentRole,\s*IconName>\s*=\s*\{([\s\S]*?)\n\}/)
  if (!match) throw new Error("AVATAR_ICON_BY_ROLE object not found in Avatar.tsx")
  const mappings: Record<string, string> = {}
  for (const entry of match[1]!.matchAll(/^\s*(?:"([^"]+)"|([a-z-]+)):\s*"([^"]+)",?$/gm)) {
    const role = entry[1] ?? entry[2]
    const icon = entry[3]
    if (role && icon) mappings[role] = icon
  }
  return mappings
}

test("Avatar covers every AgentRole with one canonical semantic icon mapping", () => {
  const roles = agentRolesFromSource()
  const mappings = avatarMappingsFromSource()
  expect(Object.keys(mappings).sort()).toEqual([...roles].sort())
  expect(mappings.mission).toBe("mission")
  expect(mappings.goal).toBe("goals")
  expect(mappings.executor).toBe("executor")
  for (const role of roles.filter((item) => !["mission", "goal", "executor"].includes(item))) {
    expect(mappings[role]).toBe(`avatar-${role}`)
  }
  expect(AVATAR_TSX).toContain("normalizeAgentRole")
  expect(AVATAR_TSX).toContain("class={classes()}")
  expect(AVATAR_TSX).toContain("data-status={props.status || undefined}")
  expect(AVATAR_TSX).toContain('size="large"')
})
