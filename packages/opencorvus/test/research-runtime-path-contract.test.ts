import { expect, test } from "bun:test"
import path from "node:path"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { buildResearchBriefFromDraft } from "../src/research/output-tools"
import {
  validateResearchBriefIntegrity,
  validateResearchBriefTaskBoundary,
} from "../src/research/schema"

test("current Task deep-research bundle paths satisfy the persisted brief contract", () => {
  const taskID = "tsk_g019feac87143000000000000ApkXBHMQFC9JSA"
  const sessionID = "ses_-fe60152c7cf1ffffffffffff7DoUVvWh0vyGEd"
  const paths = ProjectRuntimePaths.deepResearchPaths("C:\\project", taskID, sessionID)
  const bundlePaths = {
    full_markdown_path: path.posix.join(paths.relativeDir, "research-bundle.md"),
    evidence_json_path: path.posix.join(paths.relativeDir, "evidence.json"),
    citation_map_path: path.posix.join(paths.relativeDir, "citation-map.json"),
  }
  const brief = buildResearchBriefFromDraft({
    draft: {
      scope: {
        user_goal: "Research the supplied operating facts",
        deliverable_type: "research_report",
        audience: "Operating leadership",
        explicit_non_goals: [],
        assumed_non_goals: [],
      },
      summary: "The supplied facts are ready for evidence-backed analysis.",
      evidence_index: [],
      facts: [],
      inferences: [],
      problem_statements: [],
      user_needs: [],
      constraints: [],
      document_outline: [],
      subpage_research_tasks: [],
      open_questions: [],
      bundle: {
        full_markdown_sections: [],
        evidence_notes: [],
        citation_map: [],
      },
    },
    metadata: {
      research_session_id: sessionID,
      created_for_message_id: "msg_research_contract",
      request_hash: "request-hash",
      created_at: "2026-08-10T00:00:00.000Z",
    },
    bundlePaths,
  })

  const integrityError = validateResearchBriefIntegrity(brief)
  const taskBoundaryError = validateResearchBriefTaskBoundary(brief, taskID)
  if (integrityError || taskBoundaryError) {
    throw new Error(integrityError ?? taskBoundaryError)
  }

  expect(brief.bundle).toEqual(bundlePaths)
})
