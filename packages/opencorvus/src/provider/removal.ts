import path from "path"
import { acquireProcessLock } from "@/util/process-lock"
import fs from "fs/promises"
import z from "zod"
import { NativeAgentRegistryLifecycle } from "@/agent/native-agent-registry-lifecycle"
import { Auth } from "@/auth"
import { ChannelSupervisor } from "@/channel/supervisor"
import { Config } from "@/config/config"
import { updateGlobalConfigPatchAtomic } from "@/config/update-global"
import { Global } from "@/global"
import { Provider } from "@/provider/provider"
import { Filesystem } from "@/util/filesystem"
import { withKeyedLock } from "@/util/lock"

const removalLocks = new Map<string, Promise<unknown>>()
const ownerPath = path.join(Global.Path.data, "provider-removal-owner")

export const ProviderRemovalReceipt = z
  .object({
    providerID: z.string(),
    scope: z.enum(["project", "global"]),
    status: z.enum(["committed", "committed_with_residue"]),
    config: z.literal("committed"),
    credential: z.enum(["removed", "absent", "residue"]),
    residue: z
      .array(
        z.object({
          owner: z.literal("credential"),
          message: z.string(),
        }),
      )
      .default([]),
  })
  .meta({ ref: "ProviderRemovalReceipt" })

export type ProviderRemovalReceipt = z.infer<typeof ProviderRemovalReceipt>

function modelBelongsToProvider(value: unknown, providerID: string): boolean {
  return typeof value === "string" && value.startsWith(`${providerID}/`)
}

function removalPatch(current: Config.Info, providerID: string): Config.ProjectMergePatch {
  const patch: Config.ProjectMergePatch = {
    provider: { [providerID]: null },
  }
  const disabled = (current.disabled_providers ?? []).filter((id) => id !== providerID)
  patch.disabled_providers = disabled.length > 0 ? disabled : null
  const enabled = current.enabled_providers?.filter((id) => id !== providerID)
  if (current.enabled_providers) patch.enabled_providers = enabled && enabled.length > 0 ? enabled : null
  if (modelBelongsToProvider(current.model, providerID)) patch.model = null
  if (modelBelongsToProvider(current.small_model, providerID)) patch.small_model = null

  const agentPatch: Record<string, unknown> = {}
  for (const [agentID, agent] of Object.entries(current.agent ?? {})) {
    if (!("model" in agent) || !modelBelongsToProvider(agent.model, providerID)) continue
    agentPatch[agentID] = Object.keys(agent).length === 1 ? null : { model: null }
  }
  if (Object.keys(agentPatch).length > 0) patch.agent = agentPatch
  return patch
}

async function commitProjectConfig(providerID: string): Promise<void> {
  await Config.updateProjectPatchAtomic((current) => removalPatch(current, providerID))
  const updated = await Config.get()
  await Promise.all([Provider.reset(), NativeAgentRegistryLifecycle.reset(), ChannelSupervisor.sync(updated)])
}

async function commitGlobalConfig(providerID: string): Promise<void> {
  await updateGlobalConfigPatchAtomic((current) => removalPatch(current, providerID))
}

export async function removeProvider(input: {
  providerID: string
  scope: "project" | "global"
}): Promise<ProviderRemovalReceipt> {
  await fs.mkdir(path.dirname(ownerPath), { recursive: true })
  await Filesystem.writeAtomicIfAbsent(ownerPath, "provider removal owner\n", 0o600)
  return withKeyedLock(removalLocks, ownerPath, async () => {
    const release = await acquireProcessLock(ownerPath, { realpath: false })
    try {
      if (input.scope === "global") await commitGlobalConfig(input.providerID)
      else await commitProjectConfig(input.providerID)

      try {
        const credential = await Auth.get(input.providerID)
        await Auth.remove(input.providerID)
        return ProviderRemovalReceipt.parse({
          providerID: input.providerID,
          scope: input.scope,
          status: "committed",
          config: "committed",
          credential: credential ? "removed" : "absent",
          residue: [],
        })
      } catch (error) {
        return ProviderRemovalReceipt.parse({
          providerID: input.providerID,
          scope: input.scope,
          status: "committed_with_residue",
          config: "committed",
          credential: "residue",
          residue: [
            {
              owner: "credential",
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        })
      }
    } finally {
      await release()
    }
  })
}
