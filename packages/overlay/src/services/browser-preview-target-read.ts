import { createEffect, createMemo, createResource, onCleanup, type Accessor } from "solid-js"
import type { ApiAuthority } from "./api"
import { browserPreviewRevision, loadTaskBrowserPreviewTarget, type BrowserPreviewTarget } from "./browser-preview"

export type ScopedBrowserPreviewTarget = BrowserPreviewTarget & { directory: string; authority: ApiAuthority }

interface TaskPreviewScope {
  taskID: string
  directory: string
  authority: ApiAuthority
  selectionEpoch: number
}

type TaskPreviewResult = { scope: TaskPreviewScope } & (
  | { kind: "accepted"; target: ScopedBrowserPreviewTarget }
  | { kind: "failed"; cause: unknown }
)

export function createTaskBrowserPreviewRead(selection: Accessor<TaskPreviewScope | undefined>) {
  const scope = createMemo(selection, undefined, {
    equals: (a, b) => a === b || !!a && !!b &&
      a.taskID === b.taskID && a.directory === b.directory &&
      a.authority.revision === b.authority.revision && a.selectionEpoch === b.selectionEpoch,
  })
  const source = createMemo(() => {
    const owner = scope()
    return owner && { owner, revision: browserPreviewRevision() }
  })
  let activeRequest: AbortController | undefined
  const [result, { refetch }] = createResource(source, async ({ owner }): Promise<TaskPreviewResult> => {
    activeRequest?.abort()
    const controller = new AbortController()
    activeRequest = controller
    try {
      const target = await loadTaskBrowserPreviewTarget({ ...owner, signal: controller.signal })
      if (target.taskID !== owner.taskID) throw new Error("Browser preview target belongs to a different task.")
      return { scope: owner, kind: "accepted", target: { ...target, directory: owner.directory, authority: owner.authority } }
    } catch (cause) {
      return { scope: owner, kind: "failed", cause }
    } finally {
      if (activeRequest === controller) activeRequest = undefined
    }
  })
  createEffect(() => {
    if (!scope()) activeRequest?.abort()
  })
  onCleanup(() => activeRequest?.abort())

  const current = createMemo(() => {
    const owner = scope()
    const read = owner && result.latest
    return read && read.scope === owner ? read : undefined
  })
  const target = createMemo(() => {
    const read = current()
    return read?.kind === "accepted" ? read.target : undefined
  })
  const failure = createMemo(() => {
    const read = current()
    return read?.kind === "failed" ? read : undefined
  })
  const loading = () => !!scope() && result.loading

  async function retry(): Promise<boolean> {
    const owner = scope()
    if (!owner || !failure() || loading()) return false
    await refetch()
    return scope() === owner && !!target()
  }

  return { scope, target, failure, loading, retry }
}

export type TaskBrowserPreviewRead = ReturnType<typeof createTaskBrowserPreviewRead>
