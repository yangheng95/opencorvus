import { BusEvent } from "@/bus/bus-event"
import path from "path"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { NodeProcess } from "@opencorvus-ai/util/process-node"
import { valid as validSemver } from "semver"
import { Log } from "../util/log"
import { Flag } from "../flag/flag"

declare global {
  const OPENCORVUS_VERSION: string
  const OPENCORVUS_CHANNEL: string
}

export namespace Installation {
  const log = Log.create({ service: "installation" })

  export type Method = "native" | "unknown"

  export const Event = {
    Updated: BusEvent.define(
      "installation.updated",
      z.object({
        version: z.string(),
      }),
    ),
    UpdateAvailable: BusEvent.define(
      "installation.update-available",
      z.object({
        version: z.string(),
      }),
    ),
  }

  export const Info = z
    .object({
      version: z.string(),
      latest: z.string(),
    })
    .meta({
      ref: "InstallationInfo",
    })
  export type Info = z.infer<typeof Info>

  export async function info() {
    return {
      version: VERSION,
      latest: await latest(),
    }
  }

  export function isPreview() {
    return CHANNEL !== "latest"
  }

  export function isLocal() {
    return CHANNEL === "local"
  }

  export function methodForExecutable(execPath: string): Method {
    return execPath.includes(path.join(".opencorvus", "bin")) ? "native" : "unknown"
  }

  export async function method(): Promise<Method> {
    const detected = methodForExecutable(process.execPath)
    return detected
  }

  export const UpgradeFailedError = NamedError.create(
    "UpgradeFailedError",
    z.object({
      stage: z.enum(["installer", "executable_probe", "version_mismatch"]),
      message: z.string(),
      target: z.string(),
      executable: z.string().optional(),
      exitCode: z.number().nullable(),
      stdout: z.string(),
      stderr: z.string(),
      observedVersion: z.string().optional(),
    }),
  )

  export interface UpgradeReceipt {
    method: "native"
    requestedVersion: string
    observedVersion: string
    executable: string
  }

  interface UpgradeCommandObservation {
    exitCode: number
    stdout: string
    stderr: string
  }

  type UpgradeCommandRunner = (input: {
    stage: "installer_download" | "installer" | "executable_probe"
    target: string
    executable: string
    stdin?: string
  }) => Promise<UpgradeCommandObservation>

  export function normalizeUpgradeVersion(value: string): string | undefined {
    const normalized = value.trim().replace(/^v/, "")
    return validSemver(normalized) ?? undefined
  }

  async function productionUpgradeCommand(input: {
    stage: "installer_download" | "installer" | "executable_probe"
    target: string
    executable: string
    stdin?: string
  }): Promise<UpgradeCommandObservation> {
    if (input.stage === "installer_download") {
      const result = await NodeProcess.run({
        command: { executable: "curl", args: ["-fsSL", "https://opencorvus.ai/install"] },
        nothrow: true,
      })
      return {
        exitCode: result.receipt.exitCode ?? 1,
        stdout: new TextDecoder().decode(result.stdout),
        stderr: new TextDecoder().decode(result.stderr),
      }
    }
    if (input.stage === "installer") {
      if (input.stdin === undefined) throw new Error("Native installer script is missing")
      const result = await NodeProcess.run({
        command: { executable: "bash", args: [] },
        env: { ...globalThis.process.env, VERSION: input.target },
        input: (async function* () {
          yield new TextEncoder().encode(input.stdin!)
        })(),
        nothrow: true,
      })
      return {
        exitCode: result.receipt.exitCode ?? 1,
        stdout: new TextDecoder().decode(result.stdout),
        stderr: new TextDecoder().decode(result.stderr),
      }
    }
    const result = await NodeProcess.run({
      command: { executable: input.executable, args: ["--version"] },
      nothrow: true,
    })
    return {
      exitCode: result.receipt.exitCode ?? 1,
      stdout: new TextDecoder().decode(result.stdout),
      stderr: new TextDecoder().decode(result.stderr),
    }
  }

  function upgradeFailure(input: {
    stage: "installer" | "executable_probe" | "version_mismatch"
    message: string
    target: string
    executable?: string
    observation?: UpgradeCommandObservation
    observedVersion?: string
  }) {
    return new UpgradeFailedError({
      stage: input.stage,
      message: input.message,
      target: input.target,
      ...(input.executable ? { executable: input.executable } : {}),
      exitCode: input.observation?.exitCode ?? null,
      stdout: input.observation?.stdout ?? "",
      stderr: input.observation?.stderr ?? "",
      ...(input.observedVersion ? { observedVersion: input.observedVersion } : {}),
    })
  }

  async function observeUpgradeCommand(
    runner: UpgradeCommandRunner,
    input: Parameters<UpgradeCommandRunner>[0],
  ): Promise<UpgradeCommandObservation> {
    try {
      return await runner(input)
    } catch (error) {
      throw upgradeFailure({
        stage: input.stage === "executable_probe" ? "executable_probe" : "installer",
        message: `${input.stage === "installer_download" ? "Native installer download" : input.stage === "installer" ? "Native installer" : "Installed executable version probe"} could not start: ${error instanceof Error ? error.message : String(error)}`,
        target: input.target,
        ...(input.stage === "executable_probe" ? { executable: input.executable } : {}),
      })
    }
  }

  async function upgradeWithRunner(
    method: Method,
    target: string,
    runner: UpgradeCommandRunner,
  ): Promise<UpgradeReceipt> {
    if (method !== "native")
      throw new Error(`OpenCorvus is not running from a native installation: ${process.execPath}`)
    const requestedVersion = normalizeUpgradeVersion(target)
    if (!requestedVersion) {
      throw upgradeFailure({
        stage: "version_mismatch",
        message: `Invalid requested OpenCorvus version: ${target}`,
        target,
      })
    }
    const executable = process.execPath
    const installerDownload = await observeUpgradeCommand(runner, {
      stage: "installer_download",
      target: requestedVersion,
      executable,
    })
    if (installerDownload.exitCode !== 0) {
      throw upgradeFailure({
        stage: "installer",
        message: `Native installer download exited with code ${installerDownload.exitCode}`,
        target: requestedVersion,
        observation: installerDownload,
      })
    }
    const installer = await observeUpgradeCommand(runner, {
      stage: "installer",
      target: requestedVersion,
      executable,
      stdin: installerDownload.stdout,
    })
    if (installer.exitCode !== 0) {
      throw upgradeFailure({
        stage: "installer",
        message: `Native installer exited with code ${installer.exitCode}`,
        target: requestedVersion,
        observation: installer,
      })
    }
    const probe = await observeUpgradeCommand(runner, {
      stage: "executable_probe",
      target: requestedVersion,
      executable,
    })
    if (probe.exitCode !== 0) {
      throw upgradeFailure({
        stage: "executable_probe",
        message: `Installed executable version probe exited with code ${probe.exitCode}`,
        target: requestedVersion,
        executable,
        observation: probe,
      })
    }
    const observedVersion = normalizeUpgradeVersion(probe.stdout)
    if (!observedVersion) {
      throw upgradeFailure({
        stage: "executable_probe",
        message: "Installed executable returned an invalid version",
        target: requestedVersion,
        executable,
        observation: probe,
      })
    }
    if (observedVersion !== requestedVersion) {
      throw upgradeFailure({
        stage: "version_mismatch",
        message: `Installed executable reports ${observedVersion}, expected ${requestedVersion}`,
        target: requestedVersion,
        executable,
        observation: probe,
        observedVersion,
      })
    }
    log.info("upgraded", {
      method,
      requestedVersion,
      observedVersion,
      executable,
      stdout: installer.stdout,
      stderr: installer.stderr,
    })
    return { method, requestedVersion, observedVersion, executable }
  }

  export async function upgrade(method: Method, target: string): Promise<UpgradeReceipt> {
    return upgradeWithRunner(method, target, productionUpgradeCommand)
  }

  export async function upgradeWithRunnerForTest(
    method: Method,
    target: string,
    runner: UpgradeCommandRunner,
  ): Promise<UpgradeReceipt> {
    return upgradeWithRunner(method, target, runner)
  }

  export const VERSION =
    process.env.OPENCORVUS_VERSION?.trim() || (typeof OPENCORVUS_VERSION === "string" ? OPENCORVUS_VERSION : "local")
  export const CHANNEL =
    process.env.OPENCORVUS_CHANNEL?.trim() || (typeof OPENCORVUS_CHANNEL === "string" ? OPENCORVUS_CHANNEL : "local")
  export const USER_AGENT = `opencorvus/${CHANNEL}/${VERSION}/${Flag.OPENCORVUS_CLIENT}`

  export async function latest() {
    return fetch("https://api.github.com/repos/yangheng95/opencorvus/releases/latest")
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((data: any) => data.tag_name.replace(/^v/, ""))
  }
}
