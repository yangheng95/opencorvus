import z from "zod"
import { NativeAgentRegistryLifecycle } from "@/agent/native-agent-registry-lifecycle"
import { GlobalBus } from "@/bus/global"
import { ChannelSupervisor } from "@/channel/supervisor"
import { Provider } from "@/provider/provider"
import { Instance } from "@/project/instance"
import { Event } from "@/server/event"
import { Config } from "./config"

export async function updateGlobalConfig(config: z.infer<typeof Config.Info>) {
  return commitGlobalConfigMutation(() => Config.writeGlobal(config))
}

async function refreshGlobalConfigRuntime() {
  await Promise.all([Provider.resetAll(), NativeAgentRegistryLifecycle.resetAll()])
  await Instance.forEachActive({
    async fn() {
      await ChannelSupervisor.sync(await Config.get())
    },
  })
  GlobalBus.emit("event", {
    directory: "global",
    payload: {
      type: Event.Disposed.type,
      properties: {},
    },
  })
}

export async function updateGlobalConfigPatch(patch: Config.ProjectMergePatch) {
  return commitGlobalConfigMutation(() => Config.updateGlobalPatch(patch))
}

export async function updateGlobalConfigPatchAtomic(
  resolve: (
    currentGlobal: Config.Info,
    currentWritable: Config.Info,
  ) => Config.ProjectMergePatch | Promise<Config.ProjectMergePatch>,
) {
  return commitGlobalConfigMutation(() => Config.updateGlobalPatchAtomic(resolve))
}

async function commitGlobalConfigMutation(mutate: () => Promise<Config.Info>): Promise<Config.Info> {
  let next: Config.Info
  try {
    next = await mutate()
  } catch (error) {
    if (!(error instanceof Config.GlobalConfigCommittedReconcileError)) throw error
    try {
      await refreshGlobalConfigRuntime()
    } catch (refreshError) {
      throw new Config.GlobalConfigCommittedReconcileError([...error.errors, refreshError], error.config)
    }
    throw error
  }

  try {
    await refreshGlobalConfigRuntime()
  } catch (error) {
    throw new Config.GlobalConfigCommittedReconcileError([error], next)
  }
  return next
}
