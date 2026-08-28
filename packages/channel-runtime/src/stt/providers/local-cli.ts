import { join } from "path"
import { readFileSync, rmSync } from "fs"
import { ProcessDeadlineExceededError } from "@opencorvus-ai/util/process"
import { NodeProcess } from "@opencorvus-ai/util/process-node"
import type { AudioBuffer, STTProvider, STTResult } from "../types"
import { createChannelTemporaryDirectory } from "../../runtime-paths"

export class LocalCLIProvider implements STTProvider {
  readonly name = "local-cli"
  private command?: string
  private timeoutMs: number

  constructor(opts: { command?: string; timeoutMs?: number }) {
    this.command = opts.command
    this.timeoutMs = opts.timeoutMs ?? 60_000
  }

  async isAvailable(): Promise<boolean> {
    if (!this.command) return false
    const bin = parseCommandTemplate(this.command)[0]
    try {
      const result = await runCommand(["which", bin], process.cwd(), 5_000)
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async transcribe(audio: AudioBuffer, options?: { language?: string; prompt?: string }): Promise<STTResult> {
    const start = performance.now()

    const outputDir = await createChannelTemporaryDirectory("stt-")
    const ext = audio.mime.split("/")[1]?.replace("mpeg", "mp3").replace("ogg", "ogg") ?? "ogg"
    const mediaPath = join(outputDir, `input.${ext}`)
    let primaryError: unknown
    let hasPrimaryError = false
    try {
      await Bun.write(mediaPath, audio.data)
      // The template is split into arguments FIRST, honouring quotes, and the
      // placeholders are substituted inside each argument. Substituting first
      // and splitting on whitespace afterwards tore any value containing a
      // space into several arguments — and the media path is a temporary
      // directory, which on Windows always contains one.
      // A placeholder with no value is dropped together with the flag it
      // belongs to. Substituting an empty string handed the CLI an empty
      // argument for a flag that requires a value — one silent malformation
      // traded for another — and leaving the literal token was no better.
      const language = options?.language?.trim()
      const templateArguments = parseCommandTemplate(this.command!)
      const parts: string[] = []
      for (let index = 0; index < templateArguments.length; index += 1) {
        const argument = templateArguments[index]!
        if (!language && argument.includes("{{Language}}")) {
          // Drop the preceding flag this value belongs to, if there is one.
          if (parts.length > 0 && parts[parts.length - 1]!.startsWith("-")) parts.pop()
          continue
        }
        parts.push(
          argument
            .replaceAll("{{MediaPath}}", mediaPath)
            .replaceAll("{{OutputDir}}", outputDir)
            .replaceAll("{{Language}}", language ?? ""),
        )
      }
      const result = await runCommand(parts, outputDir, this.timeoutMs).catch((error) => {
        if (error instanceof ProcessDeadlineExceededError) {
          throw new Error(`CLI timed out after ${this.timeoutMs}ms without completing`, { cause: error })
        }
        throw error
      })
      if (result.exitCode !== 0) {
        throw new Error(`CLI exited with code ${result.exitCode}: ${result.stderr.slice(0, 200)}`)
      }

      const txtPath = join(outputDir, "input.txt")
      const text = readFileSync(txtPath, "utf-8").trim()

      return {
        text,
        provider: this.name,
        durationMs: Math.round(performance.now() - start),
      }
    } catch (error) {
      primaryError = error
      hasPrimaryError = true
      throw error
    } finally {
      try {
        rmSync(outputDir, { recursive: true, force: true })
      } catch (cleanupError) {
        if (hasPrimaryError) {
          throw new AggregateError(
            [primaryError, cleanupError],
            "CLI transcription and temporary-directory cleanup failed",
          )
        }
        throw cleanupError
      }
    }
  }
}

type CommandResult = {
  exitCode: number | null
  stderr: string
}

/**
 * Split one configured command line into executable and arguments.
 *
 * A configured command is a command LINE, so a quoted segment is one argument
 * no matter how much whitespace it contains, and a backslash escapes the next
 * character outside single quotes. This is the argv a process facade needs;
 * whitespace splitting is not a parser.
 */
export function parseCommandTemplate(commandLine: string): string[] {
  const argv: string[] = []
  let current = ""
  let started = false
  let quote: '"' | "'" | undefined
  for (let index = 0; index < commandLine.length; index += 1) {
    const character = commandLine[index]!
    if (quote === undefined && /\s/.test(character)) {
      if (started) {
        argv.push(current)
        current = ""
        started = false
      }
      continue
    }
    if (quote === undefined && (character === '"' || character === "'")) {
      quote = character
      started = true
      continue
    }
    if (quote !== undefined && character === quote) {
      quote = undefined
      continue
    }
    const next = commandLine[index + 1]
    if (character === "\\" && quote !== "'" && (next === '"' || next === "'")) {
      // A backslash is special ONLY immediately before a quote. Consuming a
      // doubled backslash as an escape ate the leading separator out of every
      // UNC path (\\\\server\\share), which is a Windows path exactly as much as
      // a drive path is.
      current += next
      started = true
      index += 1
      continue
    }
    current += character
    started = true
  }
  if (quote !== undefined) {
    throw new Error(`Configured command has an unterminated ${quote} quote: ${commandLine}`)
  }
  if (started) argv.push(current)
  return argv
}

async function runCommand(command: string[], cwd: string, timeoutMs: number): Promise<CommandResult> {
  if (command.length === 0) throw new Error("local CLI command is empty")
  const result = await NodeProcess.run({
    command: { executable: command[0]!, args: command.slice(1) },
    cwd,
    ownership: "owned_tree",
    timeoutMs,
    nothrow: true,
  })
  return {
    exitCode: result.receipt.exitCode,
    stderr: new TextDecoder().decode(result.stderr),
  }
}
