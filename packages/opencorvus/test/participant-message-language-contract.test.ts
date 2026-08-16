import { describe, expect, test } from "bun:test"
import { PrimaryAssistantRegistry } from "../src/agent/primary-assistant-registry"
import { ORCHESTRATOR_INSTRUCTIONS } from "../src/orchestrator/agent"
import {
  PARTICIPANT_MESSAGE_LANGUAGE,
  PARTICIPANT_MESSAGE_LANGUAGE_HEADING,
} from "../src/prompt/fragments/participant-message-language"
import { OBSERVABLE_WORK_NARRATIVE } from "../src/prompt/fragments/observable-work-narrative"
import MISSION_CORE from "../src/prompt/core/mission-core.txt" with { type: "text" }
import ORCHESTRATOR_CORE from "../src/prompt/core/orchestrator-core.txt" with { type: "text" }

describe("participant message language contract", () => {
  test("bans Host-internal state and steps from operator-visible messages", () => {
    const requiredClauses = [
      "Every message rendered into the conversation panel is written for the operator in the language of their own task",
      "Never narrate a Host-internal private value or an internal procedure step in those messages",
      "`terminal_success`",
      "`occurrence_committed`",
      "numbered steps, section names, or rule labels from this prompt",
      "State what changed in the work itself",
    ]

    expect(requiredClauses.map((clause) => PARTICIPANT_MESSAGE_LANGUAGE.includes(clause))).toEqual(
      requiredClauses.map(() => true),
    )
  })

  test("keeps the ban scoped to panel text without weakening internal fields or the truth", () => {
    expect(PARTICIPANT_MESSAGE_LANGUAGE).toContain(
      "Keep every internal value exactly as it is wherever the panel does not render it",
    )
    expect(PARTICIPANT_MESSAGE_LANGUAGE).toContain(
      "never a scheduling decision, a lifecycle judgment, an acceptance conclusion, or an identifier a Host tool requires",
    )
    expect(PARTICIPANT_MESSAGE_LANGUAGE).toContain("Plain language never softens the fact.")
  })

  test("binds the contract to the Task scheduler and to Mission", () => {
    expect(ORCHESTRATOR_INSTRUCTIONS).toContain(PARTICIPANT_MESSAGE_LANGUAGE)
    expect(PrimaryAssistantRegistry.nativeDefaultPrompt("mission")).toContain(PARTICIPANT_MESSAGE_LANGUAGE)
    expect(ORCHESTRATOR_CORE).toContain(PARTICIPANT_MESSAGE_LANGUAGE_HEADING)
    expect(MISSION_CORE).toContain(PARTICIPANT_MESSAGE_LANGUAGE_HEADING)
  })

  test("keeps the shared work narrative free of framework vocabulary", () => {
    expect(OBSERVABLE_WORK_NARRATIVE).toContain("Write each note in the language of the task itself.")
  })
})
