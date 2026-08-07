import { Lock, withKeyedLock } from "@/util/lock"
import { Context } from "@/util/context"

const skillSourceLocks = new Map<string, Promise<unknown>>()
const SKILL_CATALOG_REFERENCE_LOCK = "skill-catalog-reference"
const skillCatalogMutationContext = Context.create<boolean>("skill-catalog-mutation")
const skillCatalogReadContext = Context.create<boolean>("skill-catalog-read")

export function withSkillSourceMutation<T>(source: string, run: () => Promise<T>): Promise<T> {
  return withKeyedLock(skillSourceLocks, source, run)
}

export function withSkillCatalogMutation<T>(run: () => Promise<T>): Promise<T> {
  if (skillCatalogMutationContext.tryUse()) return run()
  if (skillCatalogReadContext.tryUse()) {
    throw new Error("Cannot mutate the Skill catalog while holding a catalog reference read.")
  }
  return (async () => {
    using _lock = await Lock.write(SKILL_CATALOG_REFERENCE_LOCK)
    return skillCatalogMutationContext.provide(true, run)
  })()
}

export function withSkillCatalogReferenceRead<T>(run: () => Promise<T>): Promise<T> {
  if (skillCatalogMutationContext.tryUse() || skillCatalogReadContext.tryUse()) return run()
  return (async () => {
    using _lock = await Lock.read(SKILL_CATALOG_REFERENCE_LOCK)
    return skillCatalogReadContext.provide(true, run)
  })()
}

export function withSkillSourceMutations<T>(sources: readonly string[], run: () => Promise<T>): Promise<T> {
  const ordered = [...new Set(sources)].sort()
  const acquire = (index: number): Promise<T> => {
    const source = ordered[index]
    return source === undefined ? run() : withSkillSourceMutation(source, () => acquire(index + 1))
  }
  return acquire(0)
}
