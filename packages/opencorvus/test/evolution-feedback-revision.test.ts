import { describe, expect, test } from "bun:test"
import {
  EvolutionCandidateRevisionPublishInputSchema,
  EvolutionMutationIntentRequestSchema,
  EvolutionPromotionReceiptSchema,
} from "@opencorvus-ai/plugin"
import { evolutionMutationConfirmationText } from "../src/expert-squad/evolution-mutation-intent"

const digest = (seed: string) => seed.repeat(64).slice(0, 64)
const locator = {
  source: "engine_artifact" as const,
  artifact_id: "art_candidate",
  catalog_revision: 3,
  expected_sha256: digest("a"),
}
const target = {
  scope: "project" as const,
  project_id: "prj_1",
  project_directory: "C:/work/project",
  namespace: "builtin",
  id: "deep-research",
}
const installed = (version: string, packageDigest: string) => ({
  installationScope: "project" as const,
  projectDirectory: "C:/work/project",
  namespace: "builtin",
  id: "deep-research",
  version,
  packageDigest,
  targetRoot: "C:/work/project/.opencorvus/expert-squads/builtin/deep-research",
})

describe("feedback-driven revision", () => {
  test("a candidate is driven by exactly one of a Campaign or user feedback", () => {
    const base = { hypothesis: "state chart and table preference", provenance: [] }
    expect(
      EvolutionCandidateRevisionPublishInputSchema.safeParse({
        ...base,
        development_campaign_locator: null,
        feedback: "调研报告尽可能多的图和表",
      }).success,
    ).toBe(true)
    expect(
      EvolutionCandidateRevisionPublishInputSchema.safeParse({
        ...base,
        development_campaign_locator: locator,
        feedback: null,
      }).success,
    ).toBe(true)
    // Neither driver, and both drivers, are equally incoherent.
    for (const invalid of [
      { development_campaign_locator: null, feedback: null },
      { development_campaign_locator: locator, feedback: "两个来源" },
    ]) {
      expect(EvolutionCandidateRevisionPublishInputSchema.safeParse({ ...base, ...invalid }).success).toBe(false)
    }
  })

  test("the intent names only the candidate it installs", () => {
    const parsed = EvolutionMutationIntentRequestSchema.parse({
      operation: "feedback_revision",
      candidateRevisionLocator: locator,
      expectedCurrentPackageDigest: digest("b"),
    })
    expect(parsed).toEqual({
      operation: "feedback_revision",
      candidateRevisionLocator: locator,
      expectedCurrentPackageDigest: digest("b"),
    })
    // No Campaign and no comparison are accepted, because neither exists.
    expect(
      EvolutionMutationIntentRequestSchema.safeParse({
        operation: "feedback_revision",
        candidateRevisionLocator: locator,
        comparisonResultLocator: locator,
        expectedCurrentPackageDigest: digest("b"),
      }).success,
    ).toBe(false)
  })

  test("the receipt records that user acceptance authorized it, and still replaces", () => {
    const receipt = {
      operation: "feedback_revision" as const,
      authorization: {
        project_id: "prj_1",
        task_id: "tsk_1",
        session_id: "ses_1",
        message_id: "msg_1",
        message_sha256: digest("c"),
        time_created: 1787020000000,
      },
      target,
      expected_current_digest: digest("b"),
      before_digest: digest("b"),
      after_digest: digest("d"),
      evidence: [locator],
      manager_receipt: {
        operation: "replaced" as const,
        before: installed("1", digest("b")),
        after: installed("2", digest("d")),
      },
    }
    expect(EvolutionPromotionReceiptSchema.safeParse(receipt).success).toBe(true)
    // It installs, so it must carry the replacing Manager receipt, never a restoring one.
    expect(
      EvolutionPromotionReceiptSchema.safeParse({
        ...receipt,
        manager_receipt: { ...receipt.manager_receipt, operation: "restored" as const },
      }).success,
    ).toBe(false)
  })

  test("the confirmation shows the user their own words and the way back", () => {
    const feedback = "我希望调研报告尽可能多的图和表，不要干干的全是文字"
    const text = evolutionMutationConfirmationText({
      projectID: "prj_1",
      target,
      beforeDigest: digest("b"),
      afterDigest: digest("d"),
      evidenceSHA256s: [digest("a")],
      operation: "feedback_revision",
      feedback,
    })
    expect(text).toContain(feedback)
    expect(text).toContain("未经过对照试验")
    expect(text).toContain("撤回")
    // A measured promotion claims no such thing.
    expect(
      evolutionMutationConfirmationText({
        projectID: "prj_1",
        target,
        beforeDigest: digest("b"),
        afterDigest: digest("d"),
        evidenceSHA256s: [digest("a")],
        operation: "promotion",
      }),
    ).not.toContain("未经过对照试验")
  })
})
