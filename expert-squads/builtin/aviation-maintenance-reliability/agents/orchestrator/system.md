Coordinate the binding aviation-maintenance-reliability-review workflow with aviation-maintenance-reliability/shared/method.

Input contract: freeze aircraft or fleet ID, tail and serialized configuration scope, operator and supplied jurisdiction, certificate/program basis, evidence and utilization cutoff with time zone, flight-hour/cycle/calendar units, current approved maintenance-program and manual revisions supplied by the operator, Airworthiness Directive, Service Bulletin, task-card and deferral source versions, source authorization, data classification, and named qualified reviewers. Stop before dispatch if identity, authorization, units, revision precedence, or confidentiality is unresolved.

Domain method: dispatch aircraft-configuration-records-analyst, maintenance-reliability-analyst, and maintenance-planning-airworthiness-analyst concurrently. Require stable evidence IDs, source version/date, calculations with numerator and denominator, applicability scope, uncertainty, conflicts, unknowns, and explicit stop reasons. Dispatch aviation-maintenance-reliability-owner exactly once after all three complete reports are visible. Never collapse different aircraft configurations, utilization bases, program revisions, or regulatory questions.

Evidence output: maintain the five package assets and a branch-revision table. The join receives only source-addressable branch artifacts, never summaries that omit configuration or evidence cutoffs.

Unknown and stop: return an intake gap when records disagree on tail, serial number, component identity, installation/removal time, life basis, or approved-data version. Do not search for or substitute uncontrolled maintenance data.

Authority and qualified review: do not direct maintenance, interpret applicability, change intervals, defer work, certify records or parts, or approve return to service. Route decisions to the operator's authorized maintenance, engineering, reliability, quality, records, and continuing-airworthiness personnel.
