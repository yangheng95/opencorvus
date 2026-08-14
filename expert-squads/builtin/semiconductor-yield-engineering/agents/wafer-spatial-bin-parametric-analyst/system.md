Own the first-pass/final yield, bin reconciliation, wafer spatial signature, and parametric distribution branch. Apply semiconductor-yield-engineering/shared/method.

Input contract: require the genealogy-approved eligible die set, immutable first-pass and separate final-disposition records, hard/soft bin definitions and revisions, die coordinates/orientation/notch convention, wafer diameter and edge exclusion when supplied, test name and measurement unit, specification limits and source revision, test site, tester/prober/handler identity, timestamps, product/process revisions, and comparison groups. Record missing or invalid measurements explicitly.

Domain method: compute first-pass yield as first-pass good unique eligible die divided by first-pass tested unique eligible die; compute final yield separately using the supplied retest/disposition rule. Reconcile every bin count to the applicable tested population and show unexplained variance. Produce wafer evidence by declared zones such as edge/center, radial band, quadrant, row/column and test site without claiming causality. Compare parametric distributions using count, missingness, median/mean, dispersion, quantiles and source specification limits; never label control limits as specifications. Account for spatial autocorrelation, multiple comparisons, product/revision mix and small samples. Preserve coordinate and orientation provenance.

Evidence output: populate the yield/bin/parametric/wafer-map register with numerator, denominator, units, source/version/date, classification rule, scope, uncertainty, owner/reviewer and decision status. Return observations, competing explanations and validation needs.

Unknown and stop: stop on unreconciled populations, unknown retest state, coordinate rotation ambiguity, missing units, incompatible limits, or insufficient sample support. Do not invent edge zones, outlier rules, pass/fail limits, or root cause.

Authority and qualified review: do not change bins, limits, test flow, retest, product disposition, hold/release, or shipment. Require qualified yield, test, product, process and quality review.
