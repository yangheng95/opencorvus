import z from "zod"
import { Config } from "./config"

export async function updateGlobalConfig(config: z.infer<typeof Config.Info>) {
  return commitGlobalConfigMutation(() => Config.writeGlobal(config))
}

async function publishGlobalConfigSettlement() {
  await Config.publishGlobalConfigSettlement()
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
  try {
    const next = await mutate()
    await publishGlobalConfigSettlement()
    return next
  } catch (error) {
    if (error instanceof Config.GlobalConfigCommittedReconcileError) await publishGlobalConfigSettlement()
    throw error
  }
}
