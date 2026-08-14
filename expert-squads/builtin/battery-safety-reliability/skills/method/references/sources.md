# Sources, rejected candidates and no-copy boundary

## Rejected Agent Skills

- Original repository: `https://github.com/personamanagmentlayer/pcl`
- Fixed commit: `5d3e0058cf1872c5a808ae2a83ebac8a7ce0a553`
- Exact paths: `stdlib/domains/energy-expert/SKILL.md` and `stdlib/domains/manufacturing-expert/SKILL.md`
- License closure: root Apache-2.0 `LICENSE`; root `NOTICE`; separate `LICENSE-DOCS` for documented paths and trademark policy. At review, the original repository showed about 41 stars and 9 forks.
- Decision: rejected. Energy Expert covers grids, renewable generation, trading and real-time monitoring/control. Manufacturing Expert contains MES writes, scheduling, predictive maintenance and fixed OEE/Cpk/Gage-R&R/failure-probability thresholds. Neither provides cell/module/pack genealogy, SOC/SOH method, abuse-test provenance, thermal-runaway/propagation evidence, barriers, censoring or battery reliability authority. Retained concepts: none.

No upstream wording, executable code, fixed metric, threshold, model, maintenance recommendation, scheduling logic, test parameter or template is copied.

## Primary sources to refresh

- Sandia/USABC Battery Abuse Testing Manual for Electric and Hybrid Vehicle Applications, SAND2022-0089R: `https://www.osti.gov/biblio/1838583`
- NREL open-source battery and Battery Failure Databank description: `https://www.nrel.gov/transportation/machine-learning-for-advanced-batteries.html`
- DOE Vehicle Technologies Office Battery Data Hub: `https://batterydata.nrel.gov/`
- NASA Battery Failure Databank record: `https://ntrs.nasa.gov/citations/20205010312`
- UNECE Manual of Tests and Criteria Revision 8 and Amendment 1: `https://unece.org/transport/dangerous-goods/rev8-files`
- FAA AC 20-184, Guidance on Testing and Installation of Rechargeable Lithium Battery and Battery Systems on Aircraft: `https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1027106`

These sources support test-condition, instrumentation, event, propagation, data and application-specific evidence structures. They are not universal battery criteria. Sandia/USABC is vehicle-focused, UNECE is transport-focused and FAA AC 20-184 is aviation-focused. Record retrieval date, current version, chemistry/configuration, application and local controlled source. Do not copy protected standards, invent thresholds or turn the sources into live test instructions.
