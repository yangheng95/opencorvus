import { Database } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import { Instance, runOutsideInstanceContext } from "./instance"

/**
 * Run asynchronous project work under a fresh project lease without
 * inheriting the caller's request, transaction, or post-commit ownership.
 * The caller is responsible for completing project initialization first;
 * this establishes execution identity and lifetime, not another startup.
 */
export async function runWithIndependentProjectIdentity<R>(input: {
  directory: string
  fn: () => R
}): Promise<Awaited<R>> {
  return await Database.runOutsideContext(() =>
    runOutsideInstanceContext(() => Instance.provideProjectIdentity(input)),
  )
}

export async function provideInitializedProjectExecution<R>(input: {
  directory: string
  signal?: AbortSignal
  fn: () => R
}): Promise<Awaited<R>> {
  const { InstanceBootstrap } = await import("./bootstrap")
  input.signal?.throwIfAborted()
  return await Instance.provide({
    directory: Filesystem.resolve(input.directory),
    fn: async () => {
      input.signal?.throwIfAborted()
      const result = await input.fn()
      input.signal?.throwIfAborted()
      return result
    },
    init: InstanceBootstrap,
  })
}

/**
 * Run an executable project lifecycle under a fresh, fully initialized lease.
 * Session loops and queue recovery use this owner because a process restart
 * leaves the Instance cache empty even though their durable database rows
 * remain runnable. Identity-only owners stay reserved for persistence,
 * publication, and cleanup paths that do not execute project capabilities.
 */
export async function runWithInitializedIndependentProject<R>(input: {
  directory: string
  signal?: AbortSignal
  fn: () => R
}): Promise<Awaited<R>> {
  const directory = Filesystem.resolve(input.directory)
  return await Database.runOutsideContext(() =>
    runOutsideInstanceContext(() =>
      provideInitializedProjectExecution({ directory, signal: input.signal, fn: input.fn }),
    ),
  )
}
