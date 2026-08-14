import fs from "node:fs/promises"

const phase = process.argv[2]
const projectDirectory = process.env.OPENCORVUS_STAGE_PROCESS_PROJECT
const stateFile = process.env.OPENCORVUS_STAGE_PROCESS_STATE
if (!phase || !projectDirectory || !stateFile) throw new Error("stage process worker requires phase/project/state")

const state = JSON.parse(await fs.readFile(stateFile, "utf8")) as { requestID: string }
if (phase === "approve") {
  const { Instance } = await import("../../src/project/instance")
  const { PermissionAuthority } = await import("../../src/permission/authority")
  const { Provider } = await import("../../src/provider/provider")
  const original = Provider.getModel
  Provider.getModel = (async () => {
    throw new Error("process B intentionally defers execution to process C")
  }) as typeof Provider.getModel
  let deferred = false
  await Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      try {
        await PermissionAuthority.reply({ requestID: state.requestID, decision: "allow_once", actorID: "process-b" })
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("process B intentionally defers")) throw error
        deferred = true
      }
    },
  })
  Provider.getModel = original
  if (!deferred) throw new Error("process B did not persist approval before its explicit recovery failure")
  await Instance.disposeAll()
} else if (phase === "recover") {
  const { installDefaultControlPlaneToolLoaders } = await import("../../src/tool/control-plane-tool-composition")
  installDefaultControlPlaneToolLoaders()
  const { SessionLoop } = await import("../../src/session/loop")
  const { Instance } = await import("../../src/project/instance")
  const { Provider } = await import("../../src/provider/provider")
  void SessionLoop
  const original = Provider.getModel
  Provider.getModel = (async () => ({
    id: "authority-integration-model",
    providerID: "authority-integration-provider",
    name: "Authority Integration Model",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: { toolcall: true, attachment: false, reasoning: false, temperature: true, input: { text: true, image: false, audio: false, video: false }, output: { text: true, image: false, audio: false, video: false } },
    api: { id: "authority-integration", npm: "@ai-sdk/anthropic" },
    options: {},
  })) as typeof Provider.getModel
  try {
    await Instance.provide({ directory: projectDirectory, init: async () => {}, fn: async () => {} })
  } finally {
    Provider.getModel = original
  }
  await Instance.disposeAll()
} else {
  throw new Error(`unknown stage process phase ${phase}`)
}
