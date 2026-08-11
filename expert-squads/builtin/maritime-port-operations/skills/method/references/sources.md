# Sources and clean-room boundary

## Authorship and allowed use

This package method and its five templates were clean-room authored for port-evidence reconciliation. They do not copy an upstream Skill, convention text, regulatory threshold, vessel-handling procedure, terminal dispatch algorithm or clearance rule. The method supplies structure, provenance and stop conditions. The user must provide current port, terminal, vessel, customs, security and jurisdiction-specific authorities.

## Rejected Agent Skill candidate

- Original repository: `https://github.com/personamanagmentlayer/pcl`
- Fixed commit reviewed: `5d3e0058cf1872c5a808ae2a83ebac8a7ce0a553`
- Exact path: `stdlib/domains/maritime-expert/SKILL.md`
- License: Apache-2.0 under the repository `LICENSE`; repository `NOTICE` must be preserved by a reuse. Documentation directories have a separate documentation license, but this candidate is under `stdlib`.
- Rejection: the candidate permits write/edit operations and directly performs berth allocation, voyage-route recommendation, yard optimization and cargo/stowage behaviors. It embeds example speed, fuel, price, port-time and anomaly constants without a source/applicability/authority contract. That is unsafe and unsuitable for this bounded evidence package. Nothing from it is copied or adapted.

## Primary sources to refresh

- International Maritime Organization, Facilitation, FAL Convention and Maritime Single Window: `https://www.imo.org/en/ourwork/facilitation/pages/default.aspx`
- International Maritime Organization, Verification of the gross mass of a packed container: `https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx`
- International Organization for Marine Aids to Navigation, Recommendation R0127 VTS Operations: `https://www.iala.int/product/r0127/`

These sources justify traceable FAL, VGM and Vessel Traffic Services boundaries; they do not authorize this package to interpret a convention, issue an instruction or create globally valid thresholds. Record retrieval date, version/effective status, jurisdiction and local implementing authority. Stop when a current source or local port criterion cannot be confirmed.
