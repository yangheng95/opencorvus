# Source and clean-room boundary

This OpenCorvus Skill, its prompts, and its assets were authored clean-room on 2026-08-11. Primary sources below supply method questions, not universal workload thresholds, clinical conclusions, training prescriptions, selection policy, or permission to process athlete data beyond local consent and governance.

## Primary method references

- Australian Institute of Sport (AIS), Athlete Management System: `https://www.ausport.gov.au/ais/ams`; reviewed 2026-08-11. Use sport-defined metrics, training/competition availability, and multi-source data concepts only.
- AIS, Training load in relation to loading and unloading phases: `https://www.ausport.gov.au/ais/position_statements/training-load-in-relation-to-loading-and-unloading-phases-of-training`; reviewed 2026-08-11. It rejects a single hard-and-fast formula for accurate training prescription or performance prediction; this package therefore encodes no universal threshold.
- AIS, Individual athlete profiling, testing, monitoring and interpretation: `https://www.ausport.gov.au/ais/performance-support/people-development/success-profiles/resources/physiology/strong-sport-specific-knowledge/individual-athlete-profiling-athlete-testing-and-monitoring-methodologies-and-interpretation`; reviewed 2026-08-11. Use for protocol and individual-context questions.
- International Olympic Committee consensus on injury/illness surveillance: `https://bjsm.bmj.com/content/54/7/372`; reviewed 2026-08-11. Use exposure, severity, burden, population and non-medical reporter boundaries; do not diagnose.
- International Olympic Committee consensus on load and injury: `https://pubmed.ncbi.nlm.nih.gov/27535989/`; reviewed 2026-08-11. Use the broad internal/external and training/competition context; do not import a causal predictor or universal ratio.

## Rejected Agent Skill

- Original repository: `machina-sports/sports-skills`.
- Pinned commit: `944c14e9895b7e541c4f80a536e0ec715db122fc`.
- Exact candidate path: `skills/sports-reporter/SKILL.md`.
- Pinned URL: `https://github.com/machina-sports/sports-skills/blob/944c14e9895b7e541c4f80a536e0ec715db122fc/skills/sports-reporter/SKILL.md`.
- License: MIT at `LICENSE`; pinned URL `https://github.com/machina-sports/sports-skills/blob/944c14e9895b7e541c4f80a536e0ec715db122fc/LICENSE`; verified 2026-08-11.
- Responsibility mismatch: it creates sports journalism from scores, schedules, game/team/player data and other repository Skills; the repository also contains betting/prediction-market capabilities. It does not own athlete exposure/load, test reliability, wellbeing, or performance-science review.
- Excluded: journalism prompts, game reporting, live data commands, betting, trading, prediction, external runtime calls, and all candidate wording. No text or executable behavior was copied.
