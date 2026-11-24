import { afterEach, beforeEach, expect, test } from "bun:test"
import { isNativeCommand, isOverlayPersistedSettings } from "@opencorvus-ai/transport-protocol"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport } from "../src/services/host-transport"
import { mergeBrowserOverlaySettings } from "../src/services/overlay-settings-storage"
import { projectComposerIntent, rememberProjectComposerIntent } from "../src/services/project-composer-preferences"
import {
  bootstrapOverlaySettings,
  DEFAULT_SETTINGS,
  loadSettings,
  settingsStore,
  setSettingsStore,
} from "../src/store/settings"

let persisted = bootstrapOverlaySettings(DEFAULT_SETTINGS)
let failNextSave = false

beforeEach(async () => {
  persisted = bootstrapOverlaySettings(DEFAULT_SETTINGS)
  failNextSave = false
  __setHostTransportForTest({
    kind: "browser",
    async native(command) {
      if (command.kind === "settings.load") return structuredClone(persisted)
      if (command.kind === "settings.save") {
        expect(isNativeCommand(command)).toBe(true)
        if (failNextSave) {
          failNextSave = false
          throw new Error("Settings storage unavailable")
        }
        const snapshot = structuredClone(command)
        persisted = mergeBrowserOverlaySettings(persisted, snapshot.payload, snapshot.fields, snapshot.projectComposerIntent)
        return structuredClone(persisted)
      }
      throw new Error(`Unexpected native command ${command.kind}`)
    },
  } as HostTransport)
  await loadSettings()
})
afterEach(() => __setHostTransportForTest(undefined))

test("a reactive settings snapshot is detached and can be stored as plain project data", () => {
  const entry = {
    serverUrl: settingsStore.serverUrl,
    directory: "C:/Projects/Alpha",
    productPillar: "code",
    conversationTarget: "chat",
  } as const
  setSettingsStore("projectComposerIntents", [{ ...entry }])
  const snapshot = bootstrapOverlaySettings(settingsStore)
  setSettingsStore("projectComposerIntents", 0, "conversationTarget", "mission")

  expect(structuredClone(snapshot).projectComposerIntents).toEqual([entry])
  expect(settingsStore.projectComposerIntents[0]?.conversationTarget).toBe("mission")
})

test("a project save preserves another tab's project setting and publishes both scopes", async () => {
  const serverUrl = settingsStore.serverUrl
  const remote = {
    serverUrl,
    directory: "C:/Projects/Alpha",
    productPillar: "code",
    conversationTarget: "chat",
  } as const
  const local = {
    serverUrl,
    directory: "C:/Projects/Beta",
    productPillar: "work",
    conversationTarget: "mission",
  } as const
  persisted = mergeBrowserOverlaySettings(
    persisted,
    { ...persisted, projectComposerIntents: [{ ...remote }] },
    ["projectComposerIntents"],
    remote,
  )

  await rememberProjectComposerIntent(local.directory, local)

  expect(persisted.projectComposerIntents).toEqual([remote, local])
  expect(projectComposerIntent(serverUrl, remote.directory)).toEqual({ productPillar: "code", conversationTarget: "chat" })
  await loadSettings()
  expect(projectComposerIntent(serverUrl, local.directory)).toEqual({ productPillar: "work", conversationTarget: "mission" })
})

test("round-trips each project's explicit intent through the shared persisted settings contract", async () => {
  await rememberProjectComposerIntent("C:\\Projects\\Alpha", { productPillar: "work", conversationTarget: "chat" })
  await rememberProjectComposerIntent("C:/Projects/Beta", { productPillar: "code", conversationTarget: "mission" })
  const firstServer = settingsStore.serverUrl
  setSettingsStore("serverUrl", "http://other-server:7878")
  await rememberProjectComposerIntent("C:/Projects/Alpha", { productPillar: "code", conversationTarget: "chat" })
  expect(isOverlayPersistedSettings(persisted)).toBe(true)
  setSettingsStore("projectComposerIntents", [])
  await loadSettings()
  expect(projectComposerIntent(firstServer + "/", "c:/projects/alpha/")).toEqual({
    productPillar: "work",
    conversationTarget: "chat",
  })
  expect(projectComposerIntent(firstServer, "C:/Projects/Beta")).toEqual({
    productPillar: "code",
    conversationTarget: "mission",
  })
  expect(projectComposerIntent("http://other-server:7878", "C:/Projects/Alpha")).toEqual({
    productPillar: "code",
    conversationTarget: "chat",
  })
  expect(persisted.projectComposerIntents).toHaveLength(3)
})

test("serializes rapid choices as one current preference per project", async () => {
  await Promise.all([
    rememberProjectComposerIntent("C:/Projects/Alpha", { productPillar: "work", conversationTarget: "chat" }),
    rememberProjectComposerIntent("C:/Projects/Beta", { productPillar: "work", conversationTarget: "mission" }),
    rememberProjectComposerIntent("c:/projects/alpha/", { productPillar: "code", conversationTarget: "mission" }),
  ])
  await loadSettings()
  expect(projectComposerIntent(settingsStore.serverUrl, "C:/Projects/Alpha")).toEqual({
    productPillar: "code",
    conversationTarget: "mission",
  })
  expect(projectComposerIntent(settingsStore.serverUrl, "C:/Projects/Beta")).toEqual({
    productPillar: "work",
    conversationTarget: "mission",
  })
  expect(persisted.projectComposerIntents).toHaveLength(2)
})

test("restores the confirmed project preference when persistence reports an error", async () => {
  await rememberProjectComposerIntent("C:/Projects/Alpha", { productPillar: "work", conversationTarget: "chat" })
  failNextSave = true
  await expect(
    rememberProjectComposerIntent("C:/Projects/Alpha", { productPillar: "code", conversationTarget: "mission" }),
  ).rejects.toThrow("Settings storage unavailable")
  expect(projectComposerIntent(settingsStore.serverUrl, "C:/Projects/Alpha")).toEqual({
    productPillar: "work",
    conversationTarget: "chat",
  })
})
