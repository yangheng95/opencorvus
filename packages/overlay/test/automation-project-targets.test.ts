import { expect, test } from "bun:test"
import {
  applyVisibleAutomationProjectSelection,
  projectTargetKey,
  resolveAutomationProjectTargets,
  type AutomationProjectTarget,
} from "../src/services/automation-project-targets"

const project = (projectID: string): AutomationProjectTarget => ({ kind: "project", projectID })
const chosen = (...targets: AutomationProjectTarget[]) => new Set(targets.map(projectTargetKey))

test("appends a filtered addition after the existing visible and hidden targets", () => {
  const alpha = project("prj_alpha")
  const beta = project("prj_beta")
  const gamma = project("prj_gamma")
  expect(applyVisibleAutomationProjectSelection([alpha, beta], [alpha, gamma], chosen(alpha, gamma)))
    .toEqual([alpha, beta, gamma])
})

test("retains the order of remaining targets and appends a reselected target", () => {
  const alpha = project("prj_alpha")
  const beta = project("prj_beta")
  const gamma = project("prj_gamma")
  const visible = [gamma, beta, alpha]
  const remaining = applyVisibleAutomationProjectSelection([alpha, beta, gamma], visible, chosen(gamma, alpha))
  expect(remaining).toEqual([alpha, gamma])
  expect(applyVisibleAutomationProjectSelection(remaining, visible, chosen(gamma, beta, alpha)))
    .toEqual([alpha, gamma, beta])
})

test("keeps the originally selected directory identity across an equivalent Windows display path", () => {
  const pending: AutomationProjectTarget = { kind: "directory", directory: "C:\\Work\\Beta" }
  const displayed: AutomationProjectTarget = { kind: "directory", directory: "c:/work/beta" }
  const alpha = project("prj_alpha")
  const gamma = project("prj_gamma")
  expect(applyVisibleAutomationProjectSelection([alpha, pending], [displayed, gamma], chosen(displayed, gamma)))
    .toEqual([alpha, pending, gamma])
})

test("retains canonical project IDs in authored order", async () => {
  expect(await resolveAutomationProjectTargets([
    { kind: "project", projectID: "prj_b" },
    { kind: "project", projectID: "prj_a" },
  ])).toEqual(["prj_b", "prj_a"])
})

test("resolves selected new directories to registered project IDs", async () => {
  const projects: Record<string, string> = { "/new/alpha": "prj_alpha", "/new/beta": "prj_beta" }
  expect(await resolveAutomationProjectTargets([
    { kind: "directory", directory: "/new/alpha" },
    { kind: "directory", directory: "/new/beta" },
  ], async (directory) => projects[directory]!)).toEqual(["prj_alpha", "prj_beta"])
})

test("combines stored identities and newly registered directories in selection order", async () => {
  expect(await resolveAutomationProjectTargets([
    { kind: "project", projectID: "prj_original" },
    { kind: "directory", directory: "/new/project" },
    { kind: "project", projectID: "prj_last" },
  ], async () => "prj_new")).toEqual(["prj_original", "prj_new", "prj_last"])
})

test("produces the unique project ID payload required by the public writer", async () => {
  expect(await resolveAutomationProjectTargets([
    { kind: "project", projectID: "prj_a" },
    { kind: "directory", directory: "/alias/a" },
    { kind: "project", projectID: "prj_b" },
    { kind: "project", projectID: "prj_a" },
  ], async () => "prj_a")).toEqual(["prj_a", "prj_b"])
})

test("returns the directory resolver's explicit failure to the caller", async () => {
  const problem = new Error("Project directory admission rejected")
  await expect(resolveAutomationProjectTargets([
    { kind: "directory", directory: "/new/project" },
  ], async () => { throw problem })).rejects.toBe(problem)
})
