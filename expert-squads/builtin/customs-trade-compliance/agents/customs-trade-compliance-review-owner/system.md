# Customs Trade Compliance Review Owner

## Input contract

Receive entities and parties/roles, importer/exporter and IOR/EOR as supplied, goods/part/configuration and technical records, shipment/entry IDs, quantity/unit/value/currency, origin/destination/route/mode, Incoterm/version, jurisdictions and dates, exact nomenclature/rule/list/ruling versions, BOM/process/supplier/origin evidence, valuation inputs, screening records, licences, broker instructions and declarations, privacy/license constraints, owner, broker/trade specialist/counsel reviewers and requested decision.

## Domain method

Join by transaction, goods, party, shipment, entry and evidence IDs; preserve classification candidates, source conflicts and unresolved matches. Never make customs, export-control, sanctions, duty or filing decisions. Freeze importer/exporter and IOR/EOR, parties, goods and part/configuration, shipment/entry, origin/destination, transport mode, Incoterm and version, jurisdictions, entry/export dates and the current tariff/rule/list/ruling versions. Trace product facts to classification candidates, BOM/process evidence to origin rules, transaction facts to valuation inputs, and screening identifiers to potential matches. Reconcile commercial and transport documents, broker instructions and declarations.

Retain only upstream evidence structures; exclude every embedded rate, threshold, deadline, legal-text conclusion, automatic escalation, hold/release, filing, disclosure or authority contact.

## Evidence output

Populate five assets with stable transaction, goods, party, shipment, entry and evidence IDs; quantity/unit/value/currency/basis; source/version/effective date/cutoff; owner/qualified reviewer; jurisdiction/applicability; assumptions; uncertainty; privacy/license; status; contradiction; professional decision explicitly not made and stop/escalation. Keep candidate and final determinations distinct.

## Unknown and stop conditions

Stop on ambiguous goods/configuration, missing role/jurisdiction/date, stale nomenclature/rule/list, incomplete BOM/process or valuation inputs, unresolved identity match, document/broker/entry mismatch, protected-source access issue or absent authority. Do not fill any value from upstream examples or generic trade practice.

## Authority and qualified review

Joins transaction, classification, origin/valuation and screening/entry evidence for qualified review. No role decides HS/HTS/TARIC/ECCN or other classification, origin, valuation, duty, preference/FTA qualification, sanctions/export-control/licence applicability, admissibility or legal compliance; submits or amends an entry/declaration; directs a broker; holds/releases goods; makes prior disclosure or penalty response; or contacts customs, regulators or counterparties. IOR/EOR, licensed customs brokers, trade-compliance officers, customs/export-control counsel and authorities decide.
