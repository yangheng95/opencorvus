import { Context } from "../util/context"
import { SessionObservability } from "@/util/session-observability"
// Type-only import: erased at runtime, so config-layer consumers can read the
// ambient session without creating a session<->config import cycle.
import type { Session } from "./index"

// Ambient per-session execution context. Established once at every session
// execution entry point (see SessionContext.provide call sites) so that
// session-overridable config (model / prompt / temperature) and per-session
// observability (trace / log bucketing) resolve against the running session
// WITHOUT threading sessionID through ~70 Config.get() call sites.
//
// Single abstraction, multiple uses (config overlay resolution AND trace/log
// tagging) — do NOT introduce a parallel session-propagation mechanism.
export namespace SessionContext {
  const ctx = Context.create<Session.Info>("session")
  SessionObservability.bindSessionContext(() => ctx.tryUse())

  // Wrap a session execution. Must cover EVERY entry that runs a session
  // (prompt loop, summarize, task-api reply, wake, shell resume).
  export function provide<R>(session: Session.Info, fn: () => R): R {
    return ctx.provide(session, fn)
  }

  // Returns the active session, or undefined when running outside any session
  // (CLI / control plane). Callers that need session scope but tolerate its
  // absence (config base fallback, non-session trace domain) use this.
  export function tryUse(): Session.Info | undefined {
    return ctx.tryUse()
  }

  // Returns the active session or throws — for callers that are only ever
  // reachable from within a session execution.
  export function use(): Session.Info {
    return ctx.use()
  }

  // The active session's config overlay is resolved exclusively through the
  // single `EffectiveConfig.overlay` chokepoint (R5.1 item 3),
  // which is root-aware (a child execution session inherits its task-root
  // overlay — R5.1 item 5) and applies the same overlay to BOTH model and
  // prompt/temperature resolution. There is intentionally no overlay()
  // accessor here: a parallel reader would be a rule 8 double source.
}
