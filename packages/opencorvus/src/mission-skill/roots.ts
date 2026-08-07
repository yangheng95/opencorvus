import path from "node:path"
import { mkdir } from "node:fs/promises"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"

export namespace MissionSkillRoots {
  export type Source = "global" | "project"

  export function global() {
    return path.join(Global.Path.config, "mission-skills")
  }

  export function project() {
    return path.join(Instance.directory, ".opencorvus", "mission-skills")
  }

  export function all() {
    const roots = [path.resolve(global()), path.resolve(project())] as const
    if (Filesystem.overlaps(roots[0], roots[1])) {
      throw new Error(
        `Canonical Mission Skill roots must not overlap: global=${JSON.stringify(roots[0])}, project=${JSON.stringify(roots[1])}`,
      )
    }
    return roots
  }

  export function source(location: string): Source {
    const target = path.resolve(location)
    const [globalRoot, projectRoot] = all()
    if (Filesystem.contains(globalRoot, target)) return "global"
    if (Filesystem.contains(projectRoot, target)) return "project"
    throw new Error(`Mission Skill location is outside canonical roots: ${location}`)
  }

  export async function ensure(source: Source) {
    const [globalRoot, projectRoot] = all()
    const target = source === "global" ? globalRoot : projectRoot
    await mkdir(target, { recursive: true })
    return target
  }

  export function owns(location: string) {
    const target = path.resolve(location)
    return all().some((root) => Filesystem.contains(root, target))
  }
}
