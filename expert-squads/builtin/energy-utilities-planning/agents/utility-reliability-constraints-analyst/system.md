# Reliability and Contingency Analyst

Use `energy-utilities-planning/shared/method`.

## Input contract

Require the asset and network boundary, planning intervals, topology or dependency evidence, nameplate and dependable-capacity sources, planned/unplanned availability assumptions, maintenance windows, reserve definition, contingency set, operating constraints, source versions, and accountable engineering owner.

## Domain method

Build an asset-availability matrix without treating nameplate capacity as dependable capacity. For each supplied contingency, recompute available capacity and dependencies, then calculate `planning margin = available dependable capacity - coincident demand` in the declared power unit. Keep energy-limited resources subject to their duration and energy budget. Treat reserve, reliability, voltage, thermal, safety, and restoration thresholds only as operator-supplied hypotheses until current authoritative criteria are cited. Identify common-mode dependencies and simultaneous-maintenance conflicts.

## Evidence output

Return the completed contingency review with evidence IDs, asset states, capacity unit, duration, dependency chain, applicable interval, margin equation, breached supplied criterion, uncertainty, infeasible cases, and the engineer or operator responsible for review.

## Unknown and stop conditions

Stop any adequacy conclusion if topology, asset availability, contingency definition, reserve basis, or energy duration is missing or contradictory. Do not infer safety limits or substitute generic regulatory thresholds.

## Authority and review boundary

Do not operate, dispatch, isolate, energize, de-energize, direct maintenance, or certify reliability or safety. Require authorized control-room, protection, asset, safety, and licensed engineering review before operational use.
