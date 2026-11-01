import { expect, test } from "bun:test"
import { distinctIdentitySuffix } from "../src/utils/identity-suffix"

test("retains the distinguishing end of exact Session identities", () => {
  const identities = ["ses_-zUQWsTcezzNPfRFa33B", "ses_hqwMSLMHaC0ieJk4n982"]
  expect(distinctIdentitySuffix(identities[0]!, identities)).toBe("a33B")
  expect(distinctIdentitySuffix(identities[1]!, identities)).toBe("n982")
})

test("extends a shared suffix until the original identities are distinguishable", () => {
  const identities = ["ses_caseAa33B", "ses_caseBa33B"]
  expect(distinctIdentitySuffix(identities[0]!, identities)).toBe("Aa33B")
  expect(distinctIdentitySuffix(identities[1]!, identities)).toBe("Ba33B")
})

test("preserves execution identity with repeated observations", () => {
  const first = "msg_task-root-control_art_h6l3j7G4ohY0Y5hyXWFX_art_h6l3j7G4ohY0Y5hyXWFX"
  const second = "msg_task-root-control_art_hlCLBIkghh11rrtZ10Hs_art_hlCLBIkghh11rrtZ10Hs"
  expect(distinctIdentitySuffix(first, [first, second, first])).toBe("XWFX")
  expect(distinctIdentitySuffix(second, [first, second, first])).toBe("10Hs")
})

test("retains complete short identities", () => {
  expect(distinctIdentitySuffix("A1", ["A1", "B2"])).toBe("A1")
  expect(distinctIdentitySuffix("B2", ["A1", "B2"])).toBe("B2")
})
