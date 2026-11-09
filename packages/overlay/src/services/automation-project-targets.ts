import { resolveAutomationProjectID } from "./automations"
import { projectDirectoryKey } from "../utils/project-directory"

export type AutomationProjectTarget =
  | { kind: "project"; projectID: string }
  | { kind: "directory"; directory: string }

export function projectTargetKey(target: AutomationProjectTarget): string {
  return target.kind === "project" ? `project:${target.projectID}` : `directory:${projectDirectoryKey(target.directory)}`
}

export function applyVisibleAutomationProjectSelection(
  current: readonly AutomationProjectTarget[],
  visible: readonly AutomationProjectTarget[],
  selectedKeys: ReadonlySet<string>,
): AutomationProjectTarget[] {
  const visibleByKey = new Map(visible.map((target) => [projectTargetKey(target), target]))
  const retained = current.filter((target) => {
    const key = projectTargetKey(target)
    return !visibleByKey.has(key) || selectedKeys.has(key)
  })
  const retainedKeys = new Set(retained.map(projectTargetKey))
  for (const key of selectedKeys) {
    const target = visibleByKey.get(key)
    if (target && !retainedKeys.has(key)) retained.push(target)
  }
  return retained
}

export async function resolveAutomationProjectTargets(
  targets: readonly AutomationProjectTarget[],
  resolveDirectory: (directory: string) => Promise<string> = resolveAutomationProjectID,
): Promise<string[]> {
  const ids = await Promise.all(targets.map((target) =>
    target.kind === "project" ? target.projectID : resolveDirectory(target.directory),
  ))
  return [...new Set(ids)]
}
