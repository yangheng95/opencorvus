import { afterEach, expect, test } from "bun:test"
import { appStore, setAppStore } from "../src/store/app"
import { boardStore, setBoardStore } from "../src/store/board"
import { settingsStore, setSettingsStore } from "../src/store/settings"
import { expertSquadCatalogPath, expertSquadCatalogRefreshToken, markExpertSquadCatalogStale } from "../src/services/expert-squad"
import { captureApiAuthority } from "../src/services/api"
import {
  composerReferenceCatalogRequestKey,
  composerReferenceCatalogScopeKey,
  expertSquadCatalogScope,
  expertSquadCatalogScopeIdentity,
  expertSquadCatalogRequestKeyForScope,
} from "../src/services/expert-squad-scope"

const original = {
  connected: appStore.connected,
  directory: settingsStore.directory,
  selectedSource: boardStore.selectedSource,
  board: boardStore.board,
  taskSwitching: boardStore.taskSwitching,
  tasks: boardStore.tasks,
}
afterEach(() => {
  setAppStore("connected", original.connected)
  setSettingsStore("directory", original.directory)
  setBoardStore({ selectedSource: original.selectedSource, board: original.board, taskSwitching: original.taskSwitching, tasks: original.tasks })
})

test("canonical selected Task association owns resolved scope and request identity while public query remains Session scoped", () => {
  setAppStore("connected", true)
  setBoardStore({
    selectedSource: { kind: "task", id: "tsk_scope_a", directory: "D:/owned/scope" },
    board: { task: { id: "tsk_scope_a", sessionID: "ses_scope", directory: "D:/owned/scope" } },
    taskSwitching: false,
    tasks: [],
  })
  const first = expertSquadCatalogScope()
  expect(first).toEqual({ kind: "session", sessionID: "ses_scope", directory: "D:/owned/scope", taskID: "tsk_scope_a" })
  if (first.kind !== "session") throw new Error("Expected actual Task root scope")
  expect(expertSquadCatalogScopeIdentity(first)).toBe("session:D:/owned/scope:ses_scope:task:tsk_scope_a")
  expect(expertSquadCatalogPath(first)).toBe("expert-squad/catalog?directory=D%3A%2Fowned%2Fscope&sessionID=ses_scope")
  const second = { ...first, taskID: "tsk_scope_b" }
  expect(expertSquadCatalogRequestKeyForScope(second)).toBe(
    expertSquadCatalogRequestKeyForScope(first).replace("task:tsk_scope_a", "task:tsk_scope_b"),
  )
  setBoardStore("taskSwitching", true)
  expect(expertSquadCatalogScope()).toEqual({ kind: "pending", taskID: "tsk_scope_a", directory: "D:/owned/scope" })
})

test("ordinary selected Session and Project retain their own canonical scope", () => {
  setAppStore("connected", true)
  setSettingsStore("directory", "D:/owned/project")
  setBoardStore({ selectedSource: { kind: "session", id: "ses_ordinary", directory: "D:/owned/session" }, board: null, tasks: [], taskSwitching: false })
  expect(expertSquadCatalogScope()).toEqual({ kind: "session", sessionID: "ses_ordinary", directory: "D:/owned/session" })
  expect(expertSquadCatalogScopeIdentity(expertSquadCatalogScope())).toBe("session:D:/owned/session:ses_ordinary")
  setBoardStore("selectedSource", null)
  expect(expertSquadCatalogScope()).toEqual({ kind: "project", directory: "D:/owned/project" })
  expect(expertSquadCatalogScopeIdentity(expertSquadCatalogScope())).toBe("project:D:/owned/project")
})

test("Composer refresh advances the request while the project and pillar own the interaction context", () => {
  setAppStore("connected", true)
  setSettingsStore("directory", "D:/owned/project")
  setBoardStore({ selectedSource: null, board: null, tasks: [], taskSwitching: false })
  const authority = captureApiAuthority()
  const workContext = `api:${authority.revision}:work:expert-squad:catalog:project:D:/owned/project`
  const refresh = expertSquadCatalogRefreshToken()
  expect(composerReferenceCatalogScopeKey("work")).toBe(workContext)
  expect(composerReferenceCatalogRequestKey("work")).toBe(`${workContext}:${refresh}`)

  markExpertSquadCatalogStale()
  expect(composerReferenceCatalogScopeKey("work")).toBe(workContext)
  expect(composerReferenceCatalogRequestKey("work")).toBe(`${workContext}:${refresh + 1}`)
  expect(composerReferenceCatalogScopeKey("code")).toBe(
    `api:${authority.revision}:code:expert-squad:catalog:project:D:/owned/project`,
  )

  setSettingsStore("directory", "D:/owned/next")
  const nextContext = `api:${authority.revision}:work:expert-squad:catalog:project:D:/owned/next`
  expect(composerReferenceCatalogScopeKey("work")).toBe(nextContext)
  expect(composerReferenceCatalogRequestKey("work")).toBe(`${nextContext}:${refresh + 1}`)
})
