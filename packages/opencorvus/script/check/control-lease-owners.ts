#!/usr/bin/env bun
/**
 * Control leases are a repository-wide shared mechanism with one invariant:
 * **a lease ends with the receipt that settles it.**
 *
 * A lease that outlives its owner is not a local bug. It makes the target
 * unclaimable for the whole lease duration, so a receipt that says "retry in
 * two seconds" is silently deferred to the lease length, an interrupted
 * attempt cannot be recovered by the next process, and an immediately
 * following update or delete is refused by an owner that no longer exists.
 *
 * Four independent review rounds each found an owner the previous round had
 * missed, because nothing enumerated them. This is that enumeration. Every
 * file that takes a control lease — through the shared primitive or by writing
 * the lease table itself — is declared with how many places take one and what
 * ends them. A new acquire fails the check, a new acquire inside an already
 * declared file fails the check, and a declaration whose acquires are gone
 * fails too, so the list cannot rot into false confidence.
 */

import { Glob } from "bun"
import path from "node:path"

/**
 * Packages that can reach the lease table or the acquire primitive. The other
 * workspace packages (util, sdk, channel-config, transport-protocol, overlay,
 * web) have no dependency edge to either, so scanning them would only slow the
 * gate; a new edge shows up here as an undeclared owner the moment it acquires.
 */
const PACKAGE_ROOTS: Array<{ prefix: string; root: string }> = [
  { prefix: "", root: path.resolve(import.meta.dir, "../../src") },
  { prefix: "channel-runtime:", root: path.resolve(import.meta.dir, "../../../channel-runtime/src") },
  { prefix: "plugin:", root: path.resolve(import.meta.dir, "../../../plugin/src") },
]

type Declaration = {
  /** Lease target namespaces this file acquires. */
  targets: string[]
  /** How many places in this file take a lease. A new one must be declared. */
  sites: number
  /** What ends the leases this file takes, or why nothing does. */
  release: string
}

const DECLARED_OWNERS: Record<string, Declaration> = {
  "bus/index.ts": {
    targets: ["bus_delivery"],
    sites: 1,
    release:
      "dispatchDurableTargets releases with the succeeded receipt, with the failed/ignored receipt, and when it finds the delivery already terminal.",
  },
  "channel/ingress.ts": {
    targets: ["effect"],
    sites: 1,
    release:
      "The outcome receipt releases in its own transaction; a failing executeMessage hands ownership back through releaseControlLeaseOnErrorPath.",
  },
  "engine/build-observation-cleanup.ts": {
    targets: ["build_cleanup"],
    sites: 2,
    release:
      "settleBuildObservationCleanup releases with both the complete and the failed receipt. The terminal `retained` receipt releases in engine/persist.ts, fenced on the caller's own activation.",
  },
  "engine/process-liveness.ts": {
    targets: ["runtime_process"],
    sites: 1,
    release:
      "Deliberately none. This lease IS the liveness fact: a process is live exactly while its lease is unexpired, so releasing it would assert the process had exited. It ends by expiry, and expireProcessLivenessLease ends it explicitly on a recorded exit.",
  },
  "engine/task-completion-closure.ts": {
    targets: ["lifecycle"],
    sites: 1,
    release: "releaseTaskCompletionClosureInTransaction ends it with the closure fact.",
  },
  "engine/task-root-fact-store.ts": {
    targets: ["task_root_ingress"],
    sites: 1,
    release:
      "NOT RELEASED. This is a second implementation of acquire/renew/assert against the lease table that bypasses engine/control-lease.ts, and it carries its own consumed-activation predicate. Recorded as open architecture debt; converging it onto the shared primitive is the fix, not a release bolted on here.",
  },
  "mission/execution-closure.ts": {
    targets: ["lifecycle"],
    sites: 2,
    release:
      "The closure fact releases in its own transaction; a close that ends without one hands ownership back in finally.",
  },
  "permission/authority.ts": {
    targets: ["effect"],
    sites: 1,
    release:
      "completeExecution and appendEffectOutcome release with their terminal receipt; abandonEffectLease hands ownership back when a durable task stays open.",
  },
  "protocol/delivery.ts": {
    targets: ["protocol_delivery"],
    sites: 1,
    release:
      "rescheduleSchedulerDelivery releases with its retry receipt. The terminal settlement deliberately does not: projectProtocolDeliveryInTransaction lets terminal status win over the lease, and due selection filters terminal rows out.",
  },
  "scheduler/automation-service.ts": {
    targets: ["automation"],
    sites: 2,
    release:
      "The recurring, one-shot, activity and failure settlements each release with their receipts, inside the same transaction.",
  },
  "scheduler/event-service.ts": {
    targets: ["event_fire"],
    sites: 1,
    release:
      "settleSuccess, settleDisposition and scheduleRetry release with their receipts. deferFire deliberately rides the current owner's lease as the recovery schedule.",
  },
  "session/loop.ts": {
    targets: ["session_control"],
    sites: 1,
    release:
      "SessionControl.settle releases with the terminal event and when it finds the control already settled; a renewal failure hands ownership back.",
  },
  "task-api/index.ts": {
    targets: ["lifecycle"],
    sites: 1,
    release: "The convergence owner's close() ends its activation.",
  },
}

/**
 * A lease is taken either through the shared primitive or by writing the lease
 * table directly. Both shapes count: the second is how three owners stayed
 * invisible to the first version of this gate.
 */
const ACQUIRE_SHAPES = [
  /\bacquireControlLease(?:InTransaction)?\s*\(/g,
  /\.insert\(\s*EngineControlActivationLeaseTable\s*\)/g,
]

/** Importing the primitive under another name would hide the call shape. */
const ALIASED_IMPORT = /import\s*\{[^}]*\bacquireControlLease(?:InTransaction)?\s+as\s+(\w+)/g

const found = new Map<string, number>()
const aliased: string[] = []

for (const { prefix, root } of PACKAGE_ROOTS) {
  for await (const relative of new Glob("**/*.{ts,tsx,mts,cts}").scan({ cwd: root })) {
    const file = prefix + relative.replaceAll("\\", "/")
    // The primitive itself is where acquiring is defined, not an owner of a lease.
    if (file === "engine/control-lease.ts") continue
    const text = await Bun.file(path.join(root, relative)).text()
    if (ALIASED_IMPORT.test(text)) aliased.push(file)
    ALIASED_IMPORT.lastIndex = 0
    let count = 0
    for (const shape of ACQUIRE_SHAPES) {
      count += [...text.matchAll(shape)].length
      shape.lastIndex = 0
    }
    if (count > 0) found.set(file, (found.get(file) ?? 0) + count)
  }
}

const declared = new Set(Object.keys(DECLARED_OWNERS))
const problems: string[] = []

for (const [file, count] of [...found].sort(([left], [right]) => left.localeCompare(right))) {
  const declaration = DECLARED_OWNERS[file]
  if (!declaration) {
    problems.push(`  undeclared control-lease owner: ${file} (${count} acquire site${count === 1 ? "" : "s"})`)
    continue
  }
  if (declaration.sites !== count) {
    problems.push(
      `  ${file} declares ${declaration.sites} acquire site${declaration.sites === 1 ? "" : "s"} but has ${count}`,
    )
  }
}
for (const file of [...declared].filter((file) => !found.has(file)).sort()) {
  problems.push(`  declared owner no longer takes a control lease: ${file}`)
}
for (const file of aliased.sort()) {
  problems.push(`  ${file} imports the acquire primitive under an alias, which hides it from this check`)
}

if (problems.length > 0) {
  console.error(
    [
      "control lease owner check failed",
      ...problems,
      "  A control lease must end with the receipt that settles it. Declare the owner in DECLARED_OWNERS with its " +
        "acquire-site count and the release its settlement performs, or state why it deliberately keeps the lease.",
    ].join("\n"),
  )
  process.exit(1)
}

const sites = [...found.values()].reduce((total, count) => total + count, 0)
console.log(`control lease owner check passed (${found.size} owners, ${sites} acquire sites, all declared)`)
