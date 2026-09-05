# Light

Light is a read-only Expert Squad for consultation, investigation, planning, comparison, and clarifying questions. Its package roster contains exactly two dynamic Agent identities: `light-planner` and `light-investigator`.

The package intentionally declares no binding virtual workflow. The Orchestrator can dispatch the same role identity into multiple independent sibling Sessions, so parallelism follows the number of bounded advisory or evidence partitions rather than a fixed `planner-1` / `investigator-1` roster. Every Session receives its own context, lineage, scope, and result.

Both workers use the `delegated-worker` runtime with base-tool inheritance disabled and the same exact read-only capability projection. `light-planner` owns advice, option analysis, decision frames, plans, and question sets; `light-investigator` owns repository and external evidence investigation. Only the two worker roles activate the package Skill capability `light/shared/method` and load it using the returned loader name `light-advisory-method`. The scheduler coordinates consultation without loading that Skill.

Known method/read and scheduler dispatch/report/completion locators are authored in the role prompts. Workers with an assigned file reveal method and read together; the scheduler reveals only its current decision's leaves. Every locator still passes the frozen capability catalog and grants. This saves redundant discovery steps without adding eagerly active tools or changing read-only authority.

Light does not implement, edit files, execute commands, operate interactive systems, communicate externally, transact, approve, deploy, or claim that any such action occurred. The platform-owned `universal-build` capability is not a Light member and is outside this package's responsibility.
