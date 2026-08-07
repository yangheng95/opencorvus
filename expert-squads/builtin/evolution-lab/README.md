# Evolution Lab

Evolution Lab is the target-agnostic Expert Squad for explicit incumbent-challenger evolution campaigns. It owns campaign evidence, candidate preparation, evaluation, independent integrity review, and an experiment-scoped recommendation. It never becomes a runtime dependency of the target Squad.

## Binding workflow

The package declares three stage-specific binding workflows: opportunity analysis, frozen development campaign plus candidate preparation, and two-arm evaluation plus recommendation. Mission is the only cross-Squad coordinator. It creates a new fixed-profile Task for each Evolution Lab stage and separate fixed-profile target Tasks for baseline and candidate runs, waits for terminal acceptance, and imports exact Artifacts into the next Task. Holdout and certification are new Campaign revisions created only after candidate digest fixation and never dispatch a Candidate Author. No Task changes profile and no package workflow engine is introduced.

## Self-contained closure

The package owns the strict eight-type `evolution-lab/...@1` Artifact ABI, exact run-evidence collector, immutable package materialization/comparison tool, typed Artifact publisher, portable resource rehydration tool, campaign Skill, scorer contract, role prompts, and workflow. Payloads store stable role/path/media/bytes/digest manifests instead of Task-bound snapshot locators. Each Campaign carries exactly one declared Dataset partition and its complete input closure; metric evidence and both complete parent/candidate package trees travel in the Engine Artifact resource closure. After Mission import, `rehydrate-evolution-resources` maps the copied current-Task refs back to their declared roles and rebuilds validated resource sets. Candidate packages cannot reference this package or any other Squad at runtime.

Candidate mutation is limited to the target package's validated prompt, README, selector, Skill, reference, and example text closure. Target tools, libraries, scripts, assets, Model Context Protocol resources, scorers, datasets, evaluator workspace, configuration, permissions, and Evolution Lab remain frozen.

## Authority boundary

Metrics are observations and never dispatch work. Failed measurement is typed unavailable, not zero or a substituted scorer. Required unavailable dimensions make aggregate score null. The Recommendation Owner can publish promote, retain, or inconclusive only for the frozen campaign. Promotion, restoration, retry, and installation require separate explicit user-authorized operations and immutable receipts.

Every target Trial must be created with an explicit expected package digest. A missing creation expectation is preserved as null evidence and cannot become a campaign run. Built-in candidates cannot be bound as unpublished Task revisions; their campaign declares typed `product_release_required` unavailability until a product release makes the revision addressable.
