import { isHttpWebpageUrl } from "@/util/web-url"
import { z } from "zod"
import { DesignResourceIntentSchema } from "@/protocol/design-resource-intent"

const DeliverySliceRevisionSubjectsSchema = z
  .array(z.string().min(1))
  .default([])
  .describe(
    "Exact current Delivery Slice revision IDs selected as immutable work or evidence subjects for this Task-scoped dispatch. The array never multiplies workers or workflow nodes, and empty means no Slice contract was selected.",
  )

const DelegatedWorkerInputSchema = z
  .object({
    goal_ids: DeliverySliceRevisionSubjectsSchema,
    instruction: z.string().trim().min(1).describe("Exact delegated instruction this projected worker must complete."),
    reason: z.string().trim().min(1).describe("Why this delegated work is needed for the current task."),
  })
  .strict()

const RequirementsInputSchema = z
  .object({
    reason: z.string().min(1).describe("Why you decided to analyze requirements"),
    attachment_refs: z
      .array(z.string().min(1))
      .default([])
      .describe(
        "Exact canonical Task attachment URLs or SHA-256 (Secure Hash Algorithm 256-bit) refs selected for this Requirements Turn. Empty never expands to every Task attachment.",
      ),
  })
  .strict()

const ArchitectInputSchema = z
  .object({
    reason: z.string().min(1).describe("Why the single Task-scoped Architect occurrence is ready now"),
    attachment_refs: z
      .array(z.string().min(1))
      .default([])
      .describe(
        "Exact canonical Task attachment URLs or SHA-256 (Secure Hash Algorithm 256-bit) refs selected for this Architect Turn. Empty never expands to every Task attachment.",
      ),
  })
  .strict()

const WorkloadAnalysisInputSchema = z
  .object({
    reason: z.string().min(1).describe("Why you decided to run workload analysis"),
    goal_ids: DeliverySliceRevisionSubjectsSchema,
  })
  .strict()

const AnalyzeIntentInputSchema = z
  .object({
    reason: z.string().min(1).describe("Why you decided to run intent analysis (first-wake / re-entry / scope change)"),
    attachment_refs: z
      .array(z.string().min(1))
      .default([])
      .describe(
        "Exact canonical Task attachment URLs or SHA-256 (Secure Hash Algorithm 256-bit) refs selected for this Intent Analysis Turn. Empty never expands to every Task attachment.",
      ),
  })
  .strict()

const FrontendDesignInputSchema = z
  .object({
    goal_ids: DeliverySliceRevisionSubjectsSchema,
    mode: z
      .enum(["greenfield_original", "reference_parity"])
      .describe(
        "greenfield_original authors an original task-scoped design from explicit textual/product constraints; reference_parity derives the design from supplied screenshot/source evidence and must not invent missing reference facts.",
      ),
    reason: z
      .string()
      .min(1)
      .describe(
        "Why frontend_design is the right visual implementation-template producer for the current task. Name the requested deliverable and its declared design authority: textual product/system/API/interaction constraints for greenfield_original, or supplied visual evidence for reference_parity. Explain why projected consumers need a durable FrontendDesign artifact and evidence manifest instead of only research notes. Specialist acquisition order and source-structure prerequisites come from the active expert-squad overlay.",
      ),
    attachment_bindings: z
      .array(
        z
          .object({
            attachment_url: z.string().min(1),
            intent: DesignResourceIntentSchema,
          })
          .strict(),
      )
      .optional()
      .describe(
        "Explicit design-resource bindings for neutral user uploads already attached to the current task. Each URL must belong to that task; MIME and filename never determine intent.",
      ),
    materials: z
      .array(
        z
          .object({
            path: z.string().min(1),
            intent: DesignResourceIntentSchema,
          })
          .strict(),
      )
      .optional()
      .describe(
        "Fresh frontend_design local files with an explicit design intent. Every path must name one regular file, never a directory; enumerate intended files explicitly. Paths are relative to the project root or absolute under it. Unsupported extensions fail explicitly; do not pass generated build output or webpage source URLs.",
      ),
  })
  .strict()
  .superRefine((input, context) => {
    const bindingURLs = input.attachment_bindings?.map((binding) => binding.attachment_url) ?? []
    if (new Set(bindingURLs).size !== bindingURLs.length) {
      context.addIssue({
        code: "custom",
        path: ["attachment_bindings"],
        message: "frontend_design attachment_bindings requires unique attachment_url values.",
      })
    }
  })

const FrontendResearchInputSchema = z
  .object({
    goal_ids: DeliverySliceRevisionSubjectsSchema,
    reason: z
      .string()
      .min(1)
      .describe(
        "Why frontend_research should publish source-backed interface investigation packets now. Name the source scope and the projected consumer contract that needs this evidence. This is not the frontend implementation template; use frontend_design for that. Do not use a new focus on an already-briefed source URL as a reason for a fresh frontend_research call.",
      ),
    source_urls: z
      .array(
        z
          .string()
          .min(1)
          .refine(isHttpWebpageUrl, "frontend_research source_urls entries must be HTTP(S) webpage URLs"),
      )
      .min(1)
      .describe(
        "Complete authorized frontend_research HTTP(S) source set for this single Task workflow occurrence. Use the plural field `source_urls`; do not send `url`, `source_url`, or URL fields to frontend_design. The active expert-squad worker acquires and partitions source-backed investigation evidence through visible tools. A different focus, viewport, interaction state, component, region, fidelity risk, missing-detail question, or additional independent URL does not authorize another occurrence of an already-dispatched workflow node.",
      ),
    focus: z
      .string()
      .optional()
      .describe(
        "Optional focus for the frontend_research agent on a not-yet-briefed source URL. Focus narrows the brief only; it cannot turn an already-briefed source URL into a new source-page scope.",
      ),
  })
  .strict()

const DeepResearchInputSchema = z
  .object({
    reason: z.string().min(1).describe("Why evidence research is needed for this task."),
    target_deliverable: z
      .enum(["prd", "spec", "research_report", "implementation_input", "mixed"])
      .optional()
      .describe("The likely document/input shape being researched."),
    source_urls: z
      .array(
        z.string().min(1).refine(isHttpWebpageUrl, "deep_research source_urls entries must be HTTP(S) webpage URLs"),
      )
      .default([])
      .describe(
        "Known exact HTTP(S) source pages the research agent must webfetch before broader discovery. Empty means no exact source page was supplied, so the research agent discovers candidates with websearch. Do not pass search-engine result pages.",
      ),
    focus: z.string().optional().describe("Optional narrow focus for the research agent."),
  })
  .strict()

const VisualQaInputSchema = z
  .object({
    reason: z
      .string()
      .min(1)
      .describe("Why dedicated frontend visual GUI fidelity and functional testing is useful now."),
    focus: z.string().optional().describe("Optional narrowed region/state/viewport focus for visual QA."),
    app_url: z
      .string()
      .optional()
      .describe("Known preview URL to inspect. Omit when the agent should discover/start preview from scripts."),
    preview_command: z
      .string()
      .optional()
      .describe(
        "Suggested project command to start the real preview target. Use Node for Playwright/browser automation on Windows.",
      ),
    goal_ids: DeliverySliceRevisionSubjectsSchema,
  })
  .strict()

const FactCheckInputSchema = z
  .object({
    target_session_id: z
      .string()
      .min(1)
      .describe("Session id owning the exact visible assistant message you want fact-checked."),
    target_message_id: z
      .string()
      .min(1)
      .describe(
        "Exact stable assistant message ref selected from describe_task/read_agent_message. The Host does not substitute another message from the Session.",
      ),
    target_agent: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Optional consistency check for the worker agent name. The Host derives the actual value from the exact target message.",
      ),
    reason: z.string().min(10).describe("Why you decided to dispatch fact-check on this worker output."),
  })
  .strict()

const BuildInputSchema = z
  .object({
    goal_ids: DeliverySliceRevisionSubjectsSchema,
    request: z
      .string()
      .optional()
      .describe(
        "Optional current Task implementation guidance. Include only exact operator or repair facts the projected Build worker needs in addition to the durable Task request and Artifact catalog.",
      ),
    reason: z
      .string()
      .min(1)
      .describe("One sentence explaining why this Task-scoped build-adapter execution is valid now."),
    worktreeUsage: z
      .enum(["managed_worktree", "current_project"])
      .optional()
      .describe(
        "Optional Task execution-directory choice. managed_worktree lets the Build runtime create a Task-owned git worktree and exposes merge_back. current_project runs in the active Task project directory as caller-owned workDir and does not expose merge_back. Omitted values use current_project.",
      ),
  })
  .strict()

const ExploreInputSchema = z
  .object({
    question: z
      .string()
      .min(1)
      .describe("The focused repository question the explore subagent must answer with file/symbol evidence."),
    reason: z
      .string()
      .min(1)
      .describe("Why this repository investigation is needed for the current scheduler decision."),
  })
  .strict()

const IntegrityInputSchema = z
  .object({
    reason: z.string().min(1).describe("Why you decided to run integrity review"),
    goal_ids: DeliverySliceRevisionSubjectsSchema,
    attachment_refs: z
      .array(z.string().min(1))
      .default([])
      .describe(
        "Exact canonical Task attachment URLs or SHA-256 (Secure Hash Algorithm 256-bit) refs to inspect. Empty never expands to every Task attachment.",
      ),
  })
  .strict()

export const DispatchAdapterInputSchemas = Object.freeze({
  delegated_worker: DelegatedWorkerInputSchema,
  requirements: RequirementsInputSchema,
  architect: ArchitectInputSchema,
  frontend_design: FrontendDesignInputSchema,
  frontend_research: FrontendResearchInputSchema,
  deep_research: DeepResearchInputSchema,
  visual_qa: VisualQaInputSchema,
  workload_analysis: WorkloadAnalysisInputSchema,
  analyze_intent: AnalyzeIntentInputSchema,
  fact_check: FactCheckInputSchema,
  build: BuildInputSchema,
  explore: ExploreInputSchema,
  integrity: IntegrityInputSchema,
})
