import { BusEvent } from "@/bus/bus-event"
import path from "path"
import { $ } from "bun"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
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
      stderr: z.string(),
    }),
  )

  export async function upgrade(method: Method, target: string) {
    if (method !== "native")
      throw new Error(`OpenCorvus is not running from a native installation: ${process.execPath}`)
    const cmd = $`curl -fsSL https://opencorvus.ai/install | bash`.env({
      ...process.env,
      VERSION: target,
    })
    const result = await cmd.quiet().throws(false)
    if (result.exitCode !== 0) {
      throw new UpgradeFailedError({
        stderr: result.stderr.toString("utf8"),
      })
    }
    log.info("upgraded", {
      method,
      target,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    })
    await $`${process.execPath} --version`.nothrow().quiet().text()
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
