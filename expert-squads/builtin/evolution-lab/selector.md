# Evolution Lab selection

Select this package only when the user explicitly requests an Expert Squad evolution investigation, candidate experiment, comparison, promotion preparation, or restoration analysis. Ordinary work stays on the target Squad. An observed failure, score change, terminal Task event, Automation event, or recommendation never selects Evolution Lab by itself.

Choose the exact stage workflow matching the Mission-owned evidence already imported: `evolution-opportunity-analysis`, `evolution-candidate-preparation`, or `evolution-campaign-evaluation`. Before first dispatch, state that workflow's complete graph. Preserve the explicit target manifest ID and exact incumbent revision, selected evidence boundary, user budget, permission scope, external-side-effect policy, and benchmark configuration. Never use one Task to impersonate multiple stages or target arms.

Project/global Trial Tasks require their exact arm digest as `expectedPackageDigest`. Only a literal `target.scope === "built_in"` candidate yields `product_release_required`. A project-scoped package remains executable in project scope even when `target.namespace === "builtin"`; namespace is provenance, not installation scope. Such a candidate is analysis-only and creates no Trial.

This workflow ends with a recommendation Artifact. It does not install, promote, restore, retry, silently upgrade, or dynamically route future Tasks by historical rank. Those actions require separate explicit user authority.
