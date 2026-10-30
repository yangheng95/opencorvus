# North Quay controlled commissioning study

The supplied sites, prices, quotes and commissioning campaigns are fictional. These are actual programme-driven simulated actions and bills, not measured field performance, regulatory approval or guaranteed returns.

## Original information and methods
Highest available revision includes a missing withdrawal; kWh rows are divided by actual interval hours, W by1000. Raw source is delivered verbatim. Current interval telemetry is perfect under this synthetic piecewise-constant contract; the controller only receives authorized forecast vintages and full confirmed history. A causal16-step LP uses separate charge/discharge efficiencies and a soft terminal reserve value. Its forecast objective is not claimed globally optimal for the unknown real path.

## Choices and economics
- CLINIC: S8, NPV 807.430107 synthetic USD. ZERO remains eligible.
- OFFICE: ZERO, NPV 0.000000 synthetic USD. ZERO remains eligible.

campaigns.csv compares all three quotes using all three actual paths; cashflows.csv includes original capex, annual OM, endyear3 replacement, endyear5 residual and8% discount. Year1 savings are exactly6 campaign repetitions; this is a stipulated synthetic12-charge year, not inference that72h represents a real year. Prior-energy invoice amounts are historical only and cancel in incremental economics. Monthly peak charges include confirmed historical peaks; neither action windows nor process restarts reset them.

## Risk and operational evidence
- CLINIC S4: expected campaign cost 179.533263; expected critical unmet 0.000000 kWh.
- CLINIC S8: expected campaign cost 165.398222; expected critical unmet 0.000000 kWh.
- CLINIC ZERO: expected campaign cost 214.869867; expected critical unmet 0.017647 kWh.
- OFFICE S4: expected campaign cost 21.600000; expected critical unmet 0.000000 kWh.
- OFFICE S8: expected campaign cost 21.600000; expected critical unmet 0.000000 kWh.
- OFFICE ZERO: expected campaign cost 21.600000; expected critical unmet 0.000000 kWh.

PV forecast error and the unannounced outage are visible in actual ledgers, not edited away. Flex and critical unserved energy have separate prices; a bill/NPV can improve while a service shortfall persists. Do not claim finite supplied paths establish a real service probability or joint guarantee. Derating and mixed0.25/.75h intervals use the same physical recurrence. sensitivity.json changes only the valuation discount, so it does not rerun or pretend to change dispatch. The separately supplied price/quote source controls require the programme to rebuild actual results.

## Model and handover limits
A linear constant-efficiency, no-self-discharge, no-export model excludes battery thermal safety, nonlinear ageing, grid protection, real weather uncertainty and field commissioning. Native LP status does not certify these. Annual scaling/penalty values and scenario weights are original assumptions, not observed financial or service probabilities. A real installation requires evidence outside this simulated study.

## Reproduction
See TEACHER-OPERATOR-HANDOVER.md, source-map.json, original-source and machine ledgers. Keep the sealed programme unchanged across private replays; no future truth or path name belongs in a controller mount, process argument or packet.
