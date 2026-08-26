import { z } from "zod"

/**
 * The product pillar a Task, Session or Expert Squad belongs to.
 *
 * This lives in the lowest package that has no opinion about transport or
 * SDK shape, because both of those need it. It used to be defined in the
 * SDK's Expert Squad manifest, which made the Transport Protocol depend on
 * the SDK — while the SDK's own build read and sliced the Transport
 * Protocol's private source to generate route policy. That cycle made clean
 * build order depend on incidental workspace state; a shared fact with no
 * dependencies of its own breaks it.
 */
export const ProductPillarSchema = z.enum(["code", "work"])
export type ProductPillar = z.output<typeof ProductPillarSchema>
