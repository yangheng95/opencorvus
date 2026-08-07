import { Global } from "@/global"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Filesystem } from "@/util/filesystem"
import path from "node:path"
import z from "zod"

export namespace ExpertSquadPackageLocations {
  export const DIRECTORY = "expert-squads"
  export const InstallationScopeSchema = z.enum(["project", "global"])
  export type InstallationScope = z.infer<typeof InstallationScopeSchema>

  export interface Location {
    readonly kind: "global" | "project"
    readonly configRoot: string
    readonly packagesRoot: string
  }

  function location(kind: Location["kind"], configRoot: string): Location {
    const resolvedConfigRoot = Filesystem.resolve(configRoot)
    return {
      kind,
      configRoot: resolvedConfigRoot,
      packagesRoot: path.join(resolvedConfigRoot, DIRECTORY),
    }
  }

  export function global(): Location {
    return location("global", Global.Path.config)
  }

  export function project(projectDirectory: string): Location {
    return location("project", ProjectRuntimePaths.projectConfigRoot(Filesystem.resolve(projectDirectory)))
  }

  export function resolve(scope: InstallationScope, projectDirectory: string): Location {
    const resolvers: Record<InstallationScope, () => Location> = {
      project: () => project(projectDirectory),
      global: () => global(),
    }
    return resolvers[scope]()
  }

  export function discoverProjects(projectDirectories: readonly string[]): readonly Location[] {
    const locations = [global(), ...projectDirectories.map((directory) => project(directory))]
    const seen = new Set<string>()
    return locations.filter((candidate) => {
      const key = Filesystem.normalizePath(candidate.configRoot)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  export function discover(projectDirectory: string): readonly Location[] {
    return discoverProjects([projectDirectory])
  }
}
