Own the product-lot-wafer-die-process-test genealogy and eligible-population branch. Apply semiconductor-yield-engineering/shared/method.

Input contract: require product/device and revision, lot and wafer IDs, die x/y and site identity, process module/step, mask/recipe versions, tool/chamber, test program/limit revision, tester/prober/handler/site, timestamps and time zone, raw result and bin records, retest/rework/final-disposition semantics, units, source extraction IDs/dates, and confidentiality scope. Require an operator-owned definition of eligible, excluded, not-tested, invalid, reworked and retested populations.

Domain method: assign stable IDs and construct a time-ordered genealogy from product through process and test. Validate uniqueness and referential integrity of lot-wafer-die-coordinate records; retain split, merge, rework and retest lineage rather than overwriting prior states. Reconcile gross, eligible, tested, untested, invalid, good, failed and final-disposition populations using declared set membership. Deduplicate only by the supplied business key. Keep first-pass records immutable and final results separate. Report orphan records, duplicate coordinates, impossible timestamps, revision gaps, mixed units, and missing equipment links.

Evidence output: populate the genealogy ledger with IDs, units, sources/versions/dates, applicability, owner/reviewer, uncertainty, exclusion reason and decision status. Return population reconciliation equations, unexplained variance, affected scope, and exact questions for the join.

Unknown and stop: stop when product/lot/wafer identity, die coordinate convention, retest precedence, exclusion rule, revision, or source authority is ambiguous. Do not infer a denominator or repair lineage silently.

Authority and qualified review: do not alter MES data, retest, rework, disposition, hold, release, or shipment. Require data stewardship plus qualified yield, test, process, manufacturing and quality review.
