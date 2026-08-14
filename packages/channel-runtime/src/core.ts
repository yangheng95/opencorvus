import { createHash, randomUUID } from "node:crypto"
import path from "node:path"
import { ChannelId, type ChannelName } from "@opencorvus-ai/channel-config"
import { createOpenCorvus, createOpenCorvusClient, type Event, type OpenCorvusClient } from "@opencorvus-ai/sdk"
import { mkdir, open, readFile, rename, rm } from "node:fs/promises"
import lockfile from "proper-lockfile"
import type { ChannelAdapter, IncomingMessage } from "./adapter"
import type { STTPipeline } from "./stt/pipeline"
import type { VisionPipeline } from "./vision"
import {
  BOT_MESSAGE_LIMIT,
  formatToolStatus as formatToolStatusMessage,
  polishText,
  splitText,
} from "./message-formatter"
import { SessionCoordinator } from "./session-coordinator"

interface SessionEntry {
  sessionId: string
  adapter: ChannelAdapter
  channel: string
  thread: string
}

type ScreenAttachment = { type?: string; mime?: string; url?: string; filename?: string }
type SessionMessagePart = { id?: string; state?: { attachments?: ScreenAttachment[] } }
type PermissionAsked = {
  id: string
  sessionID: string
  toolName: string
  summary: string
}
const controlPlatforms: readonly ChannelName[] = ChannelId.options
type ControlPlatform = ChannelName
type ChannelAttachment = {
  mime: string
  url: string
  filename?: string
}
type ChannelResult = {
  kind: "panel_response" | "created" | "message" | "interaction" | "progress" | "task_list" | "cancelled"
  message?: string
  message_id?: string
  control_session_id?: string
  task_id?: string
  attachments?: ChannelAttachment[]
}
type EventPermissionAsked = Extract<Event, { type: "permission.asked" }>
type EventMessageUpdated = Extract<Event, { type: "message.updated" }>
type EventMessagePartUpdated = Extract<Event, { type: "message.part.updated" }>
type EventTaskCompleted = Extract<Event, { type: "task.completed" }>
const MIRROR_PREFIX = "[opencorvus-mirror]"
type PendingPromptExecution = {
  executionId: string
  sessionID: string
  messageID: string
}

type DirectPromptOperation = {
  controller: AbortController
  completion: Promise<void>
}

export interface ChannelRuntimeOptions {
  port?: number
  baseUrl?: string
  directory?: string
  channelProtocol?: boolean
  sharedMode?: boolean
  sharedFile?: string
}

export type ChannelRuntimeStartReceipt = {
  readonly channels: readonly string[]
  readonly failedChannels: readonly string[]
}

export class ChannelRuntime {
  private static readonly STARTUP_MESSAGE_LIMIT = 1_000
  private session = new SessionCoordinator<SessionEntry>()
  private candidates: ChannelAdapter[] = []
  private adapters: ChannelAdapter[] = []
  private cleanupPending = new Set<ChannelAdapter>()
  private client!: OpenCorvusClient
  private server?: { url: string; close(): void }
  /** Buffer assistant text per messageID until message.updated signals completion */
  private textBuffers = new Map<string, string>()
  private static readonly TEXT_BUF_MAX = 200
  /** Track user message IDs to skip their parts */
  private userMessageIds = new Set<string>()
  private static readonly USER_MSG_MAX = 500
  private static readonly USER_MSG_TARGET = 400
  /** Buffer text captured from message.part.updated before we know the message role */
  private pendingPartTexts = new Map<string, string>()
  private static readonly PENDING_PART_MAX = 200
  private static readonly PENDING_PART_TARGET = 150
  /** Set to false by stop() to terminate the reconnect loop */
  private running = false
  private stt?: STTPipeline
  private vision?: VisionPipeline
  /** Base URL of the OpenCorvus server */
  private serverUrl!: string
  private directory!: string
  private sharedSessionId?: string
  /** Prevent creating duplicate overlay mirror threads */
  private overlayMirrorBound = false
  private pending = new Map<string, PendingPromptExecution>()
  private directPromptOperations = new Map<string, DirectPromptOperation>()
  private directPromptAdmissionClosed = false
  private directPromptAdmissionGeneration = 0
  private taskBindings = new Map<string, SessionEntry[]>()
  private taskByThread = new Map<string, string>()

  constructor(private options?: ChannelRuntimeOptions) {}

  setSTT(pipeline: STTPipeline): void {
    this.stt = pipeline
  }

  setVision(pipeline: VisionPipeline): void {
    this.vision = pipeline
  }

  get adapterCount(): number {
    return this.adapters.length
  }

  register(adapter: ChannelAdapter): this {
    this.candidates.push(adapter)
    return this
  }

  /** Send a message to a channel adapter with error logging (non-throwing). */
  private async safeSend(adapter: ChannelAdapter, channel: string, thread: string, message: string): Promise<void> {
    await adapter.sendMessage(channel, thread, message).catch((err) => {
      console.warn(`[ChannelRuntime] sendMessage failed (${adapter.platform ?? "unknown"} ${channel}):`, String(err))
    })
  }

  /**
   * audit-2026-04-29 W2-V14 — concurrent-start race. Pre-fix
   * `start()` had no idempotency guard. Two near-simultaneous
   * callers both saw `this.running === false` (only set on entry,
   * not before the await on `createOpenCorvus`), and BOTH proceeded
   * to spawn an OpenCorvus server, register adapter handlers
   * twice, and call `subscribeEvents` twice — leaving a duplicate
   * SSE reconnect loop, double event dispatch, and (in the
   * non-baseUrl branch) port collision on the second
   * `createOpenCorvus`.
   *
   * Hold an in-flight Promise so concurrent callers share the
   * single startup; subsequent calls after a successful start are
   * a no-op. This mirrors the start-once contract in Server.listen.
   */
  private startPromise: Promise<ChannelRuntimeStartReceipt> | undefined
  private startReceipt: ChannelRuntimeStartReceipt | undefined

  async start(): Promise<ChannelRuntimeStartReceipt> {
    if (this.startReceipt) return this.startReceipt
    if (this.startPromise) return this.startPromise
    this.startPromise = this._doStart()
      .then((receipt) => {
        this.startReceipt = receipt
        return receipt
      })
      .catch((err) => {
        return this.rollbackStart(err)
      })
      .finally(() => {
        this.startPromise = undefined
      })
    return this.startPromise
  }

  private async _doStart(): Promise<ChannelRuntimeStartReceipt> {
    this.running = true
    this.directPromptAdmissionClosed = false
    this.directory = this.requireDirectory()

    // Validate existing shared-session state before starting server, event subscriptions, or adapters.
    if (this.sharedMode() && !this.sharedSessionId) {
      const fromFile = await this.readSharedSessionFile()
      if (fromFile) {
        this.sharedSessionId = fromFile
        console.log(`[ChannelRuntime] Pre-loaded shared session: ${fromFile}`)
      }
    }

    const baseUrl = this.options?.baseUrl?.trim()
    if (baseUrl) {
      this.client = createOpenCorvusClient({ baseUrl, directory: this.directory })
      this.server = undefined
      this.serverUrl = baseUrl
    } else {
      const opencorvus = await createOpenCorvus({ port: this.options?.port ?? 0 })
      this.server = opencorvus.server
      this.serverUrl = opencorvus.server.url
      this.client = createOpenCorvusClient({ baseUrl: this.serverUrl, directory: this.directory })
    }
    console.log(`[ChannelRuntime] OpenCorvus server running at ${this.serverUrl}`)

    this.subscribeEvents()

    // Standalone and managed bootstraps reject an empty configuration before
    // calling start. Keeping an empty runtime valid preserves the core's
    // server-only embedding contract used by direct consumers and tests.
    if (this.candidates.length === 0) return { channels: [], failedChannels: [] }

    const startupOwners = this.candidates.map((adapter) => {
      const owner = {
        adapter,
        admitted: false,
        settled: false,
        buffer: [] as IncomingMessage[],
        delivery: Promise.resolve(),
        failure: undefined as Error | undefined,
      }
      adapter.onMessage((msg) => {
        if (!owner.admitted) {
          if (owner.failure) return Promise.reject(owner.failure)
          if (!owner.settled) {
            if (owner.buffer.length >= ChannelRuntime.STARTUP_MESSAGE_LIMIT) {
              owner.failure = new Error(
                `${adapter.platform} adapter exceeded ${ChannelRuntime.STARTUP_MESSAGE_LIMIT} buffered startup messages before readiness`,
              )
              return Promise.reject(owner.failure)
            } else {
              owner.buffer.push(msg)
            }
          }
          return Promise.resolve()
        }
        owner.delivery = owner.delivery.then(() => this.handleMessage(msg))
        return owner.delivery
      })
      return owner
    })
    const publishActiveAdapters = () => {
      this.adapters = startupOwners.flatMap((owner) => (owner.admitted ? [owner.adapter] : []))
    }
    const started = await Promise.all(
      startupOwners.map(async (owner) => {
        const { adapter } = owner
        try {
          await adapter.start()
          if (owner.failure) throw owner.failure
          for (const msg of owner.buffer) {
            owner.delivery = owner.delivery.then(() => this.handleMessage(msg))
          }
          owner.buffer.length = 0
          owner.admitted = true
          publishActiveAdapters()
          await owner.delivery
          owner.settled = true
          return { status: "fulfilled" as const, adapter }
        } catch (error) {
          owner.admitted = false
          owner.settled = true
          owner.buffer.length = 0
          publishActiveAdapters()
          console.error(`[ChannelRuntime] ${adapter.platform} adapter start failed:`, error)
          try {
            await adapter.stop()
          } catch (cleanupError) {
            this.cleanupPending.add(adapter)
            console.error(`[ChannelRuntime] ${adapter.platform} adapter rollback failed:`, cleanupError)
          }
          return { status: "rejected" as const, adapter, error }
        }
      }),
    )
    const rejected = started.flatMap((item) => (item.status === "rejected" ? [item] : []))
    if (this.cleanupPending.size > 0) {
      throw new AggregateError(
        rejected.map((item) => item.error),
        `Channel runtime could not settle ${this.cleanupPending.size} rejected adapter owner(s)`,
      )
    }
    if (this.adapters.length === 0) {
      throw new AggregateError(
        rejected.map((item) => item.error),
        "Channel runtime did not start any configured adapter",
      )
    }

    // Overlay is managed by OpenCorvus's overlay-client.ts (spawned on first tool use)
    return Object.freeze({
      channels: Object.freeze(this.adapters.map((adapter) => adapter.platform)),
      failedChannels: Object.freeze(rejected.map((item) => item.adapter.platform)),
    })
  }

  private async rollbackStart(startupError: unknown): Promise<never> {
    try {
      await this.stop()
    } catch (cleanupError) {
      throw new AggregateError([startupError, cleanupError], "Channel runtime startup rollback failed")
    }
    throw startupError
  }

  async stop(): Promise<void> {
    this.running = false
    this.directPromptAdmissionClosed = true
    this.directPromptAdmissionGeneration += 1
    this.startReceipt = undefined
    const promptOperations = [...this.directPromptOperations.values()]
    for (const operation of promptOperations) {
      operation.controller.abort(new Error("Channel runtime stopped"))
    }
    const adapters = [...new Set([...this.adapters, ...this.cleanupPending])]
    const server = this.server
    const results = await Promise.allSettled([
      ...promptOperations.map((operation) => operation.completion),
      ...adapters.map((adapter) => adapter.stop()),
      Promise.resolve().then(() => server?.close()),
    ])
    this.pending.clear()
    this.directPromptOperations.clear()
    this.taskBindings.clear()
    this.taskByThread.clear()
    this.textBuffers.clear()
    this.userMessageIds.clear()
    this.pendingPartTexts.clear()
    this.session.clear()
    for (const [resultIndex, result] of results.slice(promptOperations.length).entries()) {
      if (result.status !== "fulfilled") continue
      const adapter = adapters[resultIndex]
      if (adapter) {
        this.adapters = this.adapters.filter((candidate) => candidate !== adapter)
        this.cleanupPending.delete(adapter)
        continue
      }
      if (this.server === server) this.server = undefined
    }
    const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    if (failures.length > 0) {
      throw new AggregateError(failures, `Channel runtime failed to release ${failures.length} resource owner(s)`)
    }
  }

  async handleMessage(msg: IncomingMessage): Promise<void> {
    const promptAdmissionGeneration = this.directPromptAdmissionGeneration
    const promptAdmissionIsCurrent = () =>
      !this.directPromptAdmissionClosed &&
      promptAdmissionGeneration === this.directPromptAdmissionGeneration
    if (!promptAdmissionIsCurrent()) return
    const threadKey = `${msg.platform}:${msg.channel}:${msg.thread}`
    const adapter = this.adapters.find((a) => a.platform === msg.platform)
    if (!adapter) return

    // --- Voice message transcription ---
    let text = msg.text
    if (msg.audio) {
      if (!this.stt || !this.stt.isAvailable) {
        const notice = "Voice messages are not supported (no STT provider configured)."
        this.mirror("system", notice, {
          platform: msg.platform,
          channel: msg.channel,
          thread: msg.thread,
        })
        await adapter.sendMessage(msg.channel, msg.thread, notice)
        if (!text) return
      } else {
        try {
          const result = await this.stt.transcribe(msg.audio)
          if (!promptAdmissionIsCurrent()) return
          const prefix = `[Voice message transcript]: ${result.text}`
          text = text ? `${prefix}\n\n${text}` : prefix
          console.log(`[ChannelRuntime] Transcribed voice (${result.provider}, ${result.durationMs}ms)`)
        } catch (error) {
          const notice = `Failed to transcribe voice message: ${String(error)}`
          this.mirror("system", notice, {
            platform: msg.platform,
            channel: msg.channel,
            thread: msg.thread,
          })
          await adapter.sendMessage(msg.channel, msg.thread, notice)
          return
        }
      }
    }

    if (!text) return

    if (this.channelProtocol(msg.platform)) {
      await this.handleChannelMessage(msg as IncomingMessage & { platform: ControlPlatform }, adapter, text)
      return
    }

    let session = this.session.get(threadKey)

    if (!session) {
      const shared = this.sharedMode()
      const sharedId = shared ? await this.ensureSharedSession(msg) : undefined
      if (!promptAdmissionIsCurrent()) return
      if (shared) {
        if (!sharedId) {
          const notice = "Failed to initialize shared session."
          this.mirror("system", notice, {
            platform: msg.platform,
            channel: msg.channel,
            thread: msg.thread,
          })
          await adapter.sendMessage(msg.channel, msg.thread, notice)
          return
        }
        session = {
          sessionId: sharedId,
          adapter,
          channel: msg.channel,
          thread: msg.thread,
        }
        this.session.bind(threadKey, session)
        console.log(`[ChannelRuntime] Bound ${threadKey} to shared session ${sharedId}`)
      }
      if (!shared) {
        const createResult = await this.client.session.create({
          kind: "assistant",
          title: `${msg.platform} thread ${msg.thread}`,
        })
        if (!promptAdmissionIsCurrent()) return

        if (createResult.error || !createResult.data) {
          console.error("[ChannelRuntime] session.create error:", JSON.stringify(createResult.error).slice(0, 500))
          const notice = "Failed to create session."
          this.mirror("system", notice, {
            platform: msg.platform,
            channel: msg.channel,
            thread: msg.thread,
          })
          await adapter.sendMessage(msg.channel, msg.thread, notice)
          return
        }

        session = {
          sessionId: createResult.data.id,
          adapter,
          channel: msg.channel,
          thread: msg.thread,
        }
        this.session.bind(threadKey, session)
        console.log(`[ChannelRuntime] Created session ${createResult.data.id} for ${threadKey}`)
      }
    }

    if (!session) {
      const notice = "Failed to initialize session."
      this.mirror("system", notice, {
        platform: msg.platform,
        channel: msg.channel,
        thread: msg.thread,
      })
      await adapter.sendMessage(msg.channel, msg.thread, notice)
      return
    }
    if (!promptAdmissionIsCurrent()) return
    this.mirror("user", text, {
      platform: msg.platform,
      channel: msg.channel,
      thread: msg.thread,
      sessionId: session.sessionId,
    })

    await this.submitTask(session.sessionId, text, msg, adapter, promptAdmissionGeneration)
  }

  private async submitTask(
    sessionID: string,
    text: string,
    source: IncomingMessage,
    adapter: ChannelAdapter,
    promptAdmissionGeneration: number,
  ) {
    if (
      this.directPromptAdmissionClosed ||
      promptAdmissionGeneration !== this.directPromptAdmissionGeneration
    ) {
      return
    }
    const executionId = randomUUID()
    const messageID = `msg_h${createHash("sha256")
      .update(
        `channel-session-prompt\0${source.platform}\0${source.channel}\0${source.thread}\0${source.id ?? executionId}`,
      )
      .digest("hex")
      .slice(0, 19)}`
    const controller = new AbortController()
    this.markPending({ sessionID, executionId, messageID })
    const completion = (async () => {
      let result: Awaited<ReturnType<OpenCorvusClient["session"]["prompt"]>>
      try {
        result = await this.client.session.prompt(
          {
            sessionID,
            messageID,
            parts: [{ type: "text", text }],
          },
          { signal: controller.signal },
        )
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[ChannelRuntime] session.prompt failed:", error)
        if (!this.releaseExecution(executionId)) return
        const notice = "Failed to send prompt."
        this.mirror("system", notice, {
          platform: source.platform,
          channel: source.channel,
          thread: source.thread,
          sessionId: sessionID,
        })
        await adapter.sendMessage(source.channel, source.thread, notice)
        return
      }
      if (result.error) {
        console.error("[ChannelRuntime] session.prompt error:", JSON.stringify(result.error).slice(0, 500))
        if (!this.releaseExecution(executionId)) return
        const notice = "Failed to send prompt."
        this.mirror("system", notice, {
          platform: source.platform,
          channel: source.channel,
          thread: source.thread,
          sessionId: sessionID,
        })
        await adapter.sendMessage(source.channel, source.thread, notice)
        return
      }
      if (!this.releaseExecution(executionId)) return
      console.log(`[ChannelRuntime] Prompt completed via session.prompt for session ${sessionID}`)
    })()
    this.directPromptOperations.set(executionId, { controller, completion })
    try {
      await completion
    } finally {
      if (this.directPromptOperations.get(executionId)?.completion === completion) {
        this.directPromptOperations.delete(executionId)
      }
    }
  }

  private channelProtocol(platform: string): platform is ControlPlatform {
    return this.options?.channelProtocol === true && controlPlatforms.includes(platform as ControlPlatform)
  }

  private async handleChannelMessage(
    msg: IncomingMessage & { platform: ControlPlatform },
    adapter: ChannelAdapter,
    text: string,
  ) {
    const result = await this.client.channel.message({
      platform: msg.platform as ControlPlatform,
      channel: msg.channel,
      thread: msg.thread,
      text,
      user_id: msg.user,
      request_id: msg.id,
      source: msg.platform,
      allow_create: true,
    })
    if (result.error) {
      const notice = "Failed to handle message."
      this.mirror("system", notice, {
        platform: msg.platform,
        channel: msg.channel,
        thread: msg.thread,
      })
      await adapter.sendMessage(msg.channel, msg.thread, notice)
      throw new Error(`Channel message failed: ${JSON.stringify(result.error)}`)
    }
    const data = result.data as ChannelResult
    if (data.task_id) {
      this.bindTask(data.task_id, {
        sessionId: data.task_id,
        adapter,
        channel: msg.channel,
        thread: msg.thread,
      })
    }
    await this.sendChannelResult(adapter, msg.channel, msg.thread, data)
  }

  private polish(text: string): string {
    return polishText(text)
  }

  private split(text: string, limit = BOT_MESSAGE_LIMIT): string[] {
    return splitText(text, limit)
  }

  private bindTask(taskID: string, entry: SessionEntry) {
    const key = `${entry.adapter.platform}:${entry.channel}:${entry.thread}`
    const previous = this.taskByThread.get(key)
    if (previous && previous !== taskID) {
      const next = (this.taskBindings.get(previous) ?? []).filter((item) => !sameEntry(item, entry))
      if (next.length > 0) this.taskBindings.set(previous, next)
      else this.taskBindings.delete(previous)
    }
    this.taskByThread.set(key, taskID)
    const current = this.taskBindings.get(taskID) ?? []
    if (current.some((item) => sameEntry(item, entry))) return
    this.taskBindings.set(taskID, [...current, entry])
  }

  private findTaskBindings(taskID: string) {
    return this.taskBindings.get(taskID) ?? []
  }

  private async findTaskBindingsForEvent(taskID: string) {
    const cached = this.findTaskBindings(taskID)
    if (cached.length > 0) return cached
    const result = await this.client.task.bindings({ taskID })
    if (result.error || !result.data) {
      console.warn(`[ChannelRuntime] task.bindings failed for ${taskID}:`, JSON.stringify(result.error).slice(0, 500))
      return []
    }
    const sessions = result.data.flatMap((binding) => {
      const adapter = this.adapters.find((item) => item.platform === binding.platform)
      if (!adapter) return []
      return [
        {
          sessionId: taskID,
          adapter,
          channel: binding.channel,
          thread: binding.thread,
        },
      ]
    })
    for (const session of sessions) {
      this.bindTask(taskID, session)
    }
    return sessions
  }

  private async sendChannelResult(adapter: ChannelAdapter, channel: string, thread: string, result: ChannelResult) {
    const message = await this.channelResultText(result)
    if (message.trim()) {
      await adapter.sendMessage(channel, thread, message)
    }
    for (const item of result.attachments ?? []) {
      const image = imageAttachment(item)
      if (!image) continue
      if (adapter.uploadImageUrl) {
        const url = await this.publishChannelAttachment(item.mime, image.buffer, image.filename)
        await adapter.uploadImageUrl(channel, thread, url, image.filename, message || image.filename)
        continue
      }
      await adapter.uploadImage(channel, thread, image.buffer, image.filename, message || image.filename)
    }
  }

  private async channelResultText(result: ChannelResult): Promise<string> {
    if (result.message !== undefined) return result.message
    if (!result.control_session_id || !result.message_id) return ""
    const response = await this.client.session.message({
      sessionID: result.control_session_id,
      messageID: result.message_id,
    })
    if (response.error) {
      throw new Error(
        `Failed to read Control final message ${result.control_session_id}/${result.message_id}: ${JSON.stringify(response.error)}`,
      )
    }
    const message = response.data as { parts?: Array<{ type?: string; text?: string }> }
    return (message.parts ?? [])
      .flatMap((part) => (part.type === "text" && typeof part.text === "string" ? [part.text] : []))
      .join("\n")
      .trim()
  }

  private async publishChannelAttachment(mime: string, buffer: Buffer, filename: string) {
    const endpoint = new URL(`${this.serverUrl.replace(/\/+$/, "")}/channel/attachment`)
    endpoint.searchParams.set("directory", this.directory)
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mime,
        filename,
        data: buffer.toString("base64"),
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      throw new Error(`channel attachment publish failed: ${res.status} ${await res.text()}`)
    }
    const data = (await res.json()) as { url?: string }
    if (!data.url) throw new Error("channel attachment publish failed: missing url")
    return data.url
  }

  private requireDirectory(): string {
    const directory = this.options?.directory?.trim()
    if (!directory) {
      throw new Error("ChannelRuntime requires options.directory for project-scoped channel routes")
    }
    return directory
  }

  private mirror(
    kind: "user" | "assistant" | "system",
    text: string,
    info?: { sessionId?: string; platform?: string; channel?: string; thread?: string },
  ) {
    if (process.env.OPENCORVUS_MIRROR_STDOUT !== "1") return
    const value = text.trim()
    if (!value) return
    console.log(
      `${MIRROR_PREFIX}${JSON.stringify({
        kind,
        text: value,
        ts: Date.now(),
        session_id: info?.sessionId,
        platform: info?.platform,
        channel: info?.channel,
        thread: info?.thread,
      })}`,
    )
  }

  private mirrorSessions(
    kind: "user" | "assistant" | "system",
    text: string,
    sessionId: string,
    sessions: SessionEntry[],
  ) {
    if (sessions.length === 0) {
      this.mirror(kind, text, { sessionId })
      return
    }
    const seen = new Set<string>()
    for (const item of sessions) {
      const key = `${item.adapter.platform}:${item.channel}:${item.thread}`
      if (seen.has(key)) continue
      seen.add(key)
      this.mirror(kind, text, {
        sessionId,
        platform: item.adapter.platform,
        channel: item.channel,
        thread: item.thread,
      })
    }
  }

  private sharedMode() {
    if (this.options?.sharedMode !== undefined) return this.options.sharedMode
    return process.env.OPENCORVUS_SHARED_SESSION_MODE === "1"
  }

  private sharedFile() {
    const fromOption = this.options?.sharedFile?.trim()
    if (fromOption) return fromOption
    const fromEnv = process.env.OPENCORVUS_SHARED_SESSION_FILE?.trim()
    if (fromEnv) return fromEnv
    return path.resolve(process.cwd(), ".opencorvus/shared-session.json")
  }

  private async readSharedSessionFile() {
    const file = this.sharedFile()
    const text = await readFile(file, "utf8").catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined
      throw new Error(`Failed to read shared session file ${file}: ${String(error)}`)
    })
    if (text === undefined) return undefined

    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch (error) {
      throw new Error(`Invalid shared session file JSON ${file}: ${String(error)}`)
    }
    const sessionId =
      raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { session_id?: unknown }).session_id : undefined
    if (typeof sessionId !== "string") {
      throw new Error(`Invalid shared session file shape ${file}: expected non-empty session_id`)
    }
    const id = sessionId.trim()
    if (!id) {
      throw new Error(`Invalid shared session file shape ${file}: expected non-empty session_id`)
    }
    return id
  }

  private async prepareSharedSessionFile() {
    const file = this.sharedFile()
    await mkdir(path.dirname(file), { recursive: true })
    return file
  }

  private async publishSharedSessionFile(temporary: string, file: string) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await rename(temporary, file)
        return
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined
        const retryable = process.platform === "win32" && ["EACCES", "EBUSY", "EPERM"].includes(String(code))
        if (!retryable || attempt >= 100) throw error
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(25, attempt)))
      }
    }
  }

  private async writeSharedSessionFile(file: string, sessionId: string) {
    const payload = {
      session_id: sessionId,
      updated_at: Date.now(),
    }
    const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`)
    let handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      handle = await open(temporary, "wx", 0o600)
      await handle.writeFile(JSON.stringify(payload, null, 2) + "\n")
      await handle.sync()
      await handle.close()
      handle = undefined
      await this.publishSharedSessionFile(temporary, file)
      if (process.platform !== "win32") {
        const directory = await open(path.dirname(file), "r")
        try {
          await directory.sync()
        } finally {
          await directory.close()
        }
      }
    } finally {
      await handle?.close().catch(() => undefined)
      await rm(temporary, { force: true }).catch(() => undefined)
    }
  }

  private async ensureSharedSession(msg: IncomingMessage) {
    if (!this.sharedMode()) return undefined
    if (this.sharedSessionId) return this.sharedSessionId

    try {
      const fromFile = await this.readSharedSessionFile()
      if (fromFile) {
        this.sharedSessionId = fromFile
        return fromFile
      }

      const sharedFile = await this.prepareSharedSessionFile()
      const release = await lockfile.lock(sharedFile, {
        realpath: false,
        stale: 30_000,
        update: 5_000,
        retries: {
          retries: 200,
          factor: 1,
          minTimeout: 10,
          maxTimeout: 25,
        },
      })
      try {
        const claimed = await this.readSharedSessionFile()
        if (claimed) {
          this.sharedSessionId = claimed
          return claimed
        }

        const createResult = await this.client.session.create({
          kind: "assistant",
          title: `${msg.platform} shared session`,
        })
        if (createResult.error || !createResult.data) {
          console.error(
            "[ChannelRuntime] shared session.create error:",
            JSON.stringify(createResult.error).slice(0, 500),
          )
          return undefined
        }

        await this.writeSharedSessionFile(sharedFile, createResult.data.id)
        this.sharedSessionId = createResult.data.id
        console.log(`[ChannelRuntime] Created shared session ${createResult.data.id}`)
        return createResult.data.id
      } finally {
        await release()
      }
    } catch (error) {
      console.error("[ChannelRuntime] shared session claim failed:", error)
      return undefined
    }
  }

  /**
   * Inject a prompt directly into a channel, bypassing inbound listener events.
   * Requires adapter.startThread(channel, text).
   */
  async injectPrompt(platform: string, channel: string, text: string): Promise<void> {
    const adapter = this.adapters.find((a) => a.platform === platform)
    if (!adapter) throw new Error(`No adapter for platform: ${platform}`)
    if (!adapter.startThread) throw new Error(`Adapter ${platform} does not support injectPrompt`)

    // Post the prompt as a visible message and get its ts for threading
    const ts = await adapter.startThread(channel, `[OpenCorvus Task] ${text}`)

    // Treat it as an incoming message — this creates session + sends prompt
    await this.handleMessage({
      platform,
      channel,
      thread: ts,
      user: "system",
      text,
    })
  }

  private markPending(input: { sessionID: string; executionId: string; messageID: string }) {
    this.pending.set(input.executionId, {
      ...input,
    })
  }

  private releaseExecution(executionId: string): boolean {
    if (!this.pending.has(executionId)) return false
    this.pending.delete(executionId)
    return true
  }


  /** Format a brief status message for important tool completions */
  private formatToolStatus(tool: string, input: unknown): string | null {
    return formatToolStatusMessage(tool, input, process.env)
  }

  private findSessions(sessionId: string) {
    return this.session.findSessions(sessionId)
  }

  /**
   * In shared mode, when no Slack thread is bound to the shared session yet
   * (e.g. overlay sends a prompt before any Slack message arrives), create a
   * dedicated mirror thread in SLACK_CHANNEL_ID and bind it.  Called lazily on
   * the first event that needs a Slack target.
   */
  private async bindOverlayMirrorIfNeeded(sessionId: string): Promise<SessionEntry[]> {
    // Already bound — just look up what SessionCoordinator has
    if (this.overlayMirrorBound) return this.findSessions(sessionId)

    const channel = process.env.SLACK_CHANNEL_ID
    if (!channel) return []

    const adapter = this.adapters.find((a) => typeof a.startThread === "function")
    if (!adapter?.startThread) return []

    // Set flag before await to prevent concurrent calls from creating multiple threads
    this.overlayMirrorBound = true
    try {
      const ts = await adapter.startThread(channel, "[Overlay Console] Session started")
      const entry: SessionEntry = { sessionId, adapter, channel, thread: ts }
      this.session.bind(`overlay-mirror:${sessionId}`, entry)
      console.log(`[ChannelRuntime] Overlay mirror thread created: ${channel}:${ts} for session ${sessionId}`)
      return [entry]
    } catch (err) {
      this.overlayMirrorBound = false
      console.warn("[ChannelRuntime] Failed to create overlay mirror thread:", err)
      return []
    }
  }

  /**
   * Upload screenshot attachment and optionally run vision analysis in parallel.
   * Use event payload attachments when present; fetch message parts only when the event omitted attachments.
   */
  private async processScreenshot(
    sessions: SessionEntry[],
    sessionId: string,
    messageId: string,
    partId: string,
    title: string,
    diffPercent?: number,
    initialAttachments?: ScreenAttachment[],
  ): Promise<void> {
    try {
      let attachments = (initialAttachments ?? []).filter(
        (att) => att.type === "file" && att.mime?.startsWith("image/"),
      )
      if (attachments.length === 0) {
        const msgResult = await this.client.session.message({
          sessionID: sessionId,
          messageID: messageId,
        })
        if (msgResult.error) return
        const data = msgResult.data as { parts?: SessionMessagePart[] }
        const part = (data.parts ?? []).find((p) => p.id === partId)
        attachments = (part?.state?.attachments ?? []).filter(
          (att) => att.type === "file" && att.mime?.startsWith("image/"),
        )
      }
      for (const att of attachments) {
        const match = att.url?.match(/^data:[^;]+;base64,(.+)$/)
        if (!match) continue

        const base64Data = match[1]
        const buffer = Buffer.from(base64Data, "base64")
        const ext = att.mime === "image/png" ? "png" : "jpg"

        // Skip vision for oversized screenshots (would timeout or OOM the API)
        const tooLarge = buffer.length >= 7 * 1024 * 1024
        if (tooLarge) {
          console.log(
            `[ChannelRuntime] Vision skipped: screenshot too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB > 7MB)`,
          )
        }

        // Skip vision for trivial screen changes (cursor blinks, etc.)
        const visionDiffThreshold = Number(process.env.OPENCORVUS_MONITOR_DIFF_THRESHOLD) || 2
        const lowDiff = diffPercent !== undefined && diffPercent < visionDiffThreshold
        if (lowDiff) {
          console.log(
            `[ChannelRuntime] Vision skipped: low screen change (${diffPercent.toFixed(1)}% < ${visionDiffThreshold}% threshold)`,
          )
        }

        // Run upload and vision analysis in parallel
        const uploadPromise = Promise.all(
          sessions.map((session) =>
            session.adapter.uploadImage(
              session.channel,
              session.thread,
              buffer,
              att.filename ?? `screenshot.${ext}`,
              title,
            ),
          ),
        )

        const shouldVision = this.vision && !tooLarge && !lowDiff
        const visionPromise = shouldVision
          ? this.vision!.analyze(base64Data).catch((err) => {
              console.warn("[ChannelRuntime] Vision analysis failed:", err)
              return null
            })
          : Promise.resolve(null)

        const [, visionResult] = await Promise.all([uploadPromise, visionPromise])

        console.log(`[ChannelRuntime] Uploaded screenshot (${(buffer.length / 1024).toFixed(0)}KB)`)

        if (visionResult) {
          console.log(
            `[ChannelRuntime] Vision analysis (${visionResult.tokens.prompt + visionResult.tokens.completion} tokens): ${visionResult.description.slice(0, 120)}...`,
          )
        }
      }
    } catch (err) {
      console.error("[ChannelRuntime] processScreenshot error:", err)
    }
  }

  private async handleEvent(event: Event): Promise<void> {
    // Task completion is the single terminal delivery fact. Push it back to
    // every channel thread bound to the Task without recreating an evaluation
    // lifecycle in the channel runtime.
    if (event.type === "task.completed") {
      const info = (event as EventTaskCompleted).properties
      const sessions = await this.findTaskBindingsForEvent(info.taskID)
      if (sessions.length === 0) return
      const msg = `Task completed: ${info.summary}`
      for (const session of sessions) {
        await this.safeSend(session.adapter, session.channel, session.thread, msg)
      }
      return
    }

    if (event.type === "permission.asked") {
      const asked = (event as EventPermissionAsked).properties as PermissionAsked
      const sessions = this.findSessions(asked.sessionID)
      this.mirrorSessions(
        "system",
        `Permission requested: ${asked.toolName} — ${asked.summary}`,
        asked.sessionID,
        sessions,
      )
      for (const session of sessions) {
        await this.safeSend(
          session.adapter,
          session.channel,
          session.thread,
          `Permission requested: ${asked.toolName} — ${asked.summary}. Waiting for operator reply.`,
        )
      }
      console.log(`[ChannelRuntime] Permission request ${asked.id} is waiting for operator reply`)
      return
    }

    // Track user message IDs so we can skip their parts
    if (event.type === "message.updated") {
      const info = (event as EventMessageUpdated).properties.info

      if (info.role === "user") {
        // Track on first event only; message.updated fires twice for the same user message
        const isNew = !this.userMessageIds.has(info.id)
        this.userMessageIds.add(info.id)
        // Prevent unbounded growth — evict oldest entries when limit reached
        if (this.userMessageIds.size > ChannelRuntime.USER_MSG_MAX) {
          const iter = this.userMessageIds.values()
          const evictCount = this.userMessageIds.size - ChannelRuntime.USER_MSG_TARGET
          for (let i = 0; i < evictCount; i++) {
            const val = iter.next().value
            if (val !== undefined) this.userMessageIds.delete(val)
          }
        }

        // In shared mode, mirror the user's overlay prompt to Slack.
        // message.part.updated arrives BEFORE this event and pre-captured the text in pendingPartTexts.
        if (isNew && this.sharedMode() && info.sessionID === this.sharedSessionId) {
          // Clean up any user text that leaked into textBuffers before role was known
          this.textBuffers.delete(info.id)
          const userText = this.pendingPartTexts.get(info.id)
          this.pendingPartTexts.delete(info.id)
          if (userText) {
            let sessions = this.findSessions(info.sessionID)
            if (sessions.length === 0) sessions = await this.bindOverlayMirrorIfNeeded(info.sessionID)
            for (const session of sessions) {
              await this.safeSend(session.adapter, session.channel, session.thread, `> ${userText.trim()}`)
            }
          }
        }
        return
      }

      // Flush buffered text when assistant message (one agentic step) completes
      if (info.role === "assistant" && info.time.completed) {
        const text = this.textBuffers.get(info.id)
        this.textBuffers.delete(info.id)
        if (info.parentID) {
          this.userMessageIds.delete(info.parentID)
          this.pendingPartTexts.delete(info.parentID)
          this.textBuffers.delete(info.parentID)
        }
        let sessions = this.findSessions(info.sessionID)
        if (sessions.length === 0 && this.sharedMode() && info.sessionID === this.sharedSessionId) {
          sessions = await this.bindOverlayMirrorIfNeeded(info.sessionID)
        }
        if (sessions.length === 0) return

        if (text) {
          const polished = this.polish(text)
          if (polished) {
            for (const part of this.split(polished, BOT_MESSAGE_LIMIT)) {
              this.mirrorSessions("assistant", part, info.sessionID, sessions)
              for (const session of sessions) {
                await this.safeSend(session.adapter, session.channel, session.thread, part)
              }
            }
          }
          console.log(`[ChannelRuntime] Sent text for ${info.sessionID} (${polished.length} chars)`)
        }

        if (info.error) {
          const errObj = info.error as Record<string, unknown>
          const errMsg = typeof errObj?.error === "string" ? errObj.error : JSON.stringify(info.error)
          this.mirrorSessions("system", `Error: ${errMsg}`, info.sessionID, sessions)
          for (const session of sessions) {
            await this.safeSend(session.adapter, session.channel, session.thread, `Error: ${errMsg}`)
          }
        }
      }
    }

    if (event.type === "message.part.updated") {
      const part = (event as EventMessagePartUpdated).properties.part

      // In shared mode, pre-capture text parts before we know the message role.
      // message.part.updated fires BEFORE message.updated(role=user), so we store
      // the text here and consume it when message.updated confirms role=user.
      if (this.sharedMode() && part.sessionID === this.sharedSessionId && part.type === "text" && part.text?.trim()) {
        this.pendingPartTexts.set(part.messageID, part.text)
        // Prevent unbounded growth — evict oldest entries when limit reached
        if (this.pendingPartTexts.size > ChannelRuntime.PENDING_PART_MAX) {
          const iter = this.pendingPartTexts.keys()
          const evictCount = this.pendingPartTexts.size - ChannelRuntime.PENDING_PART_TARGET
          for (let i = 0; i < evictCount; i++) {
            const key = iter.next().value
            if (key !== undefined) this.pendingPartTexts.delete(key)
          }
        }
      }

      // Skip parts belonging to user messages
      if (this.userMessageIds.has(part.messageID)) return

      let sessions = this.findSessions(part.sessionID)
      if (sessions.length === 0 && this.sharedMode() && part.sessionID === this.sharedSessionId) {
        sessions = await this.bindOverlayMirrorIfNeeded(part.sessionID)
      }
      if (sessions.length === 0) return

      // Buffer text parts keyed by messageID (flushed on message.updated)
      if (part.type === "text") {
        this.textBuffers.set(part.messageID, part.text)
        // Safety cap — entries are normally flushed on message.updated but may leak on abort
        if (this.textBuffers.size > ChannelRuntime.TEXT_BUF_MAX) {
          const iter = this.textBuffers.keys()
          const val = iter.next().value
          if (val !== undefined) this.textBuffers.delete(val)
        }
      }

      // Post tool progress for key tools so remote channel users can see what happened.
      // Overlay hints (popup + window highlight) are handled natively by
      // OpenCorvus's overlay-client.ts — no need to duplicate here.
      if (part.type === "tool") {
        const toolName = part.tool
        const toolInput = part.state?.input

        if (part.state?.status === "completed") {
          // Upload screenshot images from screen tool
          if (toolName === "screen") {
            const hasImage = (part.state.attachments ?? []).some(
              (a: ScreenAttachment) => a.type === "file" && a.mime?.startsWith("image/"),
            )
            if (hasImage) {
              const metadata = part.state.metadata ?? {}
              const rawDiff = (metadata as Record<string, unknown>).diffPercent
              const diffPercent = typeof rawDiff === "number" ? rawDiff : undefined
              await this.processScreenshot(
                sessions,
                part.sessionID,
                part.messageID,
                part.id,
                part.state.title,
                diffPercent,
                part.state.attachments ?? [],
              )
            }
          }

          // Post brief status for important tools (bash, edit, write, skill)
          const statusMsg = this.formatToolStatus(toolName, toolInput)
          if (statusMsg) {
            this.mirrorSessions("assistant", statusMsg, part.sessionID, sessions)
            for (const session of sessions) {
              await this.safeSend(session.adapter, session.channel, session.thread, statusMsg)
            }
          }
        }

        if (part.state?.status === "error") {
          const statusMsg = this.formatToolStatus(toolName, toolInput) ?? `\`${toolName}\``
          // Mirrors packages/opencorvus/src/session/tool-failure-cause.ts:renderToolFailureCause.
          // channel-runtime only depends on @opencorvus-ai/sdk (generated types,
          // no runtime exports), so we cannot import the renderer directly.
          const failure = (
            part.state as { failure?: { kind?: string; name?: string; originSite?: string; message?: string } }
          ).failure
          const err = failure?.message
            ? `${failure.kind ?? ""}/${failure.name ?? ""} at ${failure.originSite ?? "unknown"}: ${failure.message}`
            : "Unknown tool error"
          this.mirrorSessions("system", `${statusMsg} failed: ${err}`, part.sessionID, sessions)
          for (const session of sessions) {
            await this.safeSend(session.adapter, session.channel, session.thread, `${statusMsg} failed: ${err}`)
          }
        }
      }
    }
  }

  // ChannelRuntime relays events from every active OpenCorvus instance into
  // IM channels, so it must subscribe to the cross-instance bus (/global/event).
  // The project-scoped /event endpoint requires a directory and emits one
  // instance's events only — using it here rejects with DirectoryRequiredError
  // and breaks cross-project relaying. Mirror the ACP agent contract
  // (packages/opencorvus/src/acp/agent.ts) which already uses global.event +
  // payload unwrap.
  private subscribeEvents(): void {
    const reconnect = async () => {
      let delay = 1000
      while (this.running) {
        try {
          const events = await this.client.global.event()
          delay = 1000 // reset backoff on successful connection
          for await (const wrapped of events.stream) {
            const payload = (wrapped as { payload?: unknown })?.payload
            if (!payload) continue
            try {
              await this.handleEvent(payload as Event)
            } catch (err) {
              console.error("[ChannelRuntime] event handler error:", err)
            }
          }
          console.warn("[ChannelRuntime] event stream ended, reconnecting...")
        } catch (err) {
          console.error(`[ChannelRuntime] event stream error, retrying in ${delay}ms:`, err)
        }
        if (this.running) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay = Math.min(delay * 2, 60_000) // exponential backoff, cap 60s
        }
      }
    }
    reconnect().catch((err) => console.error("[ChannelRuntime] fatal reconnect error:", err))
  }
}

function imageAttachment(input: ChannelAttachment) {
  if (!input.mime.startsWith("image/")) return
  const match = input.url.match(/^data:[^;]+;base64,(.+)$/)
  if (!match) return
  const buffer = Buffer.from(match[1], "base64")
  const defaultFilename = input.mime === "image/png" ? "opencorvus-gui.png" : "opencorvus-gui.jpg"
  return {
    buffer,
    filename: input.filename ?? defaultFilename,
  }
}

function sameEntry(left: SessionEntry, right: SessionEntry) {
  return (
    left.adapter.platform === right.adapter.platform && left.channel === right.channel && left.thread === right.thread
  )
}
