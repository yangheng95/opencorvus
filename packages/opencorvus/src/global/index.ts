import fs from "fs/promises"
import path from "path"
import os from "os"
import { resolveOpenCorvusRuntimePaths } from "@opencorvus-ai/util/runtime-paths"
import {
  createManagedTemporaryDirectory,
  initializeOpenCorvusRuntimeDirectories,
} from "@opencorvus-ai/util/runtime-directories"
import { Filesystem } from "../util/filesystem"
import { Context } from "../util/context"

function resolveHome() {
  if (process.env.OPENCORVUS_TEST_HOME) return process.env.OPENCORVUS_TEST_HOME
  try {
    const home = os.homedir()
    if (home) return home
  } catch {}
  const home = process.env.HOME || process.env.USERPROFILE
  if (home) return home
  throw new Error("OpenCorvus cannot resolve an absolute user home directory")
}

// All Global.Path entries resolve OPENCORVUS_HOME lazily on each access so
// isolated runtimes can bind one root after static module loading.
const runtimeRootContext = Context.create<string>("runtime-root")

function scopedRuntimeRoot() {
  return runtimeRootContext.tryUse()
}

function runtimePaths() {
  return resolveOpenCorvusRuntimePaths({
    env: process.env,
    platform: process.platform,
    home: resolveHome(),
    root: scopedRuntimeRoot(),
  })
}

export namespace Global {
  export function provideRoot<R>(root: string, fn: () => R): R {
    return runtimeRootContext.provide(root, fn)
  }

  export async function createTemporaryDirectory(prefix: string) {
    return createManagedTemporaryDirectory(Path.temporary, prefix)
  }

  export const Path = {
    get home() {
      return resolveHome()
    },
    get root() {
      return runtimePaths().root
    },
    get data() {
      return runtimePaths().data
    },
    get bin() {
      return runtimePaths().bin
    },
    get log() {
      return runtimePaths().log
    },
    get cache() {
      return runtimePaths().cache
    },
    get config() {
      return runtimePaths().config
    },
    get state() {
      return runtimePaths().state
    },
    get temporary() {
      return runtimePaths().temporary
    },
    get overlay() {
      return runtimePaths().overlay
    },
    get overlayEmbedded() {
      return runtimePaths().overlayEmbedded
    },
    get overlayWebview() {
      return runtimePaths().overlayWebview
    },
  }
}

await initializeOpenCorvusRuntimeDirectories(runtimePaths())

const CACHE_VERSION = "21"

const version = await Filesystem.readText(path.join(Global.Path.cache, "version")).catch(() => "0")

if (version !== CACHE_VERSION) {
  const contents = await fs.readdir(Global.Path.cache).catch((err) => {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [] as string[]
    throw err
  })
  await Promise.all(
    contents.map((item) =>
      fs.rm(path.join(Global.Path.cache, item), {
        recursive: true,
        force: true,
      }),
    ),
  )
  await Filesystem.write(path.join(Global.Path.cache, "version"), CACHE_VERSION)
}
