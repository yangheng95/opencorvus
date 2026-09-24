import { describe, expect, test } from "bun:test"
import z from "zod"
import { DispatchAdapterContractRegistry } from "../src/agent/dispatch-adapter-contract"
import {
  DeliverySliceRevisionSubjectsSchema,
  deliverySliceRevisionSubjectField,
} from "../src/agent/dispatch-adapter-input"

describe("dispatch acceptance subject contract", () => {
  const subjectAdapters = [
    "delegated_worker",
    "frontend_design",
    "frontend_research",
    "visual_qa",
    "workload_analysis",
    "build",
    "integrity",
  ] as const

  test("all subject-bearing adapters preserve exact input and replacement order", () => {
    const original = ["gol_original_b", "gol_original_a"]
    const revised = ["gol_revised_a", "gol_revised_b"]
    for (const id of subjectAdapters) {
      expect(deliverySliceRevisionSubjectField(DispatchAdapterContractRegistry.get(id).inputSchema)).toBe("goal_ids")
      expect(DispatchAdapterContractRegistry.deliverySliceRevisionIDs(id, { goal_ids: original })).toEqual(original)
      const replaced = DispatchAdapterContractRegistry.withDeliverySliceRevisionIDs(
        id,
        { reason: "Inspect exact subjects" },
        revised,
      )
      expect(replaced).toEqual({ reason: "Inspect exact subjects", goal_ids: revised })
      expect(DispatchAdapterContractRegistry.deliverySliceRevisionIDs(id, replaced)).toEqual(revised)
      expect(DispatchAdapterContractRegistry.deliverySliceRevisionIDs(id, { goal_ids: [] })).toEqual([])
    }
  })

  test("field ownership follows the shared schema even under a different name", () => {
    const schema = z.object({ acceptance_subjects: DeliverySliceRevisionSubjectsSchema, reason: z.string() })
    expect(deliverySliceRevisionSubjectField(schema)).toBe("acceptance_subjects")
    expect(
      DispatchAdapterContractRegistry.deliverySliceRevisionIDs("requirements", { reason: "Discover requirements" }),
    ).toEqual([])
    expect(
      DispatchAdapterContractRegistry.withDeliverySliceRevisionIDs(
        "requirements",
        { reason: "Discover requirements" },
        [],
      ),
    ).toEqual({ reason: "Discover requirements" })
  })

  test("malformed subjects receive the canonical input error", () => {
    const result = DeliverySliceRevisionSubjectsSchema.safeParse([42])
    expect(result).toMatchObject({ success: false, error: { issues: [{ code: "invalid_type", path: [0] }] } })
    expect(() =>
      DispatchAdapterContractRegistry.deliverySliceRevisionIDs("delegated_worker", { goal_ids: [42] }),
    ).toThrow(z.ZodError)
    expect(() =>
      deliverySliceRevisionSubjectField(
        z.object({
          first: DeliverySliceRevisionSubjectsSchema,
          second: DeliverySliceRevisionSubjectsSchema,
        }),
      ),
    ).toThrow("at most one Delivery Slice subject field")
  })
})
