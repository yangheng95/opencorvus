# Source provenance and bounded adaptation

## Accepted upstream

- Repository: https://github.com/arpitg1304/robotics-agent-skills
- Fixed commit: `1147a77bc6cfb427c41a1d7284281e6bb60330d7`
- Exact source path: `skills/robotics-testing/SKILL.md`
- Immutable source URL: https://github.com/arpitg1304/robotics-agent-skills/blob/1147a77bc6cfb427c41a1d7284281e6bb60330d7/skills/robotics-testing/SKILL.md
- License: Apache License 2.0 at repository-root `LICENSE`; exact bytes are saved as `upstream-LICENSE`.
- NOTICE: no NOTICE file was present at the fixed commit when checked on 2026-08-11.
- Adaptation owner: OpenCorvus Expert Squad maintainers.
- Qualified reviewers: robotics test engineer and robot/machine-safety engineer.
- Applicability: evidence organization for a specifically identified integrated robot application.
- Status: bounded adaptation; not a verbatim Skill copy.

## Retained concepts

Retain the testing hierarchy of unit, integration, simulation, hardware-in-the-loop and bounded field evidence; deterministic replay; fault injection; property-based invariants; scenario coverage; and expected-versus-observed result recording. These concepts are re-expressed inside an application-safety evidence workflow and carry no upstream example values.

## Excluded behavior and assets

Exclude all ROS source code, shell commands, package installation, launch procedures, robot or simulator connection, live hardware access, deployment, runtime control, autonomous test execution, default thresholds, sample acceptance values and safety-acceptance claims. No upstream scripts or examples are bundled. The package cannot bypass safeguards, expose a person to motion or initiate fault injection.

## Modified and clean-room material

The local method adds configuration baselining, task/mode/lifecycle hazard analysis, risk-reduction hierarchy, safeguards, safety-function/SRP-CS traceability, configuration control, uncertainty, contradiction handling and qualified authority stops. These sections were authored clean-room from the public primary-source concepts below; protected ISO standard text was not copied.

## Primary sources

- OSHA, Robot Systems Safety, current page checked 2026-08-11: https://www.osha.gov/otm/section-4-safety-hazards/chapter-4
- ISO 10218-1:2025 official metadata: https://www.iso.org/standard/73933.html
- ISO 10218-2:2025 official metadata: https://www.iso.org/standard/73934.html
- ISO 13849-2:2012 official metadata: https://www.iso.org/standard/53640.html
- NIST mobile manipulator safety test methods: https://www.nist.gov/publications/test-methods-evaluation-manufacturing-mobile-manipulator-safety
- NIST robotic performance assessment framework: https://www.nist.gov/programs-projects/performance-assessment-framework-robotic-systems

## Decision not made and uncertainty

This provenance record does not determine standards applicability, legal compliance, achieved performance level/category/SIL, residual-risk acceptance, commissioning or release. Jurisdiction, current controlled standards, application configuration and test representativeness remain review-specific uncertainties. Stop when the fixed source/license cannot be verified or when the requested use crosses the excluded live-operation or professional-authority boundary.
