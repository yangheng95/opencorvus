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
 * Three independent review rounds each found an owner the previous round had
 * missed, because nothing enumerated them. This is that enumeration: every
 * site that acquires a control lease is declared here with the release its
 * settlement performs. Adding an acquire without declaring it fails; declaring
 * one that no longer exists fails too, so the list cannot rot.
 */

import { Glob } from "bun"
import path from "node:path"

const SOURCE_ROOT = path.resolve(import.meta.dir, "../../src")

type Declaration = {
  /** Lease target namespace this site acquires. */
  target: string
  /** Where the settlement that ends this lease lives, or why none exists. */
  release: string
}

/** Every acquire site, keyed by `<repo-relative path>:<function or region>`. */
const DECLARED_ACQUIRE_SITES: Record<string, Declaration> = {
  "bus/index.ts": {
    target: "bus_delivery",
    release:
      "dispatchDurableTargets releases with the succeeded receipt, with the failed/ignored receipt, and when it finds the delivery already terminal.",
  },
  "channel/ingress.ts": {
    target: "effect",
    release:
      "The outcome receipt releases in its own transaction; a failing executeMessage hands ownership back through releaseControlLeaseOnErrorPath.",
  },
  "engine/build-observation-cleanup.ts": {
    target: "build_cleanup",
    release:
      "settleBuildObservationCleanup releases with both the complete and the failed receipt; the terminal `retained` receipt releases in engine/persist.ts.",
  },
  "mission/execution-closure.ts": {
    target: "lifecycle",
    release:
      "The closure fact releases in its own transaction; a close that ends without one hands ownership back in finally.",
  },
  "permission/authority.ts": {
    target: "effect",
    release:
      "completeExecution and appendEffectOutcome release with their terminal receipt; abandonEffectLease hands ownership back when a durable task stays open.",
  },
  "protocol/delivery.ts": {
    target: "protocol_delivery",
    release:
      "rescheduleSchedulerDelivery releases with its retry receipt. The terminal settlement deliberately does not: projectProtocolDeliveryInTransaction lets terminal status win over the lease, and due selection filters terminal rows.",
  },
  "scheduler/automation-service.ts": {
    target: "automation",
    release:
      "The recurring, one-shot, activity and failure settlements each release with their receipts, inside the same transaction.",
  },
  "scheduler/event-service.ts": {
    target: "event_fire",
    release:
      "settleSuccess, settleDisposition and scheduleRetry release with their receipts. deferFire deliberately rides the current owner's lease as the recovery schedule.",
  },
  "session/loop.ts": {
    target: "session_control",
    release:
      "SessionControl.settle releases with the terminal event and when it finds the control already settled; a renewal failure hands ownership back.",
  },
  "engine/task-root-fact-store.ts": {
    target: "task_root_ingress",
    release:
      "NOT RELEASED. This is a second implementation of acquire/renew/assert against the lease table that bypasses engine/control-lease.ts, and it carries its own consumed-activation predicate. Recorded as open architecture debt; converging it onto the shared primitive is the fix, not a release added here.",
  },
}

const ACQUIRE = /\bacquireControlLease(?:InTransaction)?\s*\(/g

const found = new Map<string, number>()
for await (const relative of new Glob("**/*.ts").scan({ cwd: SOURCE_ROOT })) {
  const file = relative.replaceAll("\\", "/")
  if (file.startsWith("engine/control-lease")) continue
  const text = await Bun.file(path.join(SOURCE_ROOT, relative)).text()
  const count = [...text.matchAll(ACQUIRE)].length
  if (count > 0) found.set(file, count)
}

// `engine/task-root-fact-store.ts` acquires by inserting into the lease table
// directly, so the call-shape scan cannot see it. Its declaration exists to
// keep that second implementation visible until it is converged.
const DIRECT_TABLE_OWNERS = ["engine/task-root-fact-store.ts"]
for (const file of DIRECT_TABLE_OWNERS) {
  const text = await Bun.file(path.join(SOURCE_ROOT, file)).text()
  if (text.includes("EngineControlActivationLeaseTable")) found.set(file, found.get(file) ?? 1)
}

const declared = new Set(Object.keys(DECLARED_ACQUIRE_SITES))
const undeclared = [...found.keys()].filter((file) => !declared.has(file)).sort()
const stale = [...declared].filter((file) => !found.has(file)).sort()

if (undeclared.length > 0 || stale.length > 0) {
  const report = ["control lease owner check failed"]
  for (const file of undeclared) {
    report.push(
      `  undeclared control-lease owner: ${file} (${found.get(file)} acquire site${found.get(file) === 1 ? "" : "s"})`,
    )
  }
  for (const file of stale) {
    report.push(`  declared owner no longer acquires a control lease: ${file}`)
  }
  report.push(
    "  A control lease must end with the receipt that settles it. Declare the new owner in DECLARED_ACQUIRE_SITES " +
      "with the release its settlement performs, or state why it deliberately keeps the lease.",
  )
  console.error(report.join("\n"))
  process.exit(1)
}

const sites = [...found.values()].reduce((total, count) => total + count, 0)
console.log(`control lease owner check passed (${found.size} owners, ${sites} acquire sites, all declared)`)
