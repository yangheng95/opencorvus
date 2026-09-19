import { expect, test } from "bun:test"
import {
  AUTOMATIONBENCH_BASE_RESTRICTED_SHELL_SHA256,
  automationBenchCaseSetAuthority,
  automationBenchRestrictedShellAuthority,
  automationBenchRestrictedShellSourceFile,
} from "../../script/benchmark/external-agent/contract"

const expected = { sha256: "a".repeat(64), canonical_sha256: "b".repeat(64) }
const input = {
  caseCount: 100,
  sealedSHA256: expected.sha256,
  sealedCanonicalSHA256: expected.canonical_sha256,
  expected,
}

for (const caseIndex of [undefined, Number.NaN, "51", true, 1.5]) {
  test(`invalid case identity ${String(caseIndex)} returns the restricted shell authority error`, () => {
    expect(
      automationBenchRestrictedShellAuthority({
        caseIndex,
        baseCount: 50,
        extendedCount: 100,
        sealedSHA256: AUTOMATIONBENCH_BASE_RESTRICTED_SHELL_SHA256,
        extendedSHA256: "a".repeat(64),
      }),
    ).toEqual({
      passed: false,
      authority: null,
      expected_sha256: null,
      violations: ["case_index_out_of_manifest", "restricted_shell_authority_mismatch"],
    })
  })
}

for (const caseIndex of [1, 50, 51, 100]) {
  test(`case ${caseIndex} belongs to the same explicitly selected 100-case authority`, () => {
    expect(automationBenchCaseSetAuthority({ ...input, caseIndex })).toEqual({ passed: true, violations: [] })
  })
}

test("a previous subset digest returns an exact manifest authority error", () => {
  expect(automationBenchCaseSetAuthority({ ...input, caseIndex: 1, sealedSHA256: "c".repeat(64) })).toEqual({
    passed: false,
    violations: ["case_set_authority_mismatch"],
  })
})

test("an unrelated canonical digest returns an exact manifest authority error", () => {
  expect(automationBenchCaseSetAuthority({ ...input, caseIndex: 1, sealedCanonicalSHA256: "c".repeat(64) })).toEqual({
    passed: false,
    violations: ["case_set_authority_mismatch"],
  })
})

for (const caseIndex of [0, 101]) {
  test(`case ${caseIndex} returns the selected manifest range error`, () => {
    expect(automationBenchCaseSetAuthority({ ...input, caseIndex })).toEqual({
      passed: false,
      violations: ["case_index_out_of_manifest"],
    })
  })
}

for (const [caseIndex, sourceFile] of [
  [1, "restricted-agent-shell-base.sh"],
  [50, "restricted-agent-shell-base.sh"],
  [51, "restricted-agent-shell.sh"],
  [100, "restricted-agent-shell.sh"],
] as const) {
  test(`case ${caseIndex} selects its frozen restricted Agent shell`, () => {
    expect(automationBenchRestrictedShellSourceFile({ caseIndex, baseCount: 50, extendedCount: 100 })).toBe(
      sourceFile,
    )
  })
}
