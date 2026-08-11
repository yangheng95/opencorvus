# Rejected upstream candidate

Candidate: LF Energy SEAPATH Ansible repository, https://github.com/seapath/ansible
Pinned commit: `c08bd7459e46e6455c50c83b82e5445d2e4a8f35`
Archive inspection: 1,055 entries; zero files named `SKILL.md`. Therefore no exact reusable Agent Skill path exists.
License: Apache-2.0 at repository-root `LICENSE`.
License bytes: 11,357.
License SHA-256: `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`.
NOTICE result at the pinned tree: `NOTICE`, `NOTICE.md`, and `THIRD_PARTY_NOTICES.md` absent.

Decision: reject and author clean-room. SEAPATH is a mature open-source platform for IEC 61850 digital-substation virtualization, deployment, real-time infrastructure and testing. It is not an Agent Skill and does not provide the required read-only evidence method for topology baselines, protection zones, CT/VT and breaker lineage, fault-study and relay coordination, disturbance/COMTRADE timelines, formal misoperation separation, outages or reliability denominators.

Retained: none. Excluded: source code, Ansible roles, deployment configuration, infrastructure behavior, examples, defaults and operational commands. No SEAPATH content is copied into this package. The package uses only the official method-source categories listed in `PRIMARY-SOURCES.md`.
