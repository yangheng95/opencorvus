import type { Project } from "./project"
import { Context } from "../util/context"
import { Filesystem } from "@/util/filesystem"

export type InstanceInit = () => Promise<unknown>

export interface InstanceContext {
  directory: string
  worktree: string
  project: Project.Info
  git: boolean
}

export interface InstanceContextAuthority {
  assertActive(): void
}

interface InstanceContextScope {
  value: InstanceContext
  authority: InstanceContextAuthority
}

const storage = Context.create<InstanceContextScope>("instance")

export const ProjectInstanceContext = {
  use(): InstanceContext {
    const scope = storage.use()
    scope.authority.assertActive()
    return scope.value
  },
  tryUse(): InstanceContext | undefined {
    const scope = storage.tryUse()
    if (!scope) return undefined
    scope.authority.assertActive()
    return scope.value
  },
}

export function provideProjectInstanceContext<R>(
  value: InstanceContext,
  authority: InstanceContextAuthority,
  fn: () => R,
): R {
  return storage.provide({ value, authority }, fn)
}

export function withoutProjectInstanceContext<R>(fn: () => R): R {
  return storage.without(fn)
}

export function currentProjectDirectory(): string {
  return Filesystem.resolve(ProjectInstanceContext.use().directory)
}
