import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { HostAgentRegistry } from "../../src/agent/host-agent-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { Config } from "../../src/config/config"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { Instance } from "../../src/project/instance"
import { SkillManager } from "../../src/skill/manager"
import { SkillMount } from "../../src/skill/mounts"
import { memoryProject } from "../fixture/memory"
import { agentCapabilityGrants, schedulerCapabilityGrants } from "./capability-grant-fixture"

const advancedPackageRoot = path.resolve(import.meta.dir, "../../src/expert-squad/builtin/advanced")
const basePackageRoot = path.resolve(import.meta.dir, "../../src/expert-squad/builtin/base")

function workflowNodes(loaded: Awaited<ReturnType<typeof ExpertSquadRegistry.loadSourcePackage>>, workflowID: string) {
  return Object.fromEntries(
    Object.entries(loaded.manifest.capability_projection.virtual_workflows[workflowID]!.nodes).map(([nodeID, node]) => [
      nodeID,
      node.depends_on,
    ]),
  )
}

describe("built-in interface review workflow authority", () => {
  test("projects autonomous greenfield and explicit independent-visual Advanced workflows", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(advancedPackageRoot)

    expect(schedulerCapabilityGrants(loaded.manifest).defaultSkillRefs).toEqual(["default/skill/grill-me"])
    expect(agentCapabilityGrants(loaded.manifest, "requirement-engineer").defaultSkillRefs).toEqual([
      "default/skill/grill-me",
    ])
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain(
      "Load and use the mounted `grill-me` Skill as the preferred requirements-discovery method",
    )
    expect(workflowNodes(loaded, "planned-delivery")).toEqual({
      "request-interpreter": [],
      "requirement-engineer": [],
      "source-investigator": [],
      "solution-architect": ["request-interpreter", "requirement-engineer", "source-investigator"],
      "workload-reviewer": ["solution-architect"],
      "implementation-engineer": ["solution-architect"],
      "test-engineer": ["implementation-engineer"],
      "system-integrity-reviewer": ["implementation-engineer", "test-engineer", "workload-reviewer"],
    })
    expect(workflowNodes(loaded, "researched-planned-delivery")).toEqual({
      "request-interpreter": [],
      "source-investigator": [],
      "research-investigator": [],
      "requirement-engineer": ["request-interpreter", "research-investigator", "source-investigator"],
      "solution-architect": ["requirement-engineer"],
      "workload-reviewer": ["solution-architect"],
      "implementation-engineer": ["solution-architect"],
      "test-engineer": ["implementation-engineer"],
      "system-integrity-reviewer": ["implementation-engineer", "test-engineer", "workload-reviewer"],
    })
    expect(workflowNodes(loaded, "greenfield-interface-delivery")).toEqual({
      "request-interpreter": [],
      "requirement-engineer": [],
      "source-investigator": [],
      "solution-architect": ["request-interpreter", "requirement-engineer", "source-investigator"],
      "interface-designer": ["solution-architect"],
      "workload-reviewer": ["solution-architect"],
      "implementation-engineer": ["interface-designer"],
      "test-engineer": ["implementation-engineer"],
      "interface-integrity-reviewer": ["implementation-engineer"],
      "system-integrity-reviewer": ["implementation-engineer", "test-engineer", "workload-reviewer"],
    })
    expect(workflowNodes(loaded, "greenfield-interface-visual-delivery")).toEqual({
      "request-interpreter": [],
      "requirement-engineer": [],
      "source-investigator": [],
      "solution-architect": ["request-interpreter", "requirement-engineer", "source-investigator"],
      "interface-designer": ["solution-architect"],
      "workload-reviewer": ["solution-architect"],
      "implementation-engineer": ["interface-designer"],
      "test-engineer": ["implementation-engineer"],
      "visual-reviewer": ["implementation-engineer"],
      "interface-integrity-reviewer": ["implementation-engineer"],
      "system-integrity-reviewer": ["implementation-engineer", "test-engineer", "workload-reviewer"],
    })
    expect(workflowNodes(loaded, "reference-interface-delivery")).toMatchObject({
      "interface-investigator": [],
      "visual-reviewer": ["implementation-engineer"],
      "interface-integrity-reviewer": ["implementation-engineer"],
    })
    expect(loaded.promptProfile.agents["implementation-engineer"]).toContain(
      "open and personally inspect the real rendered page and applicable interaction states",
    )
    // Verifying only what the implementation reported acting on turned a partial AutomationBench
    // delivery into a PASS verdict; scope comes from the request instead.
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "acceptance authority from the original request and current raw authorities",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "Before searching for, reading, or selecting any RequirementSet, Architect spec, implementation report, or prior verdict",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain("bidirectional traceability")
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain(
      "treat both the inventory and verdict as claims to challenge",
    )
    expect(loaded.manifest.capability_projection.agents["source-investigator"]).toMatchObject({
      base_role: "delegated-worker",
      description:
        "Performs read-only repository and projected-client authority investigation and records source-grounded evidence.",
    })
    expect(agentCapabilityGrants(loaded.manifest, "source-investigator").explicitBuiltInToolIDs).toEqual([
      "bash",
      "glob",
      "read",
      "search_code",
      "skill",
    ])
    expect(loaded.promptProfile.agents["source-investigator"]).toContain(
      "use its executable surface only for read/list/get/search operations",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "requested outcome is a change to an external system of record",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "Do not dispatch platform `universal-build` directly for that work",
    )
    expect(loaded.selectorInstructions).toContain(
      "Select `researched-planned-delivery` when one coherent load-bearing external web-evidence gap",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "derive the obligations yourself, including the ones no implementation Artifact mentions",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain("complete Task-element analysis")
    expect(loaded.promptProfile.agents["solution-architect"]).toContain(
      "individually falsifiable Slice-local acceptance specs",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "exact current RequirementSet and Architect/Delivery Slice acceptance-spec Artifacts",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain("criterion-by-criterion coverage")
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain("record passed, failed, or unresolved")
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "compare the required operation with the current projected Agent and Tool inventory",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain(
      "A missing fact is discovery work, not automatically a rejection condition",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain("finite authority-candidate ledger")
    expect(loaded.promptProfile.agents["solution-architect"]).toContain("authority-field effect ledger")
    expect(loaded.promptProfile.agents["implementation-engineer"]).toContain(
      "Missing a dedicated field never authorizes a different surrogate mutation",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "independently rebuild the finite authority-candidate ledger",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "omitted effects, extra or surrogate mutations, wrong identities, stale precedence",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "When the dynamic business-entity trigger applies, additionally report authority-ledger closure",
    )
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain(
      "Require row-for-row coverage of every material source field/value, in-scope entity",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain(
      "When a dynamic current process, policy, template, backlog, or history decides actions for a set of business entities",
    )
    expect(loaded.promptProfile.agents["solution-architect"]).toContain(
      "Ordinary repository/software delivery retains its normal Requirement and Slice-local acceptance contract",
    )
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain(
      "immutable `advanced/acceptance-inventory` and current `advanced/test-report`",
    )
    expect(loaded.promptProfile.agents["source-investigator"]).toContain(
      "A keyword-filtered empty record read proves only that filter",
    )
    expect(loaded.promptProfile.agents["implementation-engineer"]).toContain("authority-field effect ledger")
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "Publish that frozen baseline first as one `advanced/acceptance-inventory` Artifact",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "Include the independent authority-field effect ledger only when the dynamic business-entity trigger applies",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "First find that exact acceptance inventory through `artifact_search`, completely read it through `artifact_read`, and select it through `artifact_select` in the current physical Turn",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "current-Turn `artifact_read_ref` for the acceptance inventory and every semantically used RequirementSet, Architect, implementation, and prior test-owned Artifact in `source_read_refs`",
    )
  })

  test("projects workflow execution followed by independent verification and a separate research graph", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(basePackageRoot)
    expect(loaded.promptProfile.agents.orchestrator).toContain("workflow_subject.kind=virtual_workflow")
    expect(loaded.promptProfile.agents.orchestrator).toContain("read_agent_message")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "must not add a durable report, evidence package, or coordination Artifact",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "The source-planned workflow's declared `base/implementation-plan` is its only planning Artifact",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "That visible final is the Orchestrator coordination boundary",
    )
    expect(loaded.selectorInstructions).toContain("Select `source-planned-execution-verification`")
    expect(loaded.readmeContent).toContain(
      "after every `execution_authority` condition and every observed `applicable_constraint` material to that create are resolved",
    )
    expect(loaded.readmeContent).toContain(
      "must give one consistent actor and requested-owner binding",
    )
    expect(loaded.selectorInstructions).toContain(
      "when an irreversible external mutation depends on current source authority absent from the original request",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Planner brief may assign only those source values, source obligations traceable to an exact original-request clause",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "split every requested outcome into current source values and destination expression",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("`dispatch_agent` accepts exactly `{ dispatch }`")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "For `manage_task`, follow the exact schema visible in the current Turn",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "deduplicate every evidence locator by its exact source-specific identity",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "material values needed to form the mutation—such as its name, schedule, URL, identifier, exclusion",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "This is a `destination_execution_dependency`, owned by Developer rather than Planner",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "never accept it as `execution_authority` or fail the Task before Developer evaluates the executable path",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("one per-record obligation matrix")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "a notification or report cannot replace the authorized mutation",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "first evidence actions to query exact `artifact_types: [\"base/implementation-plan\"]`",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "own only read-only facts that the original request or an observed authority makes necessary",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Map resolved obligations to exact source record IDs",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "`outcome_semantic`: the requested audience, content, status, destination identity, targeting, representation, mutation, or readback",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "`destination_execution_dependency`: an object, reference, container, capability, or state transition",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Do not query destination inventories or classify a missing destination dependency as source `execution_authority`",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "A terminal source state remains eligible for an action or template whose trigger exactly names that state",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "a current observed rule that controls a concrete effect of the mutation",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "only a lookup trigger: it is never a ledger fact, class, origin",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Do not create a residual “broader,” “remaining,” or “complete” abstract-guidelines item",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "one monotonic source frontier containing unresolved `execution_authority`, observed `applicable_constraint`, and an explicit original-request lookup trigger",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "When the loaded client supports structured batching, make the first client invocation one read-only batch",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "The lookup trigger is pending retrieval work, never a ledger fact, invented rule, or open-world blocker",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "When no item or pending transition remains, serialize the concise plan as strict valid JSON, publish it once",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "already-identified finite eligible worklist and necessary attempts are complete",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "discovering a missing contract, consuming one untried eligible attempt, resolving or excluding returned candidates",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Admit a later anchor only when authority identifies it as the requested entity's ID",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Agent-authored delegation alone cannot introduce an item",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Preserve concise evidence for empty results, excluded candidates, corrected failures, conflicts, and unavailable routes",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "requests the largest contract-valid bounded result set up to 20",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "record `mutation_preconditions` per independent mutation from the original request",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain("`Mutation preconditions:`")
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "The visible final Message is the Orchestrator's required coordination projection",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "one compact entry per source obligation in this exact information order",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "observed concrete coverage | resolved value/rule or exact unresolved fact",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "never becomes a source obligation merely because a brief prefixes it with “source-side”",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "An abstract user phrase such as current guidelines, policy, requirements, or instructions is only a lookup trigger",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Search beyond that record only when the original request names another exact source or document",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "A general instruction to make reasonable assumptions never waives an explicit approval",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "explicitly attributed `Original user input` or complete `SYSTEM`/`USER` business block",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "A first call-shape, argument-validation, or contract `TypeError` requires one contract-correct call",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "begin with one minimal discriminative source-owned entity",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "try it on every still-open candidate endpoint for that obligation",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain("`Checked source coordinates:`")
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "its non-secret typed status and candidate count or concise applicability result",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "never project credentials, authorization values, or secret-bearing URLs or parameters",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "A typed-unavailable route remains closed unless new actionable evidence changes it",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "remove the residual claim during reconciliation and dispatch the resolved operation to Developer",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "do not continue Planner for the same abstract scope",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Name that endpoint, anchor, or classification in the continuation",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "instead of asking for new products or broad source families",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "the operator-authored request inside the original Task input is the complete delivery and acceptance subject",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Agent-authored delegation may refine only from that intent, current authority, an applicable public contract",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "make one contract-correct read instead of replaying it",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain("Maintain a monotonic verification frontier")
    expect(
      loaded.manifest.capability_projection.virtual_workflows["source-planned-execution-verification"]?.nodes[
        "base-planner"
      ]?.description,
    ).toContain("Separates execution-authority conditions, applicable constraints, and Developer-owned outcome semantics")
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Before any Skill lookup or client call, read the original Task input",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "the first two evidence Tool calls are `artifact_search` with exact `artifact_types: [\"base/implementation-plan\"]`",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "do not repeat Planner endpoint-directory discovery or abstract-title searches",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Re-read once each exact current dynamic value that directly controls the mutation",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Include the smallest such step in the authorized execution closure",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Treat a processed marker as completing only the exact current operation",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "do not fail merely because the requested operation required a minimal supporting destination record or state transition",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain("Verify every column")
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "treat each omitted material source value as a plan/classification gap",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "An exhausted but unresolved authority prerequisite is a blocker",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "selected workflow node explicitly declares that exact Artifact type",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain("`Verification coordinates:` section")
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Treat a current authoritative operational record with concrete rules",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "A final-state rule is verified by comparing its source with the final state",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "a later empty or noisy title search does not invalidate positive evidence already read",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Query each traceable source obligation independently",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "An empty compound or full-phrase query must be replaced by the same endpoint's minimal anchor",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "When an exact destination identity filter is sufficient",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "State each material source record already bound to an original obligation",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "do not perform endpoint-directory or capability discovery before trying it",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "put that literal value in the visible post, message, or content body",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "`applicable_constraint` binds current observed rules to their exact controlled effects",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "the loaded client contract supports structured batching",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "use one combined endpoint-contract discovery for independent missing capabilities",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "blocks that prerequisite; report the exact change instead of starting broad source discovery",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "return that exact source blocker without repeating the Planner's source discovery",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "report the exact inconsistency without mutating its dependent operation",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Continue every independent mutation whose real source prerequisites are resolved",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "do not stop merely because the create interface has no separate targeting field",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Ignore a source plan's ungrounded “broader” abstract residual",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "require every published description, request field, and response field about actor or owner to be mutually consistent",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "one API-native service/resource/action/owner-field query that excludes audience wording and business content",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "If it differs, do not create again",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "A response containing only an ID or acknowledgement remains valid",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Make at most one bounded read-only discovery for a correction or rollback contract",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Preserve every external mutation attempt's exact Tool receipt",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Never omit an unintended committed mutation merely because a later mutation reached the requested target",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain("Do not copy response bodies")
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "every mutation attempt's receipt identity and classification",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "every prior committed side effect that remains unresolved",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "query for a Skill only when the Task input provides no exact name",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain("Return one concise visible final message")
    expect(loaded.promptProfile.agents["base-tester"]).toContain("exact method, URL, and parameter shape")
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "Do not repeat endpoint discovery for a complete current coordinate",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "A compound/full-phrase empty query is an incomplete attempt until the same endpoint receives that minimal anchor",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Dispatch Developer for each mutation whose reconciled source obligations are resolved",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "classifies an outcome semantic as a source obligation",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "never waives an explicit approval, prohibition, eligibility, opt-out, retention",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "never waives an explicit approval, prohibition, eligibility, opt-out, retention, or other authority condition",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Other independent mutations whose reconciled source obligations are resolved continue",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "ignore incidental related entities",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "does not require a second product projection for every satisfied fact",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "the loaded client contract supports structured batching",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain("process, approval, or historical rules")
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "the original request and corresponding source surface",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "Use every admitted anchor once against each still-open candidate authority endpoint",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "retain a shared organization or account name when the request, current authority, or source contract establishes it as source-owned",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "When an exact destination identity filter is sufficient",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "do not invent a structured targeting control for an organic content action",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "selected workflow node explicitly declares that exact Artifact type",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "completely read the canonical `base/implementation-plan` as source coordinates",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "verify that value in the visible post, message, or content body",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "A hidden metadata value alone is insufficient",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "`outcome_semantic` is judged through the actual destination interface",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "absence of a separate targeting field is not a failure",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "An abstract guidelines/policy/requirements/instructions phrase is a lookup trigger",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "Account for every Host-recorded mutation receipt before judging the outcome",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "a later correct mutation does not erase an earlier committed extra effect",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "or definite later mutation, operation-outcome, or rollback evidence",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "only when the API contract defines that successful response as a synchronous commit",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Never ask a worker to repeat a successful irreversible create",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Before the first worker dispatch, do not search for, load, or inspect that Skill merely to confirm its name",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Never pass a wake Artifact ID to `read_task_message`",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "do not call `artifact_search`, `artifact_read`, or `artifact_select` for `base/implementation-plan`",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "The sum of all `evidence_reads.limit` values in one call is at most 30000 characters",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "when conflicting evidence leaves one material coordination or acceptance question",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("copy them verbatim into the Tester brief")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "tell Tester to completely read the same plan as source coordinates",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Planner brief may assign only those source values, source obligations traceable to an exact original-request clause",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Never hypothesize a source taxonomy, policy field, proof channel, platform control",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "use `evidence_reads` to retrieve each complete non-secret output before dispatching Tester",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "A full successful mutation receipt is authoritative operation evidence",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "inspect its causal inventory for every mutation command",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "never select only the final successful receipt",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "or definite later mutation, operation-outcome, or rollback evidence",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("causal Tool Message and Part identities")
    expect(loaded.promptProfile.agents.orchestrator).toContain("`evidence_reads`")
    expect(loaded.promptProfile.agents.orchestrator).toContain("`inventory_next_before`")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "does not require the same page cursor again",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "do not label that combined shape the uniquely required readback",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("may prove a final-state obligation")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "present the original criteria neutrally and supply positive executor observations only as coordinates",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "the Tester independently judges every material negative claim",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "do not search the Artifact catalog for a report that the workflow did not create",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Do not continue Tester against the same exhausted read surface",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Complete only when every original obligation is satisfied",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("call the real `fail_task` decision")
    expect(workflowNodes(loaded, "execution-verification")).toEqual({
      "base-developer": [],
      "base-tester": ["base-developer"],
    })
    expect(workflowNodes(loaded, "source-planned-execution-verification")).toEqual({
      "base-planner": [],
      "base-developer": ["base-planner"],
      "base-tester": ["base-developer"],
    })
    expect(workflowNodes(loaded, "planner-parallel-delivery")).toEqual({
      "base-planner": [],
      "base-researcher": ["base-planner"],
      "base-developer": ["base-planner"],
      "base-tester": ["base-developer"],
    })
    expect(loaded.manifest.capability_projection.agents["base-planner"]).toMatchObject({
      base_role: "delegated-worker",
      description:
        "Classifies and resolves only traceable pre-mutation execution authority and applicable source constraints, while leaving destination outcome semantics and contract-required execution dependencies to Developer, or allocates a justified parallel research and implementation partition.",
    })
    expect(
      loaded.manifest.capability_projection.virtual_workflows["source-planned-execution-verification"]?.nodes[
        "base-planner"
      ]?.description,
    ).toContain("Developer-owned outcome semantics")
    expect(
      loaded.manifest.capability_projection.virtual_workflows["source-planned-execution-verification"]?.nodes[
        "base-developer"
      ]?.description,
    ).toContain("Reconciles per-operation source classes with original authority")
    expect(
      loaded.manifest.capability_projection.virtual_workflows["source-planned-execution-verification"]?.nodes[
        "base-tester"
      ]?.description,
    ).toContain("Independently checks source classifications and coordinates against original authority")
    expect(agentCapabilityGrants(loaded.manifest, "base-planner").explicitBuiltInToolIDs).toEqual([
      "bash",
      "capability_search",
      "external_code_search",
      "glob",
      "read",
      "search_code",
      "skill",
      "webfetch",
      "websearch",
    ])
  })

  test("resolves the exact Base Planner publication and read surface", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "base" },
          mcp: { browser: BrowserMCPBuiltin.localConfig() },
        })
        const projection = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "base-planner",
        })
        expect([...projection.workerCapability.builtInToolIDs].sort()).toEqual([
          "artifact_publish",
          "artifact_read",
          "artifact_search",
          "artifact_select",
          "artifact_snapshot",
          "bash",
          "capability_search",
          "external_code_search",
          "glob",
          "publish_interactive_artifact",
          "read",
          "search_code",
          "skill",
          "webfetch",
          "websearch",
        ])
      },
    })
  })

  test("resolves grill-me on the exact Advanced Requirement Engineer turn surface", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "advanced" },
          mcp: { browser: BrowserMCPBuiltin.localConfig() },
        })
        const turn = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "requirement-engineer",
        })
        const worker = turn.workerCapability
        const surface = await SkillMount.resolve({
          identity: { ...worker.identity, expertSquadID: worker.expertSquadID },
          runtime: worker.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: turn.skillProjection,
          availableToolNames: worker.builtInToolIDs,
        })

        expect(worker.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
          { ref: "default/skill/grill-me", source: "default" },
          { ref: "advanced/shared/method", source: "package" },
        ])
        expect(surface.skills.map((skill) => ({ name: skill.name, enabled: skill.enabled }))).toEqual([
          { name: "advanced-delivery-method", enabled: true },
          { name: "grill-me", enabled: true },
        ])
      },
    })
  })

  test("mounts an operator Skill onto dispatchable universal-build and serves it on that real turn", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const skillDirectory = path.join(project.path, ".opencorvus", "skill", "turn-visible-probe")
        await fs.mkdir(skillDirectory, { recursive: true })
        await fs.writeFile(
          path.join(skillDirectory, "SKILL.md"),
          [
            "---",
            "name: turn-visible-probe",
            "description: Probe Skill used to prove an operator mount reaches a real projected turn.",
            "---",
            "",
            "# Probe",
            "",
            "Body.",
            "",
          ].join("\n"),
          "utf8",
        )
        await SkillManager.refreshDiscoveryState()

        // The matrix is the operator surface. `universal-build` was absent from it, so it could not
        // be granted a Skill at all — while still being the worker an Advanced Task dispatches
        // directly for bounded implementation.
        const discovered = await SkillMount.matrix({ expertSquadID: "advanced" })
        expect(discovered.agents.find((agent) => agent.agent_id === "universal-build")).toMatchObject({
          base_role: "build",
          capability_owner: "platform",
          skill_mountable: true,
          skill_tool_available: true,
        })
        expect(discovered.agents.filter((agent) => agent.capability_owner === "package").length).toBe(
          discovered.agents.length - 1,
        )

        const mounted = await SkillMount.setOverride({
          scope: "project",
          expertSquadID: "advanced",
          agentID: "universal-build",
          defaultSkillRef: "default/skill/turn-visible-probe",
          override: true,
        })
        expect(
          mounted.matrix
            .find((row) => row.agent_id === "universal-build")!
            .grants.find((grant) => grant.ref === "default/skill/turn-visible-probe"),
        ).toMatchObject({ effective: true, enabled: true, project_override: true })

        // A matrix row is not proof. Resolve the projection the way a dispatched turn does and
        // require the Skill on that worker's own surface.
        // The turn resolves the *active* profile, so the override under `advanced` only applies
        // when `advanced` is the active one — matrix() takes an explicit id, a dispatched turn does not.
        const config = { ...(await Config.get()), prompt_profile: { active: "advanced" } }
        const turn = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "universal-build",
        })
        const worker = turn.workerCapability
        const surface = await SkillMount.resolve({
          identity: { ...worker.identity, expertSquadID: worker.expertSquadID },
          runtime: worker.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: turn.skillProjection,
          availableToolNames: worker.builtInToolIDs,
        })
        expect(surface.skills.map((skill) => ({ name: skill.name, enabled: skill.enabled }))).toEqual([
          { name: "turn-visible-probe", enabled: true },
        ])
      },
    })
  })

  test("mounts an operator Skill onto the real scheduler, Base Planner, and Advanced source investigator surfaces", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const skillDirectory = path.join(project.path, ".opencorvus", "skill", "authority-read-probe")
        await fs.mkdir(skillDirectory, { recursive: true })
        await fs.writeFile(
          path.join(skillDirectory, "SKILL.md"),
          [
            "---",
            "name: authority-read-probe",
            "description: Read-only authority probe for projected scheduler and source turns.",
            "---",
            "",
            "# Authority read probe",
            "",
            "Read current authority before judging delivery.",
            "",
          ].join("\n"),
          "utf8",
        )
        await SkillManager.refreshDiscoveryState()

        const baseDiscovered = await SkillMount.matrix({ expertSquadID: "base" })
        expect(baseDiscovered.agents.find((agent) => agent.agent_id === "orchestrator")).toMatchObject({
          base_role: "orchestrator",
          capability_owner: "package",
          skill_mountable: true,
          skill_tool_available: true,
        })
        expect(baseDiscovered.agents.find((agent) => agent.agent_id === "base-planner")).toMatchObject({
          base_role: "delegated-worker",
          capability_owner: "package",
          skill_mountable: true,
          skill_tool_available: true,
        })
        for (const agentID of ["orchestrator", "base-planner"]) {
          await SkillMount.setOverride({
            scope: "project",
            expertSquadID: "base",
            agentID,
            defaultSkillRef: "default/skill/authority-read-probe",
            override: true,
          })
        }
        const baseConfig = Config.Info.parse({
          ...(await Config.get()),
          prompt_profile: { active: "base" },
          mcp: { browser: BrowserMCPBuiltin.localConfig() },
        })
        const baseSkillProjection = await PromptProfileResolver.resolveSkillProjection({
          projectDirectory: project.path,
          config: baseConfig,
        })
        const baseScheduler = baseSkillProjection.projectedScheduler
        const baseSchedulerSurface = await SkillMount.resolve({
          identity: { ...baseScheduler.identity, expertSquadID: baseSkillProjection.expertSquadID },
          runtime: sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config: baseConfig })),
          scope: "session",
          projectDirectory: project.path,
          skillProjection: baseSkillProjection,
          availableToolNames: baseScheduler.builtInToolIDs,
        })
        expect(baseSchedulerSurface.skills).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "authority-read-probe", enabled: true })]),
        )
        const basePlannerTurn = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config: baseConfig,
          agentID: "base-planner",
        })
        expect(basePlannerTurn.workerCapability.builtInToolIDs).toEqual(expect.arrayContaining(["bash", "skill"]))
        const basePlannerSurface = await SkillMount.resolve({
          identity: {
            ...basePlannerTurn.workerCapability.identity,
            expertSquadID: basePlannerTurn.workerCapability.expertSquadID,
          },
          runtime: basePlannerTurn.workerCapability.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: basePlannerTurn.skillProjection,
          availableToolNames: basePlannerTurn.workerCapability.builtInToolIDs,
        })
        expect(basePlannerSurface.skills).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "authority-read-probe", enabled: true })]),
        )
        const explicitlyActivatedBasePlannerSurface = await SkillMount.resolve({
          identity: {
            ...basePlannerTurn.workerCapability.identity,
            expertSquadID: basePlannerTurn.workerCapability.expertSquadID,
          },
          runtime: basePlannerTurn.workerCapability.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: basePlannerTurn.skillProjection,
          availableToolNames: basePlannerTurn.workerCapability.builtInToolIDs,
          explicitSkillNames: ["base-delivery-method"],
          activeSkillNames: ["authority-read-probe"],
        })
        expect(explicitlyActivatedBasePlannerSurface.skills.map((skill) => skill.name).sort()).toEqual([
          "authority-read-probe",
          "base-delivery-method",
        ])
        await expect(
          SkillMount.resolve({
            identity: {
              ...basePlannerTurn.workerCapability.identity,
              expertSquadID: basePlannerTurn.workerCapability.expertSquadID,
            },
            runtime: basePlannerTurn.workerCapability.runtime,
            scope: "session",
            projectDirectory: project.path,
            skillProjection: basePlannerTurn.skillProjection,
            availableToolNames: basePlannerTurn.workerCapability.builtInToolIDs,
            explicitSkillNames: ["unprojected-skill"],
          }),
        ).rejects.toBeInstanceOf(SkillMount.ExplicitSkillProjectionError)

        const discovered = await SkillMount.matrix({ expertSquadID: "advanced" })
        expect(discovered.agents.find((agent) => agent.agent_id === "orchestrator")).toMatchObject({
          base_role: "orchestrator",
          capability_owner: "package",
          skill_mountable: true,
          skill_tool_available: true,
        })
        expect(discovered.agents.find((agent) => agent.agent_id === "source-investigator")).toMatchObject({
          base_role: "delegated-worker",
          capability_owner: "package",
          skill_mountable: true,
          skill_tool_available: true,
        })

        for (const agentID of ["orchestrator", "source-investigator"]) {
          await SkillMount.setOverride({
            scope: "project",
            expertSquadID: "advanced",
            agentID,
            defaultSkillRef: "default/skill/authority-read-probe",
            override: true,
          })
        }

        const effectiveConfig = Config.Info.parse({
          ...(await Config.get()),
          prompt_profile: { active: "advanced" },
          mcp: { browser: BrowserMCPBuiltin.localConfig() },
        })
        const skillProjection = await PromptProfileResolver.resolveSkillProjection({
          projectDirectory: project.path,
          config: effectiveConfig,
        })
        const scheduler = skillProjection.projectedScheduler
        const schedulerSurface = await SkillMount.resolve({
          identity: { ...scheduler.identity, expertSquadID: skillProjection.expertSquadID },
          runtime: sessionRuntimeFromNativeAgent(
            await HostAgentRegistry.get("orchestrator", { config: effectiveConfig }),
          ),
          scope: "session",
          projectDirectory: project.path,
          skillProjection,
          availableToolNames: scheduler.builtInToolIDs,
        })
        expect(schedulerSurface.skills).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "authority-read-probe", enabled: true })]),
        )

        const sourceTurn = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config: effectiveConfig,
          agentID: "source-investigator",
        })
        expect(sourceTurn.workerCapability.builtInToolIDs).toEqual([
          "artifact_publish",
          "artifact_read",
          "artifact_search",
          "artifact_select",
          "artifact_snapshot",
          "capability_search",
          "publish_interactive_artifact",
          "bash",
          "glob",
          "read",
          "search_code",
          "skill",
        ])
        const sourceSurface = await SkillMount.resolve({
          identity: {
            ...sourceTurn.workerCapability.identity,
            expertSquadID: sourceTurn.workerCapability.expertSquadID,
          },
          runtime: sourceTurn.workerCapability.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: sourceTurn.skillProjection,
          availableToolNames: sourceTurn.workerCapability.builtInToolIDs,
        })
        expect(sourceSurface.skills).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "authority-read-probe", enabled: true })]),
        )
      },
    })
  })
})
