import z from "zod"
import { Config } from "@/config/config"
import { ChannelSupervisor } from "./supervisor"
import { ChannelCatalog, channelState } from "./catalog"

export namespace ChannelRegistry {
  export const Field = z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(["boolean", "text", "secret"]),
    placeholder: z.string().optional(),
  })

  export const Info = z.object({
    id: z.string(),
    name: z.string(),
    docs_url: z.string().url(),
    status: z.enum(["disabled", "configured", "partial", "missing"]),
    summary: z.string(),
    runtime_status: z.enum(["disabled", "unavailable", "starting", "running", "stopped", "error"]),
    runtime_detail: z.string(),
    fields: Field.array(),
  })

  export async function list() {
    const config = await Config.get()
    const supervisor = await ChannelSupervisor.status()
    return Info.array().parse(
      ChannelCatalog.map((item) => {
        const state = channelState(item.id, config.channel?.[item.id] as Record<string, unknown> | undefined, {})
        const runtime = channelRuntime(supervisor, item)
        return {
          id: item.id,
          name: item.name,
          docs_url: item.docsUrl,
          status: state.status,
          summary: item.implementation.kind === "planned" ? item.implementation.reason : state.summary,
          runtime_status: runtime.status,
          runtime_detail: runtime.detail,
          fields: item.fields.map((field) => ({
            key: field.key,
            label: field.label,
            type: field.type,
            ...(field.placeholder ? { placeholder: field.placeholder } : {}),
          })),
        }
      }),
    )
  }
}

function channelRuntime(
  supervisor: Awaited<ReturnType<typeof ChannelSupervisor.status>>,
  channel: (typeof ChannelCatalog)[number],
) {
  if (channel.implementation.kind === "planned") {
    return { status: "unavailable", detail: channel.implementation.reason } as const
  }
  if (supervisor.channels.includes(channel.id)) {
    return {
      status: supervisor.status,
      detail: supervisor.detail,
    } as const
  }
  return {
    status: supervisor.status === "unavailable" ? "unavailable" : "disabled",
    detail: supervisor.detail,
  } as const
}
