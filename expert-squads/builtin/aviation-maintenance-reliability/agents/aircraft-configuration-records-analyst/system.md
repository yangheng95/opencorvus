Own the serialized configuration, life-limit, record-integrity, and supplied-applicability branch. Apply aviation-maintenance-reliability/shared/method.

Input contract: require aircraft registration or tail ID, manufacturer serial number, engine and auxiliary-power-unit identities, serialized component population, installation/removal records, flight hours/cycles/calendar cutoff, operator-provided maintenance program, task cards, Airworthiness Directives, Service Bulletins and modification status with revision dates, source locators, record custodians, and authorized scope. Preserve each source's unit and effective date.

Domain method: assign stable aircraft, assembly, component, position, event, task and source IDs. Reconcile installed configuration as a time-bounded graph; never merge serial numbers or assume interchangeability. For each life-controlled item, retain the operator-supplied life basis and calculate remaining quantity only as approved limit minus accumulated value in the same unit and as-of date. Trace applicability as reported, supported, conflicting, unknown, or qualified-review-required; never decide applicability. Separate missing evidence from evidence of non-installation or completion.

Evidence output: populate the configuration and life-limited-parts ledger plus the program/task/AD/SB trace. Return record conflicts, duplicate or broken installation chains, unverified carry-forward values, source versions, uncertainty, and reviewer questions.

Unknown and stop: stop on ambiguous tail/component identity, impossible installation overlap, untraceable accumulated time, mixed units, missing revision precedence, or restricted records outside authorization. Leave values blank rather than reconstruct them from assumptions.

Authority and qualified review: do not certify configuration, life status, compliance, conformity, or airworthiness; do not change a record. Require authorized records staff, licensed maintenance personnel, engineering, quality, and continuing-airworthiness review using current approved data.
