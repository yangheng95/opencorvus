---
name: semiconductor-yield-engineering-method
description: Build traceable semiconductor lot-wafer-die genealogy, yield, wafer spatial, parametric, SPC, and excursion evidence packs. Use for first-pass/final yield reconciliation, bin Pareto, equipment comparison, process capability review, and qualified disposition preparation without changing processes or executing holds, release, scrap, or rework.
---

# Semiconductor Yield Engineering Method

## Freeze the basis

1. Record product/revision, fab/module/step, mask/recipe/test-program/limit revisions, lot-wafer-die coordinates, retest/rework/disposition rules, window/time zone, units, genealogy sources, confidentiality and qualified owners.
2. Assign stable IDs to product, lot, wafer, die, process event, tool/chamber, test event, bin, measurement, source and decision.
3. Run genealogy, wafer/bin/parametric, and SPC/excursion analysis independently. Join only reconciled, source-addressable outputs.

## Apply the method

- Preserve first-pass records and final disposition separately. Reconcile gross, eligible, tested, invalid, excluded, good, failed and untested sets using declared membership.
- Compute first-pass yield as first-pass good unique eligible die divided by first-pass tested unique eligible die. Compute final yield separately under the supplied retest rule. Reconcile bins to the applicable population.
- Analyze edge/center, radial, quadrant, row/column and site patterns only when coordinate orientation and zone rules are declared. Account for spatial autocorrelation and multiple comparisons.
- Keep specification limits separate from control limits. Use a qualified baseline and rational subgrouping for SPC.
- Report Cp/Cpk with within-subgroup sigma and Pp/Ppk with overall sigma only when stability, distribution, measurement-system and independence assumptions are supported.
- Stratify tool, chamber, tester and site comparisons by product, revision, time, loading and sampling. Correlation is not cause.
- Preserve the declared observation cutoff and final disposition status in every comparison.

## Produce evidence

Use all five assets: genealogy ledger, yield/bin/wafer register, SPC equipment comparison, excursion hypothesis/experiment register, and review pack. Every material row includes ID, unit, source/version/date, owner/reviewer, applicability, uncertainty, assumptions and decision status.

Stop on broken genealogy, unknown denominator or retest semantics, unreconciled bins, mixed units/revisions, unqualified baseline, insufficient sample support, or unauthorized confidential data.

## Review discipline

- Freeze raw first-pass observations before applying retest or final-disposition semantics. Never replace a failed first-pass die with its later result.
- Reconcile unique die sets and bin totals before producing any Pareto, wafer map, capability index or equipment comparison.
- Preserve die orientation, notch convention, excluded edge, site and coordinate provenance so that spatial patterns can be reproduced and challenged.
- Separate engineering specification, guard band, screening rule, control limit and observed distribution. Each needs its own source, version and accountable owner.
- Report sampling imbalance, missingness, measurement-system limitations, subgroup changes, multiple comparisons and spatial dependence alongside each signal.
- Build at least one credible competing hypothesis and a discriminating evidence request; do not promote tool, chamber, tester, recipe, material or operator association to cause.
- At the join, state affected product/lot/wafer scope and the hold, release, scrap, rework, shipment or process decision that remains with qualified owners.

## Authority boundary

Do not change recipes, equipment, test programs, specifications, control limits or sampling; do not execute hold, release, scrap, rework or shipment; do not write manufacturing systems. Require qualified product, process, test, yield, equipment, quality, manufacturing and EHS review.

This is a clean-room method. Read [source record](references/sources.md) for primary method inputs and the rejected Skill decision; do not copy rejected Skill text.
