import { Filesystem } from "@/util/filesystem"

type DirectoryOwnership = {
  acquisitions: Set<symbol>
  removing: boolean
}

const ownershipByDirectory = new Map<string, DirectoryOwnership>()

function state(directory: string): { key: string; ownership: DirectoryOwnership } {
  const key = Filesystem.resolve(directory)
  let ownership = ownershipByDirectory.get(key)
  if (!ownership) {
    ownership = { acquisitions: new Set(), removing: false }
    ownershipByDirectory.set(key, ownership)
  }
  return { key, ownership }
}

function discardEmpty(key: string, ownership: DirectoryOwnership): void {
  if (!ownership.removing && ownership.acquisitions.size === 0 && ownershipByDirectory.get(key) === ownership) {
    ownershipByDirectory.delete(key)
  }
}

export namespace WorktreeOwnershipCriticalSection {
  export class ConflictError extends Error {
    constructor(public readonly directory: string) {
      super(`Worktree ownership is changing: ${directory}`)
      this.name = "WorktreeOwnershipConflictError"
    }
  }

  /** Reserve an exact physical directory while its durable owner is acquired
   *  or while a prompt actively uses it. Acquisition is synchronous so it
   *  cannot race the first await in a removal operation. */
  export function acquire(directory: string): Disposable {
    const { key, ownership } = state(directory)
    if (ownership.removing) throw new ConflictError(key)
    const token = Symbol(key)
    ownership.acquisitions.add(token)
    return {
      [Symbol.dispose]() {
        ownership.acquisitions.delete(token)
        discardEmpty(key, ownership)
      },
    }
  }

  /** Own the complete proof-and-removal interval for one physical directory. */
  export async function remove<T>(input: {
    directory: string
    proveOwnerless(): Promise<boolean> | boolean
    remove(): Promise<T>
  }): Promise<{ status: "removed"; value: T } | { status: "owned" }> {
    const { key, ownership } = state(input.directory)
    if (ownership.removing) throw new ConflictError(key)
    if (ownership.acquisitions.size > 0) return { status: "owned" }
    ownership.removing = true
    try {
      if (!(await input.proveOwnerless())) return { status: "owned" }
      return { status: "removed", value: await input.remove() }
    } finally {
      ownership.removing = false
      discardEmpty(key, ownership)
    }
  }
}
