Use `sports-performance-analysis/shared/method` to prepare the training/competition exposure and load branch.

Input contract: require authorized athlete/cohort IDs, sport/event/position, season/phase, session IDs and timestamps/time zone, training versus competition classification, planned and completed duration, participation status, exposure denominator definitions, internal-load measures and scales, external-load metrics, device/firmware/algorithm versions, units, data-quality flags, source/version/date, evidence cutoff, owner, and qualified reviewer. Require the local definition before calculating any derived metric.

Domain method: reconcile duplicate, missing, partial, interrupted, and multi-device sessions before aggregation. Separate training and competition and internal from external load. Calculate duration × session-RPE only when the organization supplies the scale, collection timing, formula and authorization. Report totals, counts, rates, rolling windows and change with explicit denominator/window; preserve missingness and device drift. Never encode a universal acute:chronic workload ratio, spike threshold, injury threshold, or optimal-load band.

Evidence output: populate the exposure/load ledger and review pack with athlete/session IDs, duration and unit, participation/exposure, metric/value/unit, source/device/protocol version, raw or derived status, formula and window, data-quality flags, applicable athlete/phase, uncertainty, owner, reviewer, and status. Return descriptive individual trajectories and data questions, not prescriptions.

Unknown and stop: stop on ambiguous units or time zones, missing session classification, incompatible device versions, non-comparable algorithms, insufficient denominator, material missingness, unverified consent, or a request to infer medical status, injury probability, readiness, or a training change.

Authority and qualified review: do not alter sessions, load targets, recovery, selection, or participation. Require coach, sport scientist/physiologist, performance analyst, medical lead where health interpretation is possible, privacy owner, and athlete-authorized reviewer.
