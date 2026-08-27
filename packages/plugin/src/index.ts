import type {
  Event,
  Project,
  Model,
  Provider,
  VisibleMessage,
  Part,
  Auth,
  Config,
  ProcessFacade,
} from "@opencorvus-ai/sdk"
import type { Hono } from "hono"

export * from "./tool.js"

type OAuthCredential = Extract<Auth, { type: "oauth" }>
type ApiCredential = Extract<Auth, { type: "api" }>

export type PluginCredentials = {
  /**
   * Run a remote OAuth refresh through the engine-owned durable exchange
   * occurrence and credential commit. The closure must perform exactly one
   * token-endpoint exchange and return the resulting credential.
   */
  refresh(input: {
    providerID: string
    current: OAuthCredential
    exchange(): Promise<OAuthCredential>
  }): Promise<OAuthCredential>
  /** Update non-secret API credential metadata without exposing auth.set. */
  updateApiMetadata(input: {
    providerID: string
    current: ApiCredential
    metadata: Record<string, string>
  }): Promise<void>
}

/**
 * Read-only session facts needed by Provider request decorators. Plugins do
 * not receive the engine SDK client: that client also exposes credential and
 * other mutation routes that are outside a Provider plugin's authority.
 */
export type PluginSessions = {
  message(input: { sessionID: string; messageID: string }): Promise<{ parts: Part[] }>
  get(input: { sessionID: string }): Promise<{ parentID?: string }>
}

export type ProviderContext = {
  source: "env" | "config" | "custom" | "api"
  info: Provider
  options: Record<string, any>
}

type UserMessage = Extract<VisibleMessage, { role: "user" }>

export type PluginInput = {
  credentials: PluginCredentials
  sessions: PluginSessions
  project: Project
  directory: string
  worktree: string
  serverUrl: URL
  process: ProcessFacade
  resources: PluginResources
}

export type Plugin = (input: PluginInput) => Promise<Hooks>

export type PluginResourceOS = "win32" | "linux" | "darwin"

export type PluginResourceKind = "worker" | "asset" | "runtime"

export type PluginResourceManifestEntry = {
  id: string
  kind: PluginResourceKind
  path?: string
  paths?: Partial<Record<PluginResourceOS, string>>
}

export type PluginResource = {
  id: string
  kind: PluginResourceKind
  path: string
  absolutePath: string
}

export type PluginResources = {
  all(): PluginResource[]
  get(id: string): PluginResource
}

export type PluginServiceRegistration = {
  id: string
  app: Hono
}

export type OpenCorvusPluginManifest = {
  packageSpecifier: string
  // ID = identifier. The serviceID owns the dynamic /plugin/:id namespace.
  serviceID: string
  backendExport: string
  overlayExport: string
  resources: PluginResourceManifestEntry[]
}

export type AuthPromptRule = {
  key: string
  op: "eq" | "neq"
  value: string
}

export type AuthHook = {
  provider: string
  loader?: (auth: () => Promise<Auth>, provider: Provider) => Promise<Record<string, any>>
  methods: (
    | {
        type: "oauth"
        label: string
        preferred?: boolean
        /** Canonical credential key when it differs from auth.provider. */
        credentialProvider?: string
        prompts?: Array<
          | {
              type: "text"
              key: string
              message: string
              placeholder?: string
              validate?: (value: string) => string | undefined
              when?: AuthPromptRule
            }
          | {
              type: "select"
              key: string
              message: string
              selectValue: string
              options: Array<{
                label: string
                value: string
                hint?: string
              }>
              when?: AuthPromptRule
            }
        >
        authorize(inputs?: Record<string, string>): Promise<AuthOAuthResult>
      }
    | {
        type: "api"
        label: string
        preferred?: boolean
        prompts?: Array<
          | {
              type: "text"
              key: string
              message: string
              placeholder?: string
              validate?: (value: string) => string | undefined
              when?: AuthPromptRule
            }
          | {
              type: "select"
              key: string
              message: string
              selectValue: string
              options: Array<{
                label: string
                value: string
                hint?: string
              }>
              when?: AuthPromptRule
            }
        >
        authorize?(inputs?: Record<string, string>): Promise<
          | {
              type: "success"
              key: string
              provider?: string
              metadata?: Record<string, string>
            }
          | {
              type: "failed"
            }
        >
      }
  )[]
}

export type AuthOAuthResult = { url: string; instructions: string; dispose?: () => Promise<void> } & (
  | {
      method: "auto"
      callback(): Promise<
        | ({
            type: "success"
          } & (
            | {
                refresh: string
                access: string
                expires: number
                accountId?: string
                enterpriseUrl?: string
              }
            | { key: string; metadata?: Record<string, string> }
          ))
        | {
            type: "failed"
          }
      >
    }
  | {
      method: "code"
      callback(code: string): Promise<
        | ({
            type: "success"
          } & (
            | {
                refresh: string
                access: string
                expires: number
                accountId?: string
                enterpriseUrl?: string
              }
            | { key: string; metadata?: Record<string, string> }
          ))
        | {
            type: "failed"
          }
      >
    }
)

export type ProviderHookContext = {
  auth?: Auth
}

export type ProviderHook = {
  id: string
  models?: (provider: Provider, context: ProviderHookContext) => Promise<Record<string, Model>>
}

export interface Hooks {
  event?: (input: { event: Event }) => Promise<void>
  service?: () => Promise<PluginServiceRegistration | PluginServiceRegistration[] | void>
  config?: (input: Config) => Promise<void>
  auth?: AuthHook
  provider?: ProviderHook
  /**
   * Called when a new message is received
   */
  "chat.message"?: (
    input: {
      sessionID: string
      agent?: string
      model?: { providerID: string; modelID: string }
      messageID?: string
      variant?: string
    },
    output: { message: UserMessage; parts: Part[] },
  ) => Promise<void>
  /**
   * Modify parameters sent to LLM
   */
  "chat.params"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
    output: {
      temperature: number | undefined
      topP: number | undefined
      topK: number | undefined
      maxOutputTokens: number | undefined
      options: Record<string, any>
    },
  ) => Promise<void>
  "chat.headers"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
    output: { headers: Record<string, string> },
  ) => Promise<void>
  "command.execute.before"?: (
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Part[] },
  ) => Promise<void>
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>
  "shell.env"?: (
    input: { cwd: string; sessionID?: string; callID?: string },
    output: { env: Record<string, string> },
  ) => Promise<void>
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: {
      title: string
      output: string
      metadata: any
    },
  ) => Promise<void>
  "experimental.chat.messages.transform"?: (
    input: {},
    output: {
      messages: {
        info: VisibleMessage
        parts: Part[]
      }[]
    },
  ) => Promise<void>
  "experimental.chat.system.transform"?: (
    input: { sessionID?: string; model: Model },
    output: {
      system: string[]
    },
  ) => Promise<void>
  /**
   * Called before session compaction starts. Allows plugins to append
   * evidence context to the host-owned compaction prompt.
   *
   * - `context`: Additional context strings appended to the default prompt
   */
  "experimental.session.compacting"?: (input: { sessionID: string }, output: { context: string[] }) => Promise<void>
  "experimental.text.complete"?: (
    input: { sessionID: string; messageID: string; partID: string },
    output: { text: string },
  ) => Promise<void>
  /**
   * Modify tool definitions (description and parameters) sent to LLM
   */
  "tool.definition"?: (input: { toolID: string }, output: { description: string; parameters: any }) => Promise<void>
}
