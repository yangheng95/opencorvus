import { ChannelCatalog, type ChannelName, channelRequiredFields, resolveChannel } from "@opencorvus-ai/channel-config"
import type { ChannelAdapter } from "./adapter"

type Env = Record<string, string | undefined>
type Values = Record<string, string | undefined>

export type AdapterFactory = Partial<Record<ChannelName, (options: any, id: ChannelName) => ChannelAdapter>>

const nativeOptions: Partial<Record<ChannelName, (values: Values) => unknown>> = {
  slack: (values) => ({
    token: values.botToken!,
    appToken: values.appToken!,
    signingSecret: values.signingSecret,
  }),
  telegram: (values) => ({ token: values.token! }),
  discord: (values) => ({ token: values.token! }),
  feishu: (values) => ({
    appId: values.appId!,
    appSecret: values.appSecret!,
    host: values.webhookHost,
    port: parsePort(values.webhookPort),
    path: values.webhookPath,
    verificationToken: values.verificationToken,
  }),
  whatsapp: (values) => ({
    token: values.token!,
    numberId: values.numberId!,
    appSecret: values.appSecret!,
    host: values.webhookHost,
    port: parsePort(values.webhookPort),
    path: values.webhookPath,
    verifyToken: values.verifyToken!,
  }),
  googlechat: (values) => ({
    serviceAccount: values.serviceAccount!,
    authAudience: values.authAudience!,
    host: values.webhookHost,
    port: parsePort(values.webhookPort),
    path: values.webhookPath,
  }),
  msteams: (values) => ({
    appId: values.appId!,
    appSecret: values.appSecret!,
    host: values.webhookHost,
    port: parsePort(values.webhookPort),
    path: values.webhookPath,
  }),
  line: (values) => ({
    token: values.token!,
    host: values.webhookHost,
    port: parsePort(values.webhookPort),
    path: values.webhookPath,
    secret: values.secret!,
  }),
  matrix: (values) => ({ homeserver: values.homeserver!, token: values.token!, since: values.since }),
  mattermost: (values) => ({
    url: values.url!,
    token: values.token!,
    webhookToken: values.webhookToken!,
    host: values.webhookHost,
    port: parsePort(values.webhookPort),
    path: values.webhookPath,
  }),
  signal: (values) => ({ service: values.service!, account: values.account! }),
  wecom: (values) => ({
    corpId: values.corpId!,
    secret: values.secret!,
    agentId: values.agentId!,
    token: values.token!,
    encodingAesKey: values.encodingAesKey!,
    host: values.webhookHost,
    port: parsePort(values.webhookPort),
    path: values.webhookPath,
  }),
  dingtalk: (values) => ({
    appKey: values.appKey!,
    appSecret: values.appSecret!,
    callbackToken: values.callbackToken!,
    encodingAesKey: values.encodingAesKey!,
    host: values.webhookHost,
    port: parsePort(values.webhookPort),
    path: values.webhookPath,
    defaultWebhook: values.defaultWebhook,
  }),
}

export const ADAPTER_HINT = `Set one chat channel token set: ${ChannelCatalog.flatMap((item) =>
  item.implementation.kind === "planned"
    ? []
    : [
        channelRequiredFields(item.id)
          .map((field) => field.env)
          .filter((field): field is string => Boolean(field))
          .join(" + "),
      ],
)
  .filter((item) => item.length > 0)
  .join(", ")}.`

export const READY_CHANNELS = ChannelCatalog.flatMap((item) =>
  item.implementation.kind === "planned" ? [] : [item.id],
)
export const PLANNED_CHANNELS = ChannelCatalog.flatMap((item) =>
  item.implementation.kind === "planned" ? [item.id] : [],
)

function parsePort(value?: string) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function have(values: Values) {
  return Object.values(values).some(Boolean)
}

function need(id: ChannelName) {
  return channelRequiredFields(id)
    .map((field) => field.env)
    .filter((field): field is string => Boolean(field))
    .join(", ")
}

function build(id: ChannelName, create: AdapterFactory, values: Values): ChannelAdapter {
  const info = ChannelCatalog.find((entry) => entry.id === id)
  if (!info) throw new Error(`Unknown channel adapter: ${id}`)

  const explicitFactory = create[id]
  if (explicitFactory) {
    const projector = nativeOptions[id]
    return explicitFactory(projector ? projector(values) : values, id)
  }
  if (info.implementation.kind === "planned") {
    throw new Error(`Channel ${id} is planned: ${info.implementation.reason}`)
  }
  throw new Error(`Native channel ${id} is missing its adapter factory.`)
}

export function registerAdapters(
  runtime: { register(adapter: ChannelAdapter): unknown },
  env: Env,
  create: AdapterFactory,
) {
  const names: string[] = []
  const warns: string[] = []

  for (const item of ChannelCatalog) {
    if (item.implementation.kind === "planned") continue
    const values = resolveChannel(item.id, undefined, env).values
    const missing = channelRequiredFields(item.id).filter((field) => !values[field.key])
    if (missing.length > 0) {
      if (have(values)) warns.push(`Skip ${item.id} channel: missing required env. Need: ${need(item.id)}.`)
      continue
    }
    runtime.register(build(item.id, create, values))
    names.push(item.id)
  }

  return { names, warns }
}
