// Native child surfaces such as the Browser preview are operating-system-level
// windows and therefore sit above host Hypertext Markup Language (HTML). This
// service is the single owner-aware lifecycle for occluding them behind HTML
// Settings and dialog surfaces.

export type NativeSurfaceOcclusionHooks = {
  hide: () => Promise<void>
  restore: () => Promise<void>
}

const surfaceHooks = new Set<NativeSurfaceOcclusionHooks>()
const hiddenSurfaces = new Set<NativeSurfaceOcclusionHooks>()
const activeOwners = new Set<string>()
let surfaceFailure: { error: unknown; hooks: Set<NativeSurfaceOcclusionHooks> } | undefined
let transitionTail = Promise.resolve()

function requireOwner(owner: string): string {
  const value = owner.trim()
  if (!value) throw new Error("Native surface occlusion owner is required")
  return value
}

function runTransition<T>(operation: () => Promise<T>): Promise<T> {
  const previous = transitionTail
  let release: () => void = () => undefined
  transitionTail = new Promise<void>((resolve) => {
    release = resolve
  })
  return previous.then(operation).finally(release)
}

async function hideRegisteredSurfaces(): Promise<void> {
  if (surfaceFailure !== undefined) throw surfaceFailure.error
  const hiddenDuringTransition: NativeSurfaceOcclusionHooks[] = []
  try {
    for (const hooks of surfaceHooks) {
      if (hiddenSurfaces.has(hooks)) continue
      await hooks.hide()
      hiddenSurfaces.add(hooks)
      hiddenDuringTransition.push(hooks)
    }
  } catch (hideError) {
    const restoreErrors: Array<{ error: unknown; hooks: NativeSurfaceOcclusionHooks }> = []
    for (const hooks of hiddenDuringTransition.reverse()) {
      try {
        await hooks.restore()
        hiddenSurfaces.delete(hooks)
      } catch (restoreError) {
        restoreErrors.push({ error: restoreError, hooks })
      }
    }
    if (restoreErrors.length > 0) {
      const error = new AggregateError(
        [hideError, ...restoreErrors.map((item) => item.error)],
        "Native surface hide and rollback failed",
        { cause: hideError },
      )
      surfaceFailure = { error, hooks: new Set(restoreErrors.map((item) => item.hooks)) }
      throw error
    }
    throw hideError
  }
}

async function restoreRegisteredSurfaces(): Promise<void> {
  const restoreErrors: Array<{ error: unknown; hooks: NativeSurfaceOcclusionHooks }> = []
  for (const hooks of [...hiddenSurfaces].reverse()) {
    try {
      await hooks.restore()
      hiddenSurfaces.delete(hooks)
    } catch (error) {
      restoreErrors.push({ error, hooks })
    }
  }
  if (restoreErrors.length > 0) {
    const error =
      restoreErrors.length === 1
        ? restoreErrors[0].error
        : new AggregateError(
            restoreErrors.map((item) => item.error),
            "Native surface restore failed",
            { cause: restoreErrors[0].error },
          )
    surfaceFailure = { error, hooks: new Set(restoreErrors.map((item) => item.hooks)) }
    throw error
  }
  surfaceFailure = undefined
}

export function registerNativeSurfaceOcclusionHooks(hooks: NativeSurfaceOcclusionHooks): () => void {
  surfaceHooks.add(hooks)
  if (activeOwners.size > 0) {
    void runTransition(async () => {
      if (activeOwners.size === 0 || hiddenSurfaces.has(hooks)) return
      try {
        await hooks.hide()
        hiddenSurfaces.add(hooks)
      } catch (error) {
        surfaceFailure = { error, hooks: new Set([hooks]) }
        throw error
      }
    }).catch(() => undefined)
  }
  return () => {
    surfaceHooks.delete(hooks)
    hiddenSurfaces.delete(hooks)
    surfaceFailure?.hooks.delete(hooks)
    if (surfaceFailure?.hooks.size === 0) surfaceFailure = undefined
  }
}

export function occludeNativeSurfaces(owner: string): Promise<void> {
  const identity = requireOwner(owner)
  return runTransition(async () => {
    if (surfaceFailure !== undefined) throw surfaceFailure.error
    if (activeOwners.has(identity)) return
    const firstOwner = activeOwners.size === 0
    activeOwners.add(identity)
    if (!firstOwner) return
    try {
      await hideRegisteredSurfaces()
    } catch (error) {
      activeOwners.delete(identity)
      throw error
    }
  })
}

export function revealNativeSurfaces(owner: string): Promise<void> {
  const identity = requireOwner(owner)
  return runTransition(async () => {
    if (!activeOwners.has(identity)) return
    activeOwners.delete(identity)
    if (activeOwners.size > 0) return
    try {
      await restoreRegisteredSurfaces()
    } catch (error) {
      throw error
    }
  })
}
