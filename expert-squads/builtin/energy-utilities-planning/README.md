# Energy and Utilities Planning

Demand, supply, reliability, cost, and emissions evidence joined into a bounded utility scenario register.

Run the demand-supply, reliability-contingency, and cost-emissions branches independently, then dispatch the join owner only after all three reports exist. Every scheduler and worker uses `energy-utilities-planning/shared/method`.

The Skill saves three domain assets: `utility-scenario-register.md`, `demand-energy-capacity-balance.md`, and `reliability-contingency-review.md`. Each preserves units, sources and versions, owners, uncertainty, applicability, formulas, and infeasible cases. `references/clean-room-authoring.md` records authorship and the requirement to refresh authoritative local criteria.

Never dispatch a grid, trade energy, set tariffs, issue engineering or safety approval, claim regulatory compliance, or provide investment advice. Keep all scenarios non-operational and require authorized utility, engineering, market, safety, legal, and regulatory review.
