import type { Ownership } from "@/engine/ownership"
import { ProjectDirectoryAdmission } from "@/project/directory-admission"

type DirectoryOwnership = {
  acquisitions: Set<symbol>
  removing: boolean
}

const ownershipByDirectory = new Map<string, DirectoryOwnership>()

function state(directory: string): { key: string; ownership: DirectoryOwnership } {
  // Share the durable Project-directory identity: aliases resolve through the
  // nearest existing parent before publication, so absent -> present does not
  // change the key later supplied by physical removal authority.
  const key = ProjectDirectoryAdmission.keySync(directory)
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
  type AcquisitionState = {
    key: string
    ownership: DirectoryOwnership
    token: symbol
    active: boolean
  }
  export interface Acquisition extends Disposable {}
  const acquisitionState = new WeakMap<Acquisition, AcquisitionState>()

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
  export function acquire(directory: string): Acquisition {
    const { key, ownership } = state(directory)
    if (ownership.removing) throw new ConflictError(key)
    const token = Symbol(key)
    ownership.acquisitions.add(token)
    const acquisition: Acquisition = {
      [Symbol.dispose]() {
        const current = acquisitionState.get(acquisition)
        if (!current?.active) return
        current.active = false
        current.ownership.acquisitions.delete(current.token)
        discardEmpty(current.key, current.ownership)
      },
    }
    acquisitionState.set(acquisition, { key, ownership, token, active: true })
    return acquisition
  }

  /** Own the complete proof-and-removal interval for one physical directory.
   *  A creator may atomically convert its sole exact acquisition into removal
   *  ownership while converging a failed or stale population. Other active
   *  acquisitions still win and keep the public removal contract fail-closed. */
  export async function remove<T>(input: {
    directory: string
    acquisition?: Acquisition
    proveOwnerless(): Promise<Proof> | Proof
    remove(proof: Extract<Proof, { status: "ownerless" }>): Promise<T>
  }): Promise<{ status: "removed"; value: T } | { status: "owned" }> {
    const { key, ownership } = state(input.directory)
    let converted: AcquisitionState | undefined
    if (ownership.removing) return { status: "owned" }
    if (input.acquisition) {
      const current = acquisitionState.get(input.acquisition)
      if (
        !current || !current.active || current.key !== key || current.ownership !== ownership ||
        !ownership.acquisitions.has(current.token)
      ) {
        throw new Error(`Invalid worktree acquisition for removal: ${key}`)
      }
      if (ownership.acquisitions.size !== 1) return { status: "owned" }
      ownership.acquisitions.delete(current.token)
      current.active = false
      converted = current
    } else if (ownership.acquisitions.size > 0) {
      return { status: "owned" }
    }
    ownership.removing = true
    try {
      const proof = await input.proveOwnerless()
      if (proof.status === "owned") return { status: "owned" }
      if (proof[ownerlessProof] !== true) throw new Error(`Invalid ownerless proof for ${key}`)
      return { status: "removed", value: await input.remove(proof) }
    } finally {
      ownership.removing = false
      if (converted) {
        ownership.acquisitions.add(converted.token)
        converted.active = true
      }
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
