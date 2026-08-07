import os from "node:os"
import { resolveOpenCorvusRuntimePaths } from "@opencorvus-ai/util/runtime-paths"
import { createManagedTemporaryDirectory } from "@opencorvus-ai/util/runtime-directories"

function userHome() {
  const home = os.homedir() || process.env.HOME || process.env.USERPROFILE
  if (!home) throw new Error("OpenCorvus channel runtime cannot resolve an absolute user home directory")
  return home
}

export function channelRuntimePaths() {
  return resolveOpenCorvusRuntimePaths({
    env: process.env,
    platform: process.platform,
    home: userHome(),
  })
}

export async function createChannelTemporaryDirectory(prefix: string) {
  return createManagedTemporaryDirectory(channelRuntimePaths().temporary, prefix)
}
