import { describe, expect, test } from "bun:test"
import { ProductPillarSchema, ProductPillarsSchema } from "../src/expert-squad-manifest-v1"

describe("product pillar contract", () => {
  test("projects both canonical product pillars", () => {
    expect(ProductPillarSchema.parse("code")).toBe("code")
    expect(ProductPillarSchema.parse("work")).toBe("work")
    expect(ProductPillarsSchema.parse(["code", "work"])).toEqual(["code", "work"])
  })
})
