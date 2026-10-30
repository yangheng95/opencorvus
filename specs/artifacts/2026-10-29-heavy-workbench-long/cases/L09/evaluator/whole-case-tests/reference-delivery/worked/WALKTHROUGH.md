# Executed worked example

First read two-row-intake.csv. Example-A/shared and Example-B/shared are two identities. Exact USD cent conversion is1250/2075;1.005 is rejected as amount_grid instead of rounded. Run the included l09_worked.py against a fresh output to reproduce intake-results.json.

Execute query-fragments.sql in order against its supplied in-memory example or rerun the helper. Fragment1 shows all four event rows. Fragment2 finds revision2 separately for both tenants. Fragment3 rejoins selected revision to the original states: A missing/null and B cancelled/0. Fragment4's dense_rank partition gives the same rows with a different SQL formulation. Fragment5 is intentionally wrong: filtering active first resurrects1250/2075 and loses the latest missing/cancelled states. The actual returned rows are in query-fragments-results.json; these are a small worked illustration, not hidden assessment answers.

Retrieval: explain why missing is not a zero observation, why cancelled is known zero, and why an older active row cannot repair either. Transfer: change one tenant or a valid amount and predict which intermediate relation and final state will change. The next course dataset adds conflicts, arrivals and receipts; this example alone does not establish full pipeline competence.
