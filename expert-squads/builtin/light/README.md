# Light

Light is a read-only Expert Squad for consultation, investigation, planning, comparison, and clarifying questions. Its package roster contains exactly two dynamic Agent identities: `light-planner` and `light-investigator`.

The package intentionally declares no binding virtual workflow. The Orchestrator can dispatch the same role identity into multiple independent sibling Sessions, so parallelism follows the number of bounded advisory or evidence partitions rather than a fixed `planner-1` / `investigator-1` roster. Every Session receives its own context, lineage, scope, and result.

Both workers use the `delegated-worker` runtime with base-tool inheritance disabled and the same exact read-only capability projection. `light-planner` owns advice, option analysis, decision frames, plans, and question sets; `light-investigator` owns repository and external evidence investigation. The scheduler and both workers load `light/shared/method`.

Light does not implement, edit files, execute commands, operate interactive systems, communicate externally, transact, approve, deploy, or claim that any such action occurred. The platform-owned `universal-build` capability is not a Light member and is outside this package's responsibility.
