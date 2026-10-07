import { expect, test } from "bun:test"
import {
  parseSquadInstallationKey,
  squadInstallationKey,
  squadSelectionKey,
} from "../src/services/expert-squad-selection"
test("physical keys retain exact installed namespace across scopes and receipt/config inputs", () => {
  const identities = [
    { installationScope: "built_in", id: "base" },
    { installationScope: "project", namespace: "author-a", id: "same-squad" },
    { installationScope: "global", namespace: "author-b", id: "same-squad" },
  ] as const
  const keys = identities.map(squadInstallationKey)
  expect(keys).toEqual(["built_in:base", "project:author-a:same-squad", "global:author-b:same-squad"])
  expect(keys.map(parseSquadInstallationKey)).toEqual([...identities])
  expect(new Set(keys).size).toBe(3)
  const receipt = {
    installationScope: "project" as const,
    namespace: "author-a",
    id: "same-squad",
    version: "2026.10.07.1",
  }
  const configuration = { installationScope: "project" as const, namespace: "author-a", id: "same-squad", fields: [] }
  expect([squadInstallationKey(receipt), squadInstallationKey(configuration)]).toEqual([keys[1]!, keys[1]!])
})
test("abbreviated or malformed physical keys map to explicit errors", () => {
  for (const key of ["same-squad", "project:same-squad", "project:a:same-squad:extra"]) {
    const result = (() => {
      try {
        return parseSquadInstallationKey(key)
      } catch (error) {
        return { name: (error as Error).name, message: (error as Error).message }
      }
    })()
    expect(result).toEqual({ name: "Error", message: "Invalid expert squad physical selection key" })
  }
})

test("actual declaration source projects the one exact physical inspection input", () => {
  const selected = {
    id: "selection-squad-021",
    source: {
      kind: "installed_package" as const,
      installation_scope: "project" as const,
      namespace: "selection-check",
    },
  }
  const key = squadSelectionKey(selected)
  expect(key).toBe("project:selection-check:selection-squad-021")
  expect(parseSquadInstallationKey(key)).toEqual({
    installationScope: "project",
    namespace: "selection-check",
    id: "selection-squad-021",
  })
  expect(squadSelectionKey({ id: "base", source: { kind: "built_in" } })).toBe("built_in:base")
})

import { configure } from "../src/services/api"
import { inspectExpertSquad, type ExpertSquadInspection } from "../src/services/expert-squad"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { HOST_CAPABILITIES, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
test("retained physical key dispatches actual inspection with exact namespace", async () => {
  configure({ serverUrl: "http://owned.invalid", directory: "D:/owned/selection87", password: "" })
  const records: TransportRequest[] = []
  const body: ExpertSquadInspection = {
    name: "Selection Squad 021",
    display_label: "selection-check/Selection Squad 021",
    label: "Selection Squad 021",
    built_in: false,
    product_pillars: ["code"],
    version: "2026.10.07.1",
    selector: { summary: "Selection observation", selection_guidance: "Owned selection contract" },
    workflow_count: 0,
    workflows: [],
    next_workflow_cursor: null,
    id: "selection-squad-021",
    source: { kind: "installed_package", installation_scope: "project", namespace: "selection-check" },
  }
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest) {
      records.push(request)
      return { ok: true, status: 200, headers: {}, body } as unknown as TransportResponse<T>
    },
    openStream() {
      throw new Error("local request only")
    },
    async native() {
      throw new Error("local request only")
    },
  })
  try {
    const result = await inspectExpertSquad({
      directory: "D:/owned/selection87",
      ...parseSquadInstallationKey("project:selection-check:selection-squad-021"),
    })
    expect(result).toEqual(body)
    expect(records.map((request) => ({ method: request.method, path: request.path, query: request.query }))).toEqual([
      {
        method: "GET",
        path: "expert-squad/inspect",
        query: {
          directory: "D:/owned/selection87",
          id: "selection-squad-021",
          installationScope: "project",
          namespace: "selection-check",
        },
      },
    ])
  } finally {
    __setHostTransportForTest(null)
  }
})
