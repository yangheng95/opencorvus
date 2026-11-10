import { batch } from "solid-js"
import { appStore, setAppStore, setConfigSnapshot, type ConfigLoadIssue, type ProviderLoadIssue } from "../store/app"
import { settingsStore } from "../store/settings"
import { boardStore } from "../store/board"
import { ApiError, apiJsonWithTimeout, captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import { activeProjectDirectory } from "./project-directory"

export const CONFIG_INFO_LOAD_TIMEOUT_MILLISECONDS = 20_000
let configInfoLoadSequence = 0
let providerInfoLoadSequence = 0

export interface DirectoryOwnedLoadOptions {
  authority?: ApiAuthority
  directory?: string
  isCurrentDirectory?: (directory: string) => boolean
}

export interface LoadConfigInfoOptions extends DirectoryOwnedLoadOptions {
  onAcceptedConfig?: (config: Record<string, unknown>) => void
}

function directoryOwnedPath(path: string, options: DirectoryOwnedLoadOptions): string {
  const directory = String(options.directory || "").trim()
  if (!directory) return path
  const query = new URLSearchParams({ directory })
  return `${path}?${query.toString()}`
}

function ownsDirectoryLoad(options: DirectoryOwnedLoadOptions): boolean {
  if (options.authority && !isApiAuthorityCurrent(options.authority)) return false
  const directory = String(options.directory || "").trim()
  return (
    activeProjectDirectory().trim() === directory &&
    (!options.isCurrentDirectory || options.isCurrentDirectory(directory))
  )
}

function captureDirectoryLoad(options: DirectoryOwnedLoadOptions): DirectoryOwnedLoadOptions & { authority: ApiAuthority; directory: string } {
  const selectionEpoch = boardStore.selectEpoch
  const directoryEpoch = settingsStore.directoryEpoch
  const directory = (options.directory ?? activeProjectDirectory()).trim()
  return {
    ...options,
    directory,
    authority: options.authority ?? captureApiAuthority(),
    isCurrentDirectory: (candidate) =>
      boardStore.selectEpoch === selectionEpoch && settingsStore.directoryEpoch === directoryEpoch &&
      candidate === directory && (!options.isCurrentDirectory || options.isCurrentDirectory(candidate)),
  }
}

function providerInfoRequests(timeoutMilliseconds: number, options: DirectoryOwnedLoadOptions = {}) {
  return [
    apiJsonWithTimeout(directoryOwnedPath("provider", options), timeoutMilliseconds, { authority: options.authority }),
    apiJsonWithTimeout(directoryOwnedPath("provider/auth", options), timeoutMilliseconds, { authority: options.authority }),
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

function configLoadIssue(resource: ConfigLoadIssue["resource"], cause: unknown): ConfigLoadIssue {
  return { resource, message: providerLoadErrorMessage(cause), cause }
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

export async function loadConfigInfo(
  timeoutMilliseconds = CONFIG_INFO_LOAD_TIMEOUT_MILLISECONDS,
  options: LoadConfigInfoOptions = {},
): Promise<ConfigLoadIssue[]> {
  const scope = captureDirectoryLoad(options)
  assertApiAuthorityCurrent(scope.authority)
  const loadSequence = ++configInfoLoadSequence
  const configPath = scope.directory ? directoryOwnedPath("config", scope) : "global/config"
  const owns = () => loadSequence === configInfoLoadSequence && ownsDirectoryLoad(scope)

  async function read<T>(
    resource: ConfigLoadIssue["resource"],
    path: string,
    validate: (path: string, value: unknown) => T,
  ): Promise<{ value: T; issue?: never } | { value?: never; issue: ConfigLoadIssue }> {
    try {
      const value = await apiJsonWithTimeout(path, timeoutMilliseconds, { authority: scope.authority })
      return { value: validate(path, value) }
    } catch (error) {
      return { issue: configLoadIssue(resource, error) }
    }
  }

  // A slow catalog cannot delay the accepted configuration (or republish it
  // after a later write). Only the caller's aggregate receipt waits for both.
  const configRead = read("config", configPath, requireObjectResponse).then((result) => {
    if (owns()) {
      batch(() => {
        if (result.value) setConfigSnapshot(result.value)
        setAppStore("configLoadIssues", result.issue ? [result.issue] : [])
        if (!scope.directory) setAppStore("channelCatalog", null)
      })
    }
    return result
  })
  const channelRead = scope.directory
    ? read("channel", directoryOwnedPath("channel", scope), (_path, value) => requireArrayResponse("channel", value)).then((result) => {
        if (owns()) {
          const previous = appStore.channelCatalog
          const previousEntries = previous?.directory === scope.directory && previous.authorityRevision === scope.authority.revision
            ? previous.entries
            : null
          setAppStore("channelCatalog", {
            directory: scope.directory,
            authorityRevision: scope.authority.revision,
            entries: result.value ?? previousEntries,
            failure: result.issue,
          })
        }
        return result
      })
    : undefined

  const [config, channel] = await Promise.all([configRead, channelRead])
  if (!owns()) return []
  if (config.value) options.onAcceptedConfig?.(config.value)
  const issues: ConfigLoadIssue[] = []
  if (config.issue) issues.push(config.issue)
  if (channel?.issue) issues.push(channel.issue)
  return issues
}

export async function loadProviderInfo(
  timeoutMilliseconds = CONFIG_INFO_LOAD_TIMEOUT_MILLISECONDS,
  options: DirectoryOwnedLoadOptions = {},
): Promise<ProviderLoadIssue[]> {
  options = captureDirectoryLoad(options)
  assertApiAuthorityCurrent(options.authority)
  const loadSequence = ++providerInfoLoadSequence
  const directory = String(options.directory || "").trim()
  if (!directory) {
    const [providerResult, authResult, configResult] = await Promise.allSettled([
      apiJsonWithTimeout("global/providers", timeoutMilliseconds, { authority: options.authority }),
      apiJsonWithTimeout("global/providers/auth", timeoutMilliseconds, { authority: options.authority }),
      apiJsonWithTimeout("global/config", timeoutMilliseconds, { authority: options.authority }),
    ])
    if (
      !isApiAuthorityCurrent(options.authority) ||
      loadSequence !== providerInfoLoadSequence ||
      !ownsDirectoryLoad(options)
    )
      return []
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
    batch(() => {
      if (config) setConfigSnapshot(config)
      setAppStore({
        ...(providerCatalog ? { providerCatalog } : {}),
        ...(providerAuth ? { providerAuth } : {}),
        providerLoadIssues: settledIssues,
        ...((providerCatalog || providerAuth) && {
          providerAuthRefreshRevision: appStore.providerAuthRefreshRevision + 1,
        }),
      })
    })
    return settledIssues
  }
  const [catalogResult, authResult] = await Promise.allSettled(providerInfoRequests(timeoutMilliseconds, options))
  if (!isApiAuthorityCurrent(options.authority) || loadSequence !== providerInfoLoadSequence || !ownsDirectoryLoad(options))
    return []
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
