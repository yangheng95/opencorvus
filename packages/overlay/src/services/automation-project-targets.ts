import { resolveAutomationProjectID } from "./automations"

export type AutomationProjectTarget =
  | { kind: "project"; projectID: string }
  | { kind: "directory"; directory: string }

export async function resolveAutomationProjectTargets(
  targets: readonly AutomationProjectTarget[],
  resolveDirectory: (directory: string) => Promise<string> = resolveAutomationProjectID,
): Promise<string[]> {
  const ids = await Promise.all(targets.map((target) =>
    target.kind === "project" ? target.projectID : resolveDirectory(target.directory),
  ))
  return [...new Set(ids)]
}
