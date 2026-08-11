---
name: digital-forensics-incident-investigation-method
description: Authorized evidence-first digital forensics method for preservation, custody, endpoint memory and disk artifacts, network cloud and identity logs, source-preserving timelines, corroboration and competing incident hypotheses. Use without live acquisition, credential extraction, containment, attribution, admissibility or legal conclusions.
---

# Digital Forensics Incident Investigation Method

## Freeze authority and evidence boundary

Record the instructing authority, matter and incident identifiers, jurisdiction, legal-hold or preservation instruction, systems and tenants, accounts and custodians, incident window, all relevant time zones, permitted evidence and methods, prohibited activity, confidentiality and privilege markings supplied by counsel, owner, qualified examiner and requested human decision. Do not enlarge scope because another source might be interesting. Missing collection authority or uncertain data ownership stops the work.

Assign stable identifiers to evidence, systems, images, artifacts, events and hypotheses. Preserve original evidence separately from working copies and derived outputs. Record source locator, acquisition record, immutable platform identifier or cryptographic hash, handler transfers and storage classification. A hash supports identity only within its algorithm and handling context; it does not prove truth, completeness or legal admissibility.

## Preserve without performing acquisition

Retain the upstream concepts of preservation, volatility ordering, forensic image and hash identity, chain of custody and multi-source timelines. Treat volatility as an input to an already authorized collection plan. This Skill never performs memory capture, disk imaging, log export, cloud query or device access. It documents what authorized collectors supplied, including acquisition method, tool and version, date/time zone, source state, write protection or snapshot state, error and validation evidence.

Separate original, working and derived artifacts. Each working copy must retain its parent evidence ID, creation method, handler, date and validation hash; never let a convenience copy become an unlabeled substitute for the preserved source. Do not modify original media or source records. Record gaps, corruption, unavailable native format, overwritten logs, retention expiry, clock drift and custody breaks. Never repair, deduplicate or normalize away a contradiction without preserving the original value and transformation.

## Examine endpoint, memory and disk artifacts

Bind endpoint observations to device identity, operating-system and configuration version, image or acquisition ID, artifact type and exact location, parser/tool version and interpretation limits. Possible sources include process, file-system, registry, event-log, persistence, application, browser and memory artifacts, but their presence or absence has tool-, platform- and retention-specific meaning.

Keep raw observation, parser output, analytic interpretation and hypothesis in separate fields. A filename, process name, hash match or deleted record is not automatically malicious. A timestamp can represent creation, modification, access, metadata update, ingestion or parser reconstruction. Record its semantics and uncertainty. Do not extract credentials or protected content, execute a suspicious file, decrypt data or run a parser against live evidence.

## Correlate network, cloud and identity evidence

For each supplied log or flow, preserve provider/service, tenant, account, principal, device, IP, session, request or trace ID, event schema/version, ingestion and occurrence times, retention range and collection filter. Distinguish provider audit events, network observations, application logs and identity assertions. Record provider clock and export limitations.

Correlation requires an explicit rule and supporting identifiers; time proximity alone does not prove common actor or causation. Preserve NAT, proxy, shared-account, service-account, federation and clock-skew alternatives. Never query a provider, block a principal, reset a credential, change retention or conclude identity attribution.

## Build a source-preserving timeline

Store original timestamp, time zone or offset, clock source and evidence locator. Define time semantics for every source: event occurrence, file-system action, ingestion, acquisition, analyst observation or derived normalization. If a normalized time is needed, store it as a derived field with transformation version and uncertainty. Order events only within supported precision. Simultaneous or coarse timestamps remain tied or uncertain.

Link each timeline event to one or more evidence IDs. Mark duplicates, inferred intervals, missing spans and contradictory ordering. Do not manufacture precision. Preserve the acquisition time separately from event occurrence time and from analysis time.

## Test competing hypotheses

State each hypothesis as a bounded, falsifiable proposition. Map supporting, contradicting and neutral evidence, alternative explanations, missing evidence, affected scope and next authorized examination. Require a corroborating observation from an independently identified source before elevating a cross-source association, and preserve non-corroborating evidence rather than forcing agreement. Label facts, observations, inferences and hypotheses explicitly. Avoid terms such as attacker, compromise, malware, exfiltration or persistence unless they are an attributed supplied classification or qualified finding.

A finding states only what the identified evidence supports within the frozen scope. It cannot establish legal attribution, intent, admissibility, privilege, notification duty or complete incident scope. Quantify affected events, devices or accounts only when the source population and reconciliation are known.

## Join and stop

Run authority/preservation, endpoint, network/cloud/identity and timeline/hypothesis branches from one baseline. Join by stable IDs, reconcile time zones and configuration versions, and preserve contradictions. Each gap states impact, evidence needed, owner, qualified resolver and stop condition.

Stop on absent authority, broken custody, ambiguous evidence identity, unknown time basis, unsupported tool output, restricted-data exposure or a request for live access, containment, credential use, malware execution, destructive handling or external contact. Qualified DFIR and legal authorities retain every operational, attribution and legal decision.
