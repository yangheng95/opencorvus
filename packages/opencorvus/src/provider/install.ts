import { Log } from "../util/log"
import { BunProc } from "../bun"

const log = Log.create({ service: "provider" })

export async function installProvider(npm: string, version: string): Promise<string> {
  return BunProc.install(npm, version)
}

export async function loadProviderModule(installedPath: string): Promise<any> {
  log.info("loading local provider", { pkg: installedPath })
  const mod = await import(installedPath)
  const fn = mod[Object.keys(mod).find((key) => key.startsWith("create"))!]
  return fn
}
