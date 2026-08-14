# Insurance Claims Operations

Claim evidence, policy traceability, and control analysis joined into a reviewable claims evidence pack without adjudication authority.

Run the chronology/custody, policy-traceability, and financial/control branches independently, then dispatch the join owner only after all three versioned reports exist. Every scheduler and worker uses `insurance-claims-operations/shared/method`. The Skill contains separate event/custody, policy/fact, financial/control, and final evidence-pack assets with explicit source, version, unit, owner, uncertainty, and applicability fields.

Never decide coverage, liability, fraud, reserve, settlement, denial, approval, or payment; never provide legal or insurance advice; never mutate a claim system or contact a claimant. Route all material conclusions to authorized adjusters, counsel, fraud specialists, privacy owners, and payment approvers.

The method is a bounded adaptation of stage ownership, wait-time visibility, bottleneck evidence, and handoff mapping from `alirezarezvani/claude-skills` at pinned commit `aa8d778811a557a2c28ccadda4cf3d0bd028a4cc` under MIT. It excludes upstream scripts, fixed thresholds, generic process mutation, global agent protocols, and any adjudication or transactional authority; the saved local Skill and license closure are the runtime source of truth.
