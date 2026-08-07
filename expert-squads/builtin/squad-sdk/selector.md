# Generate Agent Squads selection

Select `squad-sdk` when the Task's deliverable is one traceable, project-owned OpenCorvus Expert Squad package:

- porting or importing a heterogeneous external agent team, algorithm, roster, prompt graph, Skill closure, or Model Context Protocol (MCP) capability set; or
- designing, validating, and installing a new domain Expert Squad through the canonical Software Development Kit (SDK).

Do not select it for ordinary software delivery, using an already installed Squad, editing a package manually, or running the imported algorithm's domain workflow. Use `heterogeneous-import` for a concrete supported external Squad identity and `sdk-authoring` for a source algorithm, domain contract, or new Squad design. Every declared node is mandatory, and the scheduler performs the final write tool only after the exact review node succeeds.

Call `select_expert_squad` with `profile_id: "squad-sdk"`. The selected profile stays fixed for the Task.
