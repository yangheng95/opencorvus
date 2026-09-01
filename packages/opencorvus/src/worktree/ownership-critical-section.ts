import { Filesystem } from "@/util/filesystem"
import type { Ownership } from "@/engine/ownership"

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
  const ownerlessProof = Symbol("worktree-ownerless-proof")

  export type Proof =
    | { status: "owned" }
    | {
        status: "ownerless"
        [ownerlessProof]: true
        evidence: Extract<Ownership.Worktree.OwnerProof, { status: "ownerless" }>
      }

  export function owned(): Proof {
    return { status: "owned" }
  }

  export function ownerless(evidence: Extract<Ownership.Worktree.OwnerProof, { status: "ownerless" }>): Proof {
    return { status: "ownerless", [ownerlessProof]: true, evidence }
  }

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
    proveOwnerless(): Promise<Proof> | Proof
    remove(proof: Extract<Proof, { status: "ownerless" }>): Promise<T>
  }): Promise<{ status: "removed"; value: T } | { status: "owned" }> {
    const { key, ownership } = state(input.directory)
    if (ownership.removing) return { status: "owned" }
    if (ownership.acquisitions.size > 0) return { status: "owned" }
    ownership.removing = true
    try {
      const proof = await input.proveOwnerless()
      if (proof.status === "owned") return { status: "owned" }
      if (proof[ownerlessProof] !== true) throw new Error(`Invalid ownerless proof for ${key}`)
      return { status: "removed", value: await input.remove(proof) }
    } finally {
      ownership.removing = false
      discardEmpty(key, ownership)
    }
  }

  /** Own a non-removal directory rewrite such as reset across every active
   * process-local use. Durable cross-process exclusion is supplied by the
   * caller's ProjectDirectoryAdmission generation. */
  export async function mutate<T>(input: {
    directory: string
    mutate(): Promise<T>
  }): Promise<{ status: "mutated"; value: T } | { status: "owned" }> {
    const { key, ownership } = state(input.directory)
    if (ownership.removing) return { status: "owned" }
    if (ownership.acquisitions.size > 0) return { status: "owned" }
    ownership.removing = true
    try {
      return { status: "mutated", value: await input.mutate() }
    } finally {
      ownership.removing = false
      discardEmpty(key, ownership)
    }
  }
}
