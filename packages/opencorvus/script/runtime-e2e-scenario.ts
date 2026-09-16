import assert from "node:assert/strict"
import path from "node:path"
import { z } from "zod"
import type { DispatchSettlementPayload } from "../src/engine/dispatch-settlement"

export const RuntimeE2EScenarioSchema = z.object({
  caseID: z.string().min(1), title: z.string().min(1), request: z.string().min(1),
  promptProfile: z.string().min(1), requiredAdapters: z.array(z.string().min(1)).default([]),
  files: z.record(z.string(), z.string()).default({}),
}).strict()

export function runtimeDispatchSettlementFailures(rows: ReadonlyArray<{ id: string; payload: DispatchSettlementPayload }>) {
  return rows.flatMap(({ id, payload }) => payload.outcome.kind === "infrastructure_failure"
    ? [{ settlementID: id, dispatchID: payload.dispatch_id, ...payload.outcome }]
    : [])
}

/** Portable fixture names must retain the same file identity on Windows. */
export function scenarioFixturePath(project: string, relative: string): string {
  const segments = relative.replaceAll("\\", "/").split("/")
  assert(relative && !path.isAbsolute(relative) && !path.win32.isAbsolute(relative), "Scenario fixture requires a relative portable file path")
  for (const segment of segments) {
    assert(segment && ![".", ".."].includes(segment) && !/[. ]$/.test(segment) && !/[:<>"|?*\x00-\x1f]/.test(segment) &&
      !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment), "Scenario fixture requires a relative portable file path")
    assert(!["agents.md", ".git", ".opencorvus"].includes(segment.toLowerCase()), "Scenario fixture must preserve runtime and acceptance ownership")
  }
  const target = path.resolve(project, ...segments)
  const scoped = path.relative(project, target)
  assert(scoped && !scoped.startsWith("..") && !path.isAbsolute(scoped), "Scenario fixture must stay inside its isolated project")
  return target
}
