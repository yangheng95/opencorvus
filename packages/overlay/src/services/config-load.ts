import { appStore, setAppStore, type ConfigLoadIssue, type ProviderLoadIssue } from "../store/app"
import { DEFAULT_SETTINGS, settingsStore, setSettingsStore, type ToolPermissions } from "../store/settings"
import { ApiError, apiJsonWithTimeout } from "./api"

export const CONFIG_INFO_LOAD_TIMEOUT_MILLISECONDS = 20_000
let configInfoLoadSequence = 0
let providerInfoLoadSequence = 0

export interface DirectoryOwnedLoadOptions {
  directory?: string
  isCurrentDirectory?: (directory: string) => boolean
}

export type LoadConfigInfoOptions = DirectoryOwnedLoadOptions

function directoryOwnedPath(path: string, options: DirectoryOwnedLoadOptions): string {
  const directory = String(options.directory || "").trim()
  if (!directory) return path
  const query = new URLSearchParams({ directory })
  return `${path}?${query.toString()}`
}

function ownsDirectoryLoad(options: DirectoryOwnedLoadOptions): boolean {
  const directory = String(options.directory || "").trim()
  return !directory || !options.isCurrentDirectory || options.isCurrentDirectory(directory)
}

function providerInfoRequests(timeoutMilliseconds: number, options: DirectoryOwnedLoadOptions = {}) {
  return [
    apiJsonWithTimeout(directoryOwnedPath("provider", options), timeoutMilliseconds),
    apiJsonWithTimeout(directoryOwnedPath("provider/auth", options), timeoutMilliseconds),
  ] as const
}

function requireObjectResponse(path: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} returned an invalid object response`)
  }
  return value as Record<string, unknown>
}

function requireArrayResponse(path: string, value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} returned an invalid array response`)
  return value
}

function configuredComposerModel(config: Record<string, unknown>): string {
  const model = config.model
  return typeof model === "string" ? model.trim() : ""
}

function providerLoadIssue(
  resource: ProviderLoadIssue["resource"],
  error: unknown,
  detail: Partial<Pick<ProviderLoadIssue, "phase" | "providerID">> = {},
): ProviderLoadIssue {
  return {
    resource,
    ...detail,
    message: providerLoadErrorMessage(error),
  }
}

function providerLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.body && typeof error.body === "object" && !Array.isArray(error.body)) {
    const body = error.body as Record<string, unknown>
    for (const value of [body.message, body.error, body.detail]) {
      if (typeof value === "string" && value.trim()) return value.trim()
    }
    if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
      const message = (body.data as Record<string, unknown>).message
      if (typeof message === "string" && message.trim()) return message.trim()
    }
  }
  return error instanceof Error ? error.message : String(error)
}

function dedupeProviderLoadIssues(issues: ProviderLoadIssue[]): ProviderLoadIssue[] {
  return issues.filter(
    (issue, index) =>
      issues.findIndex(
        (candidate) =>
          candidate.resource === issue.resource &&
          candidate.phase === issue.phase &&
          candidate.providerID === issue.providerID &&
          candidate.message === issue.message,
      ) === index,
  )
}

function providerProjectionIssues(value: Record<string, unknown>): ProviderLoadIssue[] {
  const issues = value.issues
  if (!Array.isArray(issues)) return []
  return issues.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return []
    const issue = candidate as Record<string, unknown>
    if (typeof issue.phase !== "string" || typeof issue.message !== "string") return []
    return [
      {
        resource: "provider" as const,
        phase: issue.phase,
        ...(typeof issue.providerID === "string" ? { providerID: issue.providerID } : {}),
        message: issue.message,
      },
    ]
  })
}

function ownsConfigInfoLoad(
  loadSequence: number,
  directoryEpoch: number,
  directory: string,
  options: LoadConfigInfoOptions,
): boolean {
  if (loadSequence !== configInfoLoadSequence) return false
  if (String(options.directory || "").trim()) return ownsDirectoryLoad(options)
  return settingsStore.directoryEpoch === directoryEpoch && settingsStore.directory.trim() === directory
}

export async function loadConfigInfo(
  timeoutMilliseconds = CONFIG_INFO_LOAD_TIMEOUT_MILLISECONDS,
  options: LoadConfigInfoOptions = {},
): Promise<ConfigLoadIssue[]> {
  const loadSequence = ++configInfoLoadSequence
  const directoryEpoch = settingsStore.directoryEpoch
  const directory = String(options.directory || settingsStore.directory).trim()
  const [configResult, channelResult] = await Promise.allSettled([
    apiJsonWithTimeout(directoryOwnedPath("config", options), timeoutMilliseconds),
    apiJsonWithTimeout(directoryOwnedPath("channel", options), timeoutMilliseconds),
  ])

  if (!ownsConfigInfoLoad(loadSequence, directoryEpoch, directory, options)) return []

  const issues: ConfigLoadIssue[] = []
  let config: Record<string, unknown> | undefined
  let channels: unknown[] | undefined
  if (configResult.status === "fulfilled") {
    try {
      config = requireObjectResponse("config", configResult.value)
    } catch (error) {
      issues.push({ resource: "config", message: providerLoadErrorMessage(error) })
    }
  } else {
    issues.push({ resource: "config", message: providerLoadErrorMessage(configResult.reason) })
  }
  if (channelResult.status === "fulfilled") {
    try {
      channels = requireArrayResponse("channel", channelResult.value)
    } catch (error) {
      issues.push({ resource: "channel", message: providerLoadErrorMessage(error) })
    }
  } else {
    issues.push({ resource: "channel", message: providerLoadErrorMessage(channelResult.reason) })
  }

  setAppStore({
    ...(config ? { config, composerModel: configuredComposerModel(config) } : {}),
    ...(channels ? { channels } : {}),
    configLoadIssues: issues,
  })

  const remoteToolPermissions = (config as any)?.tool_permissions
  if (remoteToolPermissions && typeof remoteToolPermissions === "object") {
    const defaults = DEFAULT_SETTINGS.toolPermissions
    const merged: ToolPermissions = {
      websearch: remoteToolPermissions.websearch ?? defaults.websearch,
      webfetch: remoteToolPermissions.webfetch ?? defaults.webfetch,
      skill: remoteToolPermissions.skill ?? defaults.skill,
      external_directory: remoteToolPermissions.external_directory ?? defaults.external_directory,
      schedule: remoteToolPermissions.schedule ?? defaults.schedule,
    }
    setSettingsStore("toolPermissions", merged)
  }
  return issues
}

export async function loadProviderInfo(
  timeoutMilliseconds = CONFIG_INFO_LOAD_TIMEOUT_MILLISECONDS,
  options: DirectoryOwnedLoadOptions = {},
): Promise<ProviderLoadIssue[]> {
  const loadSequence = ++providerInfoLoadSequence
  const directory = String(options.directory || "").trim()
  if (!directory) {
    const [providerResult, authResult, configResult] = await Promise.allSettled([
      apiJsonWithTimeout("global/providers", timeoutMilliseconds),
      apiJsonWithTimeout("global/providers/auth", timeoutMilliseconds),
      apiJsonWithTimeout("global/config", timeoutMilliseconds),
    ])
    if (loadSequence !== providerInfoLoadSequence || !ownsDirectoryLoad(options)) return []
    const issues: ProviderLoadIssue[] = []
    let providerCatalog: Record<string, unknown> | undefined
    let providerAuth: Record<string, unknown> | undefined
    let config: Record<string, unknown> | undefined
    if (providerResult.status === "fulfilled") {
      try {
        const response = requireObjectResponse("global/providers", providerResult.value)
        providerCatalog = requireObjectResponse("global/providers.catalog", response.catalog)
        issues.push(...providerProjectionIssues(providerCatalog))
      } catch (error) {
        issues.push(providerLoadIssue("catalog", error))
      }
    } else {
      issues.push(providerLoadIssue("catalog", providerResult.reason))
    }
    if (authResult.status === "fulfilled") {
      try {
        providerAuth = requireObjectResponse("global/providers/auth", authResult.value)
      } catch (error) {
        issues.push(providerLoadIssue("auth", error))
      }
    } else {
      issues.push(providerLoadIssue("auth", authResult.reason))
    }
    if (configResult.status === "fulfilled") {
      try {
        config = requireObjectResponse("global/config", configResult.value)
      } catch (error) {
        issues.push(providerLoadIssue("config", error))
      }
    } else {
      issues.push(providerLoadIssue("config", configResult.reason))
    }
    const settledIssues = dedupeProviderLoadIssues(issues)
    setAppStore({
      ...(config ? { config } : {}),
      ...(providerCatalog ? { providerCatalog } : {}),
      ...(providerAuth ? { providerAuth } : {}),
      providerLoadIssues: settledIssues,
      ...((providerCatalog || providerAuth) && {
        providerAuthRefreshRevision: appStore.providerAuthRefreshRevision + 1,
      }),
    })
    return settledIssues
  }
  const [catalogResult, authResult] = await Promise.allSettled(providerInfoRequests(timeoutMilliseconds, options))
  if (loadSequence !== providerInfoLoadSequence || !ownsDirectoryLoad(options)) return []
  const issues: ProviderLoadIssue[] = []
  let providerCatalog: Record<string, unknown> | undefined
  let providerAuth: Record<string, unknown> | undefined
  if (catalogResult.status === "fulfilled") {
    try {
      providerCatalog = requireObjectResponse("provider", catalogResult.value)
      issues.push(...providerProjectionIssues(providerCatalog))
    } catch (error) {
      issues.push(providerLoadIssue("catalog", error))
    }
  } else {
    issues.push(providerLoadIssue("catalog", catalogResult.reason))
  }
  if (authResult.status === "fulfilled") {
    try {
      providerAuth = requireObjectResponse("provider/auth", authResult.value)
    } catch (error) {
      issues.push(providerLoadIssue("auth", error))
    }
  } else {
    issues.push(providerLoadIssue("auth", authResult.reason))
  }
  const settledIssues = dedupeProviderLoadIssues(issues)
  setAppStore({
    ...(providerCatalog ? { providerCatalog } : {}),
    ...(providerAuth ? { providerAuth } : {}),
    providerLoadIssues: settledIssues,
    ...((providerCatalog || providerAuth) && {
      providerAuthRefreshRevision: appStore.providerAuthRefreshRevision + 1,
    }),
  })
  return settledIssues
}
