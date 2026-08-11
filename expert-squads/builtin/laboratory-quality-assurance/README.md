# Laboratory Quality Assurance

This package runs three evidence-only branches in parallel: method validation and verification, metrology and equipment, and sample/QC/proficiency assurance. `laboratory-quality-review-owner` joins them without converting evidence gaps into approval.

Use it for a declared laboratory scope, method and equipment versions, sample chain of custody, quality control (QC), proficiency testing (PT), nonconformance and Corrective and Preventive Action (CAPA) records. It does not interpret a patient result, approve a method or decision rule, choose an uncertainty model or coverage factor, declare traceability or calibration fitness, dispose or rerun a sample, release results, close OOS/OOT/PT/CAPA, or certify/accredit a laboratory. Qualified laboratory leadership, quality and technical managers, method subject-matter experts, metrologists, authorized signatories, clinical reviewers, and accreditation bodies retain those decisions.

The package-local Skill is `laboratory-quality-assurance/shared/method`. Its bounded K-Dense adaptation and full MIT license closure are recorded under `skills/method/references/`.
