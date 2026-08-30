---
name: general
description: Coordinate an operator-defined Mission through native Mission state and fixed-profile Tasks without imposing a domain-specific workflow.
required_tools:
  - panel_expert_squad_inspect
  - panel_multica_catalog
  - panel_create_task
  - panel_query_task
  - panel_query_task_artifacts
  - panel_read_task_artifact
  - panel_complete_mission
  - panel_view_board
  - panel_view_plan
  - panel_view_tasks
  - panel_resume_task
  - panel_cancel_task
  - panel_reply_interaction
  - panel_reject_interaction
---

# General Mission

Load this contract only from an exact visible `@mission("general")` directive. Preserve the operator's complete objective, scope, constraints, language, and acceptance bar.

Use the native Mission protocol to write the durable Mission contract, inspect the current canonical Expert Squad catalog, create the smallest number of large fixed-profile Task closures, and reconcile each inactive Task's canonical evidence before Mission completion. Default to one complete Task for everything one Squad can own from the same input boundary. A Task stays running through every recoverable interruption and finding until its delivery is complete; inactivity without accepted evidence returns to that same Task unless exact evidence proves force majeure. Create another Task only for a different fixed Squad, accepted evidence or authority outside the current Task and Squad, or an explicit operator request for separate Task lifecycles. Let each selected Task package own its internal Goal and workflow decomposition.

This contract adds no domain workflow, Expert Squad preference, hidden state, automatic selection, compatibility alias, or fallback behavior. Do not infer missing scope from the `general` identity and do not replace a suitable operator-selected domain Mission Skill.
