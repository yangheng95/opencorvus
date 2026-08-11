import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { BUILTIN_EXPERT_SQUAD_NAMESPACE } from "@/expert-squad/id"
import base_expert_squad_jsonc from "./base/expert-squad.jsonc" with { type: "text" }
import base_README_md from "./base/README.md" with { type: "text" }
import base_selector_md from "./base/selector.md" with { type: "text" }
import base_developer_system_md from "./base/agents/base-developer/system.md" with { type: "text" }
import base_integrity_reviewer_system_md from "./base/agents/base-integrity-reviewer/system.md" with { type: "text" }
import base_planner_system_md from "./base/agents/base-planner/system.md" with { type: "text" }
import base_researcher_system_md from "./base/agents/base-researcher/system.md" with { type: "text" }
import base_tester_system_md from "./base/agents/base-tester/system.md" with { type: "text" }
import base_visual_reviewer_system_md from "./base/agents/base-visual-reviewer/system.md" with { type: "text" }
import base_orchestrator_system_md from "./base/agents/orchestrator/system.md" with { type: "text" }
import base_method_skill_md from "./base/skills/method/SKILL.md" with { type: "text" }
import advanced_expert_squad_jsonc from "./advanced/expert-squad.jsonc" with { type: "text" }
import advanced_README_md from "./advanced/README.md" with { type: "text" }
import advanced_selector_md from "./advanced/selector.md" with { type: "text" }
import advanced_claim_verifier_system_md from "./advanced/agents/claim-verifier/system.md" with { type: "text" }
import advanced_implementation_engineer_system_md from "./advanced/agents/implementation-engineer/system.md" with { type: "text" }
import advanced_interface_designer_system_md from "./advanced/agents/interface-designer/system.md" with { type: "text" }
import advanced_interface_integrity_reviewer_system_md from "./advanced/agents/interface-integrity-reviewer/system.md" with { type: "text" }
import advanced_interface_investigator_system_md from "./advanced/agents/interface-investigator/system.md" with { type: "text" }
import advanced_orchestrator_system_md from "./advanced/agents/orchestrator/system.md" with { type: "text" }
import advanced_request_interpreter_system_md from "./advanced/agents/request-interpreter/system.md" with { type: "text" }
import advanced_requirement_engineer_system_md from "./advanced/agents/requirement-engineer/system.md" with { type: "text" }
import advanced_research_investigator_system_md from "./advanced/agents/research-investigator/system.md" with { type: "text" }
import advanced_solution_architect_system_md from "./advanced/agents/solution-architect/system.md" with { type: "text" }
import advanced_source_investigator_system_md from "./advanced/agents/source-investigator/system.md" with { type: "text" }
import advanced_system_integrity_reviewer_system_md from "./advanced/agents/system-integrity-reviewer/system.md" with { type: "text" }
import advanced_test_engineer_system_md from "./advanced/agents/test-engineer/system.md" with { type: "text" }
import advanced_visual_reviewer_system_md from "./advanced/agents/visual-reviewer/system.md" with { type: "text" }
import advanced_workload_reviewer_system_md from "./advanced/agents/workload-reviewer/system.md" with { type: "text" }
import advanced_method_skill_md from "./advanced/skills/method/SKILL.md" with { type: "text" }
import research_studio_expert_squad_jsonc from "./research-studio/expert-squad.jsonc" with { type: "text" }
import research_studio_README_md from "./research-studio/README.md" with { type: "text" }
import research_studio_selector_md from "./research-studio/selector.md" with { type: "text" }
import research_studio_orchestrator_system_md from "./research-studio/agents/orchestrator/system.md" with { type: "text" }
import research_studio_analyst_system_md from "./research-studio/agents/research-studio-analyst/system.md" with { type: "text" }
import research_studio_fact_checker_system_md from "./research-studio/agents/research-studio-fact-checker/system.md" with { type: "text" }
import research_studio_planner_system_md from "./research-studio/agents/research-studio-planner/system.md" with { type: "text" }
import research_studio_researcher_system_md from "./research-studio/agents/research-studio-researcher/system.md" with { type: "text" }
import research_studio_writer_system_md from "./research-studio/agents/research-studio-writer/system.md" with { type: "text" }
import research_studio_analysis_report_quality_skill_md from "./research-studio/skills/analysis-report-quality/SKILL.md" with { type: "text" }
import research_studio_decision_report_template_md from "./research-studio/skills/analysis-report-quality/references/decision-research-report-template.md" with { type: "text" }
import research_studio_decision_report_schema_json from "./research-studio/skills/analysis-report-quality/references/decision-research-report.schema.json" with { type: "text" }
import squad_sdk_expert_squad_jsonc from "../../../../../expert-squads/builtin/squad-sdk/expert-squad.jsonc" with { type: "text" }
import squad_sdk_README_md from "../../../../../expert-squads/builtin/squad-sdk/README.md" with { type: "text" }
import squad_sdk_selector_md from "../../../../../expert-squads/builtin/squad-sdk/selector.md" with { type: "text" }
import squad_sdk_orchestrator_system_md from "../../../../../expert-squads/builtin/squad-sdk/agents/orchestrator/system.md" with { type: "text" }
import squad_sdk_contract_reviewer_system_md from "../../../../../expert-squads/builtin/squad-sdk/agents/squad-sdk-contract-reviewer/system.md" with { type: "text" }
import squad_sdk_import_analyst_system_md from "../../../../../expert-squads/builtin/squad-sdk/agents/squad-sdk-import-analyst/system.md" with { type: "text" }
import squad_sdk_package_architect_system_md from "../../../../../expert-squads/builtin/squad-sdk/agents/squad-sdk-package-architect/system.md" with { type: "text" }
import squad_sdk_source_analyst_system_md from "../../../../../expert-squads/builtin/squad-sdk/agents/squad-sdk-source-analyst/system.md" with { type: "text" }
import squad_sdk_authoring_skill_md from "../../../../../expert-squads/builtin/squad-sdk/skills/authoring/SKILL.md" with { type: "text" }
import squad_sdk_authoring_quality_method_md from "../../../../../expert-squads/builtin/squad-sdk/skills/authoring/references/authoring-quality-method.md" with { type: "text" }
import squad_sdk_authoring_contract_json from "../../../../../expert-squads/builtin/squad-sdk/skills/authoring/references/definition-contract.json" with { type: "text" }
import squad_sdk_import_skill_md from "../../../../../expert-squads/builtin/squad-sdk/skills/import/SKILL.md" with { type: "text" }
import {
  ADVANCED_EXPERT_SQUAD_ID,
  BASE_EXPERT_SQUAD_ID,
  RESEARCH_STUDIO_EXPERT_SQUAD_ID,
  SQUAD_SDK_EXPERT_SQUAD_ID,
} from "./ids"

export {
  ADVANCED_EXPERT_SQUAD_ID,
  BASE_EXPERT_SQUAD_ID,
  RESEARCH_STUDIO_EXPERT_SQUAD_ID,
  SQUAD_SDK_EXPERT_SQUAD_ID,
} from "./ids"

function exactTextImport(content: unknown, source: string): string {
  if (typeof content !== "string") throw new Error(`Embedded package source ${source} must load as exact text.`)
  return content
}

export const builtInPackageSources = [
  {
    namespace: BUILTIN_EXPERT_SQUAD_NAMESPACE,
    id: BASE_EXPERT_SQUAD_ID,
    files: {
      "expert-squad.jsonc": base_expert_squad_jsonc,
      "README.md": base_README_md,
      "selector.md": base_selector_md,
      "agents/base-developer/system.md": base_developer_system_md,
      "agents/base-integrity-reviewer/system.md": base_integrity_reviewer_system_md,
      "agents/base-planner/system.md": base_planner_system_md,
      "agents/base-researcher/system.md": base_researcher_system_md,
      "agents/base-tester/system.md": base_tester_system_md,
      "agents/base-visual-reviewer/system.md": base_visual_reviewer_system_md,
      "agents/orchestrator/system.md": base_orchestrator_system_md,
      "skills/method/SKILL.md": base_method_skill_md,
    },
  },
  {
    namespace: BUILTIN_EXPERT_SQUAD_NAMESPACE,
    id: ADVANCED_EXPERT_SQUAD_ID,
    files: {
      "expert-squad.jsonc": advanced_expert_squad_jsonc,
      "README.md": advanced_README_md,
      "selector.md": advanced_selector_md,
      "agents/claim-verifier/system.md": advanced_claim_verifier_system_md,
      "agents/implementation-engineer/system.md": advanced_implementation_engineer_system_md,
      "agents/interface-designer/system.md": advanced_interface_designer_system_md,
      "agents/interface-integrity-reviewer/system.md": advanced_interface_integrity_reviewer_system_md,
      "agents/interface-investigator/system.md": advanced_interface_investigator_system_md,
      "agents/orchestrator/system.md": advanced_orchestrator_system_md,
      "agents/request-interpreter/system.md": advanced_request_interpreter_system_md,
      "agents/requirement-engineer/system.md": advanced_requirement_engineer_system_md,
      "agents/research-investigator/system.md": advanced_research_investigator_system_md,
      "agents/solution-architect/system.md": advanced_solution_architect_system_md,
      "agents/source-investigator/system.md": advanced_source_investigator_system_md,
      "agents/system-integrity-reviewer/system.md": advanced_system_integrity_reviewer_system_md,
      "agents/test-engineer/system.md": advanced_test_engineer_system_md,
      "agents/visual-reviewer/system.md": advanced_visual_reviewer_system_md,
      "agents/workload-reviewer/system.md": advanced_workload_reviewer_system_md,
      "skills/method/SKILL.md": advanced_method_skill_md,
    },
  },
  {
    namespace: BUILTIN_EXPERT_SQUAD_NAMESPACE,
    id: RESEARCH_STUDIO_EXPERT_SQUAD_ID,
    files: {
      "expert-squad.jsonc": research_studio_expert_squad_jsonc,
      "README.md": research_studio_README_md,
      "selector.md": research_studio_selector_md,
      "agents/orchestrator/system.md": research_studio_orchestrator_system_md,
      "agents/research-studio-analyst/system.md": research_studio_analyst_system_md,
      "agents/research-studio-fact-checker/system.md": research_studio_fact_checker_system_md,
      "agents/research-studio-planner/system.md": research_studio_planner_system_md,
      "agents/research-studio-researcher/system.md": research_studio_researcher_system_md,
      "agents/research-studio-writer/system.md": research_studio_writer_system_md,
      "skills/analysis-report-quality/SKILL.md": research_studio_analysis_report_quality_skill_md,
      "skills/analysis-report-quality/references/decision-research-report-template.md":
        research_studio_decision_report_template_md,
      "skills/analysis-report-quality/references/decision-research-report.schema.json": exactTextImport(
        research_studio_decision_report_schema_json,
        "research-studio/skills/analysis-report-quality/references/decision-research-report.schema.json",
      ),
    },
  },
  {
    namespace: BUILTIN_EXPERT_SQUAD_NAMESPACE,
    id: SQUAD_SDK_EXPERT_SQUAD_ID,
    files: {
      "expert-squad.jsonc": squad_sdk_expert_squad_jsonc,
      "README.md": squad_sdk_README_md,
      "selector.md": squad_sdk_selector_md,
      "agents/orchestrator/system.md": squad_sdk_orchestrator_system_md,
      "agents/squad-sdk-contract-reviewer/system.md": squad_sdk_contract_reviewer_system_md,
      "agents/squad-sdk-import-analyst/system.md": squad_sdk_import_analyst_system_md,
      "agents/squad-sdk-package-architect/system.md": squad_sdk_package_architect_system_md,
      "agents/squad-sdk-source-analyst/system.md": squad_sdk_source_analyst_system_md,
      "skills/authoring/SKILL.md": squad_sdk_authoring_skill_md,
      "skills/authoring/references/authoring-quality-method.md": squad_sdk_authoring_quality_method_md,
      "skills/authoring/references/definition-contract.json": exactTextImport(
        squad_sdk_authoring_contract_json,
        "squad-sdk/skills/authoring/references/definition-contract.json",
      ),
      "skills/import/SKILL.md": squad_sdk_import_skill_md,
    },
  },
] as const

let loadedBuiltInPackagesCache: ReturnType<typeof ExpertSquadRegistry.loadEmbeddedPackage>[] | undefined

export function getLoadedBuiltInPackages() {
  loadedBuiltInPackagesCache ??= builtInPackageSources.map((source) => ExpertSquadRegistry.loadEmbeddedPackage(source))
  return loadedBuiltInPackagesCache
}
