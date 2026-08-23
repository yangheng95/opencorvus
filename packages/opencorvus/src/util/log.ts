import path from "path"
import fs from "fs/promises"
import pino, { type Logger as PinoLogger } from "pino"
import { Global } from "../global"
import z from "zod"
import { Glob } from "./glob"
import { sanitizeMessage } from "./log-safety"
import { SessionObservability } from "./session-observability"
import { NamedError } from "@opencorvus-ai/util/error"
import { Lock } from "./lock"
import { ProviderError } from "@/provider/error"

export namespace Log {
  export const Level = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).meta({ ref: "LogLevel", description: "Log level" })
  export type Level = z.infer<typeof Level>

  type PinoLevel = "debug" | "info" | "warn" | "error"

  const pinoLevel: Record<Level, PinoLevel> = {
    DEBUG: "debug",
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
  }

  export type Logger = {
    enabled(level: Level): boolean
    debug(message?: any, extra?: Record<string, any>): void
    info(message?: any, extra?: Record<string, any>): void
    error(message?: any, extra?: Record<string, any>): void
    warn(message?: any, extra?: Record<string, any>): void
    tag(key: string, value: string): Logger
    clone(): Logger
    time(
      message: string,
      extra?: Record<string, any>,
    ): {
      stop(): void
      [Symbol.dispose](): void
    }
    timeDebug(
      message: string,
      extra?: Record<string, any>,
    ): {
      stop(): void
      [Symbol.dispose](): void
    }
  }

  export interface Options {
    print: boolean
    dev?: boolean
    level?: Level
  }

  type DurableDestination = ReturnType<typeof pino.destination>

  type PendingRecord = {
    tags: Record<string, any>
    level: PinoLevel
    message: any
    attributes: Record<string, any>
  }

  let level: Level = "INFO"
  let logpath = ""
  let generation = 0
  const stderrDestination = pino.destination(2)
  let durableDestination: DurableDestination | undefined
  let root = createRootLogger(stderrDestination, level)
  let pendingInitializations = 0
  const pendingRecords: PendingRecord[] = []

  export const Default = create({ service: "default" })
  export const FileName = z.string().regex(/^[^/\\:]+\.log$/, {
    message: "Log file must be a .log file name without path separators or drive/name-stream separators",
  })
  export const FileNotFoundError = NamedError.create(
    "LogFileNotFoundError",
    z.object({
      directory: z.string(),
      file: z.string(),
      path: z.string(),
      message: z.string(),
    }),
  )

  export type FileName = z.infer<typeof FileName>

  export type FileInfo = {
    name: string
    path: string
    size: number
    modified: string
    current: boolean
  }

  export type ReadResult = {
    directory: string
    path: string
    file: string
    lines: string[]
  }

  export function directory() {
    return Global.Path.log
  }

  export function file() {
    return logpath
  }

  export async function init(options: Options) {
    pendingInitializations++
    try {
      await using _lock = await Lock.write("log.lifecycle")
      const nextLevel = options.level ?? level
      const logDirectory = directory()
      await fs.mkdir(logDirectory, { recursive: true })
      await flushCurrent()
      await cleanup(logDirectory)
      const nextLogPath = path.join(logDirectory, options.dev ? "dev.log" : productionLogFileName(generation + 1))

      if (nextLogPath === logpath) await fs.appendFile(nextLogPath, "")
      else await fs.writeFile(nextLogPath, "")

      const nextFileDestination = pino.destination({ dest: nextLogPath, sync: false, mkdir: true })
      try {
        await destinationReady(nextFileDestination)
        const nextDestination = options.print
          ? pino.multistream([{ stream: nextFileDestination }, { stream: stderrDestination }])
          : nextFileDestination
        const nextRoot = createRootLogger(nextDestination, nextLevel)
        const previousDestination = durableDestination

        level = nextLevel
        logpath = nextLogPath
        durableDestination = nextFileDestination
        root = nextRoot
        generation++
        await closeDestination(previousDestination)
      } catch (error) {
        if (durableDestination !== nextFileDestination) nextFileDestination.destroy()
        throw error
      }
    } finally {
      pendingInitializations--
      if (pendingInitializations === 0) drainPendingRecords()
    }
  }

  async function destinationReady(destination: DurableDestination) {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        destination.off("ready", onReady)
        destination.off("error", onError)
      }
      const onReady = () => {
        cleanup()
        resolve()
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }
      destination.once("ready", onReady)
      destination.once("error", onError)
    })
  }

  async function closeDestination(destination: DurableDestination | undefined) {
    if (!destination) return
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        destination.off("finish", onFinish)
        destination.off("error", onError)
      }
      const onFinish = () => {
        cleanup()
        resolve()
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }
      destination.once("finish", onFinish)
      destination.once("error", onError)
      destination.end()
    })
  }

  const KEEP_RECENT = 10
  function productionLogFileName(nextGeneration: number) {
    const timestamp = new Date().toISOString().split(".")[0].replace(/:/g, "")
    return `${timestamp}-${process.pid}-${nextGeneration}.log`
  }

  function isMissingFile(error: unknown): boolean {
    return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "ENOENT")
  }

  async function cleanup(dir: string) {
    const files = await Glob.scan("*.log", {
      cwd: dir,
      absolute: true,
      include: "file",
    })
    const stats = await Promise.all(
      files
        .filter((file) => path.basename(file) !== "dev.log" && file !== logpath)
        .map(async (file) => {
          const stat = await fs.stat(file).catch((error) => {
            if (isMissingFile(error)) return undefined
            throw error
          })
          if (!stat) return undefined
          return { file, modified: stat.mtimeMs }
        }),
    )
    const candidates = stats.filter((entry): entry is { file: string; modified: number } => Boolean(entry))
    if (candidates.length <= KEEP_RECENT) return
    const filesToDelete = candidates
      .sort((left, right) => left.modified - right.modified || left.file.localeCompare(right.file))
      .slice(0, -KEEP_RECENT)
    await Promise.all(
      filesToDelete.map((entry) =>
        fs.unlink(entry.file).catch((error) => {
          if (isMissingFile(error)) return
          throw error
        }),
      ),
    )
  }

  export async function files(): Promise<FileInfo[]> {
    const dir = directory()
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return []
      throw error
    })
    const list = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && FileName.safeParse(entry.name).success)
        .map(async (entry) => {
          const pathname = path.join(dir, entry.name)
          const stat = await fs.stat(pathname)
          return {
            name: entry.name,
            path: pathname,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            current: pathname === logpath,
          } satisfies FileInfo
        }),
    )
    return list.sort((left, right) => right.modified.localeCompare(left.modified))
  }

  export async function read(input: { file?: FileName; lines: number }): Promise<ReadResult> {
    const dir = directory()
    const requestedFile = input.file ? FileName.parse(input.file) : undefined
    const pathname = requestedFile ? path.join(dir, requestedFile) : logpath
    if (!pathname) {
      throw new FileNotFoundError({
        directory: dir,
        file: requestedFile ?? "",
        path: "",
        message: requestedFile ? `Log file does not exist: ${requestedFile}` : "Current log file is not initialized",
      })
    }
    const lines = await readTailLines(pathname, input.lines).catch((error) => {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new FileNotFoundError({
          directory: dir,
          file: requestedFile ?? path.basename(pathname),
          path: pathname,
          message: `Log file does not exist: ${requestedFile ?? path.basename(pathname)}`,
        })
      }
      throw error
    })
    return {
      directory: dir,
      path: pathname,
      file: path.basename(pathname),
      lines,
    }
  }

  export async function flush() {
    await using _lock = await Lock.write("log.lifecycle")
    await flushCurrent()
  }

  export async function close() {
    await using _lock = await Lock.write("log.lifecycle")
    const previousDestination = durableDestination
    await flushCurrent()
    durableDestination = undefined
    logpath = ""
    root = createRootLogger(stderrDestination, level)
    generation++
    await closeDestination(previousDestination)
  }

  async function flushCurrent() {
    const currentRoot = root
    const currentDestination = durableDestination
    await new Promise<void>((resolve, reject) => {
      currentRoot.flush((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
    currentDestination?.flushSync()
  }

  const TAIL_READ_CHUNK_BYTES = 64 * 1024

  async function readTailLines(pathname: string, lines: number): Promise<string[]> {
    const stat = await fs.stat(pathname)
    if (stat.size === 0) return []
    const chunks: Buffer[] = []
    let position = stat.size
    let newlineCount = 0
    const handle = await fs.open(pathname, "r")
    try {
      while (position > 0 && newlineCount <= lines) {
        const length = Math.min(TAIL_READ_CHUNK_BYTES, position)
        position -= length
        const buffer = Buffer.allocUnsafe(length)
        const { bytesRead } = await handle.read(buffer, 0, length, position)
        if (bytesRead === 0) break
        const chunk = bytesRead === length ? buffer : buffer.subarray(0, bytesRead)
        chunks.unshift(chunk)
        for (let index = 0; index < chunk.length; index++) {
          if (chunk[index] === 10) newlineCount++
        }
      }
    } finally {
      await handle.close()
    }
    const split = Buffer.concat(chunks).toString("utf8").split("\n")
    if (position > 0) split.shift()
    return split.filter((line) => line.length > 0).slice(-lines)
  }

  function createRootLogger(destination: pino.DestinationStream, selectedLevel: Level) {
    return pino(
      {
        base: undefined,
        level: pinoLevel[selectedLevel],
        messageKey: "message",
        errorKey: "error",
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level(label) {
            return { level: label }
          },
        },
        serializers: {
          error: pino.stdSerializers.err,
          err: pino.stdSerializers.err,
        },
      },
      destination,
    )
  }

  function sanitizeRecord(input?: Record<string, any>): Record<string, any> {
    if (!input) return {}
    const output: Record<string, any> = {}
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null) continue
      const safeValue = ProviderError.safeProviderErrorDiagnostic(value)
      output[key] = typeof safeValue === "string" ? sanitizeMessage(safeValue) : safeValue
    }
    return output
  }

  function emit(
    logger: () => PinoLogger,
    tags: Record<string, any>,
    recordLevel: PinoLevel,
    message: any,
    extra?: Record<string, any>,
  ) {
    if (pendingInitializations === 0 && !logger().isLevelEnabled(recordLevel)) return
    const attributes = {
      ...sanitizeRecord(extra),
      ...sanitizeRecord(SessionObservability.logTags()),
    }
    const safeMessage = message === undefined || message === null ? undefined : sanitizeMessage(message)
    if (pendingInitializations > 0) {
      pendingRecords.push({ tags: { ...tags }, level: recordLevel, message: safeMessage, attributes })
      return
    }
    logger()[recordLevel](attributes, safeMessage)
  }

  function drainPendingRecords() {
    for (const record of pendingRecords.splice(0)) {
      root.child(record.tags)[record.level](record.attributes, record.message)
    }
  }

  export function create(tags?: Record<string, any>) {
    const ownTags = sanitizeRecord(tags)
    let cachedGeneration = -1
    let cachedLogger: PinoLogger | undefined

    function logger() {
      if (!cachedLogger || cachedGeneration !== generation) {
        cachedLogger = root.child(ownTags)
        cachedGeneration = generation
      }
      return cachedLogger
    }

    const result: Logger = {
      enabled(selectedLevel: Level) {
        return pendingInitializations > 0 || logger().isLevelEnabled(pinoLevel[selectedLevel])
      },
      debug(message?: any, extra?: Record<string, any>) {
        emit(logger, ownTags, "debug", message, extra)
      },
      info(message?: any, extra?: Record<string, any>) {
        emit(logger, ownTags, "info", message, extra)
      },
      error(message?: any, extra?: Record<string, any>) {
        emit(logger, ownTags, "error", message, extra)
      },
      warn(message?: any, extra?: Record<string, any>) {
        emit(logger, ownTags, "warn", message, extra)
      },
      tag(key: string, value: string) {
        return Log.create({ ...ownTags, [key]: value })
      },
      clone() {
        return Log.create({ ...ownTags })
      },
      time(message: string, extra?: Record<string, any>) {
        return timed("INFO", message, extra)
      },
      timeDebug(message: string, extra?: Record<string, any>) {
        return timed("DEBUG", message, extra)
      },
    }

    function timed(selectedLevel: Level, message: string, extra?: Record<string, any>) {
      const write = selectedLevel === "DEBUG" ? result.debug : result.info
      if (!result.enabled(selectedLevel)) {
        return {
          stop() {},
          [Symbol.dispose]() {},
        }
      }
      const now = Date.now()
      write(message, { status: "started", ...extra })
      let stopped = false
      function stop() {
        if (stopped) return
        stopped = true
        write(message, {
          status: "completed",
          duration: Date.now() - now,
          ...extra,
        })
      }
      return {
        stop,
        [Symbol.dispose]() {
          stop()
        },
      }
    }

    return result
  }
}
