import z from "zod"

/**
 * Pure zod schemas for permission data shapes — extracted from
 * `permission/next.ts` so that consumers who only need the schemas (e.g.
 * `engine/model.ts`) don't pull in the full PermissionNext module's runtime
 * dependencies (`@/bus`, `@/project/instance`, etc.).
 *
 * Same rationale as `snapshot/types.ts`: a barrel-loaded module that only
 * needs a schema must not be forced through the runtime module's import
 * chain, which can transitively load `Instance.state(...)` callsites before
 * Instance has finished its own init.
 *
 * `permission/next.ts` re-exports these inside its `PermissionNext` namespace
 * so existing `PermissionNext.Reply` callsites work unchanged.
 */

export const Reply = z.enum(["once", "always", "reject"])
export type Reply = z.infer<typeof Reply>
