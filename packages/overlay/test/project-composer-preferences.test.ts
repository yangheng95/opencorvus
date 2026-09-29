import { afterEach, beforeEach, expect, test } from "bun:test"
import { isNativeCommand, isOverlayPersistedSettings } from "@opencorvus-ai/transport-protocol"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport } from "../src/services/host-transport"
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
        persisted = JSON.parse(JSON.stringify(command.payload))
        return true
      }
      throw new Error(`Unexpected native command ${command.kind}`)
    },
  } as HostTransport)
  await loadSettings()
})
afterEach(() => __setHostTransportForTest(undefined))

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
