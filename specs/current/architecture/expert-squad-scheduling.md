# Expert identity, capabilities and optional scheduling guidance

Expert Squads define identity and authorized capabilities. A Task freezes its selected package revision and projects exact Agent identities, runtime templates, tools and Skills from that revision. A label, generated expert name, workflow node or role description cannot replace the projected Agent identity or enlarge its grants.

Without an explicit Squad selection, the native creator first searches installed canonical candidates through its occurrence-bound `capability_search` and reads promising candidates with the directly available `panel_expert_squad_inspect`. It prefers a Squad only when the complete outcome, actual capabilities, ownership and acceptance boundary are very well matched. If candidate search and inspection establish no very well matched Squad, it selects the embedded `dynamic` package to generate Task-local experts. This decision belongs to the real streamed creator conversation before Task package binding; the Host does not classify prose, choose a fuzzy winner or add a selection gate.

The canonical configuration default is Dynamic, so the generation capability is available without an external payload install. That default does not instruct creators to skip search. Explicit operator selection wins; existing Tasks retain their immutable package bytes. Dynamic generates Task-local expert names, responsibilities, effect boundaries and expected results, then maps each expert to its real `dynamic-generalist` or `dynamic-builder` capability envelope and independent Session/dispatch. It does not generate a second runtime identity, silently install a package or change the Task's selected Squad. Persistent package authoring remains an explicitly selected Generate Expert Squads capability.

The low-level SDK/HTTP `task.create` and model-facing `panel_create_task` require an exact creator-selected `promptProfile`. They freeze identity and execute the request; they do not perform hidden model selection. SDK clients wanting automatic selection submit the original request to a native Work/Chat/Control conversation or Mission, where search, candidate inspection and the eventual creation Tool are real visible participant facts. Conversation catalog publication exposes installed Squad candidates only to a caller already granted Task creation; running fixed-package Tasks keep their own capability projection. Mission search remains inside its immutable held set.

## Scheduling

The Orchestrator chooses useful responsibilities and actual input dependencies from the original request, current evidence, permissions, capacity and workspace ownership. It may use a Directed Acyclic Graph (DAG), parallel branches and joins, conditional alternatives, local investigation/repair loops, or a mixture. New evidence may change the partition and order. A local continuation reuses the exact responsible dispatch/Session; a new independent responsibility gets a new initial dispatch, even when it uses the same projected Agent or suggested node.

`capability_projection.virtual_workflows` is optional reference guidance. Omission normalizes to an empty collection through the canonical SDK schema. A reference never requires selection, all nodes, a fixed order, one initial occurrence per node, or exclusive use for the Task. Its `depends_on`, `when` and `repeat_until` fields describe possible input, choice and stopping considerations for the model. The Host does not evaluate conditions, execute graphs, infer the next tool, run all alternatives, count semantic iterations or persist workflow state.

An optional dispatch `turn.workflow_subject` records reference provenance. Omission uses direct dispatch. Different references, repeated referenced nodes and direct dispatch may coexist in one Task. Immutable snapshots remain attached to their actual dispatch; they are not a Task-wide binding. The optional completion `workflow_id` has the same reference meaning. Actual acceptance depends on user obligations, relevant capability evidence contracts, independent review and usable delivery resources.

## Execution identity and recovery

Each initial Tool invocation/member has one deterministic dispatch identity, fenced admission owner, independent Session and occurrence. Exact replay and cross-process takeover reuse the same Tool/member occurrence. A continuation validates its exact source lineage, package/Agent/work scope and Session and preserves the existing occurrence. Task epochs, cancellation, terminal settlement, resource ownership and Project isolation retain their existing authorities. Suggested nodes have no unique admission index or scheduling fence.

Task context exposes flat actual `dispatch_execution` facts with exact dispatch, Session, occurrence, settlement and final Message identities. Optional reference metadata is attributable context. It does not compute a dependency-ready frontier or manufacture unexecuted node state.

Mission acceptance ledgers retain exact Task/epoch, evidence, criteria and historical responsible identity. A historical workflow responsibility explains the reviewed provenance; it does not restrict repair to graph descendants or a selected workflow. The Orchestrator may assign a capable producer or independent verifier to the explicit open criteria. The Host validates the real gap/criterion/epoch and actual dispatch authority, rather than deciding semantic ownership from a reference graph.

Completion seals actual package-owned worker output locators in `worker_artifact_locators`; it does not identify delivery by terminal graph nodes. Intentionally delivered resources remain explicit `deliverable_artifact_locators`. Settled worker results remain claims to evaluate, and ordinary Host lifecycle/integrity checks remain unchanged.

This change removes the old node-uniqueness index and adds the current completion-payload integrity trigger to canonical `SCHEMA_DDL`. Under the repository's existing pre-release persistence contract, an older database reports `SCHEMA_RESET_REQUIRED` before business reads and requires explicitly authorized rebuilding. No migration, silent reset, payload conversion or compatibility reader is supplied. Existing running application processes and Tasks have not been modified by this source change.

## SDK authoring examples

The Software Development Kit (SDK) exports the canonical manifest, authoring validator, writer and optional workflow schemas from `@opencorvus-ai/sdk/expert-squad-authoring`. Package authors supply identity, projected capability refs, scheduler/worker prompts and required resources. They can omit `virtual_workflows` entirely:

```ts
const capability_projection = {
  scheduler: {
    base_role: "orchestrator",
    capability_refs: ["capability:tool:platform:tool-registry:dispatch_agent"],
    prompt: "agents/orchestrator/system.md",
  },
  agents: {
    "source-expert": {
      label: "Source expert",
      description: "Investigates a bounded source question and reports attributable evidence.",
      base_role: "delegated-worker",
      capability_refs: [
        "capability:tool:platform:tool-registry:read",
        "capability:tool:platform:tool-registry:webfetch",
        "capability:tool:platform:tool-registry:websearch",
      ],
      prompt: "agents/source-expert/system.md",
    },
  },
}
```

A useful reference can name `strategy: "adaptive" | "dag" | "loop" | "choice"` and optional `guidance`. Nodes name exact declared capability identities. For example, a local refinement loop may use two independent instances of one capability:

```json
{
  "refinement": {
    "label": "Evidence refinement",
    "description": "Produce a candidate and independently review its source support.",
    "strategy": "loop",
    "guidance": "Continue only when a new useful action can resolve an actual acceptance gap.",
    "nodes": {
      "candidate": {
        "agent_id": "source-expert",
        "description": "Investigate the current candidate.",
        "depends_on": ["review"],
        "repeat_until": "The required claim is supported or the exact blocker is established."
      },
      "review": {
        "agent_id": "source-expert",
        "description": "Independently inspect the candidate and its original evidence.",
        "depends_on": ["candidate"],
        "when": "A candidate and its source evidence are actually available."
      }
    }
  }
}
```

Validation checks reference identity/closure and canonical dependency lists. Only an explicitly declared `dag` strategy requires an acyclic graph. `loop`, `choice` and `adaptive` guidance may include cycles; topology analysis reports `adaptive_graph` with null DAG depth/parallel-width metrics when no DAG measure exists. These values are unavailable structural measures, not zero execution progress.

`expert_squad_author` and supported heterogeneous import use the same optional schema and preserve strategy/condition/repeat guidance. `ExpertSquadCollaborationStage.workflow_id` is also optional: Mission stages still identify their exact Squad and evidence inputs/outputs, without requiring a package workflow reference. The canonical writer remains the sole portable package writer; no secondary DSL, workflow engine, fallback implementation or runtime-generated manifest is introduced.
