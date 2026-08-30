# Expert Squad authoring quality method

Use this reference before defining Agents or calling `expert_squad_author`. It turns a requested domain into one reviewable decision and rejects packages that differ only by labels or generic prompts.

The external sources below inform portable authoring practice. OpenCorvus package identity, projections, workflow execution, Artifact publication, Registry validation, Manager installation, and runtime authority remain governed by the repository architecture and the parent `SKILL.md`.

## 1. Decide whether to create a Squad

Compare the request with every available Squad using the following fields:

| Field      | Required evidence                                                            |
| ---------- | ---------------------------------------------------------------------------- |
| User job   | The bounded decision or deliverable the operator needs                       |
| Inputs     | The domain evidence, files, systems, or observations required                |
| Method     | The professional procedure that transforms inputs into conclusions           |
| Output     | The concrete artifact or decision pack delivered                             |
| Acceptance | The factual, safety, quality, and presentation checks that determine success |

Choose exactly one outcome:

- **Reuse** an existing Squad when its job, method, output, and acceptance already cover the request.
- **Upgrade** an existing Squad when the requested work belongs to its domain but exposes a missing role, Skill method, asset, or acceptance check.
- **Compose** existing Squads as separate Mission stages when each stage produces an independently acceptable domain result and exact evidence passes between them.
- **Create** a new Squad only when it owns a distinct professional delivery surface that cannot be expressed by reuse, upgrade, or composition.

Reject creation when the proposed difference is only a new label, audience, industry noun, output filename, or renamed copy of existing roles. Record the compared Squad IDs and the decisive gap; catalog search with no comparison evidence is incomplete.

## 2. Decide the professional Skill and asset closure

Search authoritative repositories and clearly licensed open-source Skills before writing a clean-room method. For every candidate source, record:

- canonical repository and exact source path;
- full immutable commit identifier or immutable release object;
- exact applicable license text and SPDX identifier only when the text matches;
- files adapted, files excluded, and attribution or notice obligations;
- scripts, binaries, dependencies, subprocesses, network calls, credentials, writable paths, and generated-code surfaces;
- the OpenCorvus adaptation boundary and the domain claims still requiring human professional review.

Treat popularity, marketplace availability, a public repository, “free”, and source visibility as discovery signals only. They do not establish redistribution permission. Reject a source when its applicable license is missing, ambiguous, incompatible with redistribution, or different across required files. Audit executable content before reuse and pin the reviewed revision rather than a movable branch or tag.

When no suitable source survives review, write a clean-room package Skill. State the searched sources, why each failed the fit or license boundary, the independent method used, and its professional limitations. Do not paraphrase a rejected source into a nominally clean-room Skill.

A complete package includes:

- at least one substantive `skills/<skill-id>/SKILL.md` that owns the domain method, workflow practice, or quality contract;
- model-readable references, examples, ledgers, rubrics, and templates beneath that Skill directory;
- immutable tool-only templates or data under package `assets/` only when a package tool consumes them;
- exact typed package Skill entries in scheduler and worker `capability_refs` for every role that must apply the method;
- package tool, Model Context Protocol, configuration, and dependency projections only when they are required, owned, portable, and validated.

A filename-only Skill, a generic checklist that fits any domain, role prompts with no reusable method, or saved Skill bytes that no runtime owner receives is a rejection.

## 3. Design non-generic Agents

Give every proposed Agent one role contract:

| Contract field     | Question                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| Required input     | What exact evidence or predecessor result must this Agent completely consume? |
| Exclusive judgment | What domain decision can this Agent make that no sibling duplicates?          |
| Durable output     | What typed Artifact, verified file, or terminal evidence does it own?         |
| Tools and Skill    | What exact projected capability is necessary for that judgment?               |
| Failure boundary   | Which missing evidence or unsafe condition must stop this role?               |

Merge roles when their required inputs, judgment, and output are materially identical. Split roles only when their evidence can be gathered independently, their professional methods conflict usefully, or one must review another's completed result. Do not create workers to reach a target headcount.

Give the final delivery owner the responsibility to read all mandatory predecessor evidence, resolve explicit conflicts without hiding them, preserve safety boundaries, and produce the accepted user-facing artifact. A reviewer must have a concrete object and rubric to review; “improve quality” is not an independent responsibility.

## 4. Derive the workflow from evidence dependencies

Start from the accepted output and work backward:

1. List the evidence required by the final delivery owner.
2. Assign one owner to each independently producible evidence set.
3. Add an edge only when the downstream role cannot begin correctly without the predecessor's output.
4. Keep independent evidence producers as source nodes so the runtime can execute them in the same frontier.
5. Use an explicit join only when the downstream judgment requires every named predecessor.
6. Keep direct dispatch when no mandatory evidence order exists.

The graph must express semantic dependency, not preferred narration order or a desired parallelism metric. Reject accidental serialization, disconnected Agents, joins that ignore a mandatory producer, cycles, duplicated review, and a parallel claim unsupported by independent inputs. Treat `workflowTopology` as post-definition analysis, not as runtime state or a target to game.

## 5. Publish one authoring decision

Before blueprint construction, publish one compact decision containing:

```text
catalog_decision: reuse | upgrade | compose | create
compared_squads: exact IDs and decisive capability differences
delivery_surface: user job, inputs, method, output, acceptance
roles: each Agent's required input, exclusive judgment, output, capability, blocker
workflow: source frontier, dependency waves, joins, final owner, direct-dispatch rationale when empty
skills: package refs, source or clean-room status, provenance, license, adaptation, security surface
assets: exact paths, owner, consumer, and domain purpose
professional_boundaries: unknown-data, safety, legal, regulated-action, and human-review limits
verification: positive Skill, SDK, Registry, Manager, Resolver, production-route, and artifact checks
rejections: every considered source, role, dependency, or duplicate Squad that was excluded and why
```

Only `create` and `upgrade` produce a package blueprint. `reuse` returns the existing exact identity. `compose` produces a collaboration plan whose stages retain their existing package ownership. Do not call the author tool when any mandatory field is unknown or any rejection condition remains unresolved.

## 6. Verify positive production behavior

Require evidence that the package:

1. passes Skill structure validation and completely contains every referenced Skill resource;
2. parses through the canonical SDK definition validator and writer;
3. loads through the real Registry and installs through the Manager transaction;
4. resolves the exact scheduler and worker Skill/tool projections through `PromptProfileResolver`;
5. reports the intended initial frontier, dependency waves, joins, critical path, and maximum parallel width;
6. preserves package bytes and immutable revision identity across the production discovery/detail/install/settings route when distribution is in scope;
7. exercises each domain Artifact producer-consumer chain through real projected package tools when workflow nodes exchange typed Artifacts;
8. produces and manually inspects the real rendered surface when the package changes user-visible behavior.

Mock, fixture-only, static string, and prompt-lint checks may support a local contract but never replace the production path they stand in for. Prefer positive assertions on exact outputs, grants, receipts, artifacts, topology, and rendered behavior.

## 7. Feed batch learning back into this method

After an accepted batch, add only reusable failure patterns or authoring decisions to this method. Keep domain procedures in their package-local Skills. Do not add one-off package names, temporary test values, incident transcripts, or duplicated runtime architecture here.

## Research basis

Checked 2026-08-11:

- [Agent Skills specification](https://agentskills.io/specification): canonical `SKILL.md` structure, optional resource directories, relative resource resolution, and progressive disclosure.
- [Anthropic public Skills repository](https://github.com/anthropics/skills): self-contained Skill examples, explicit distinction between open-source examples and source-available document Skills, and the requirement to test Skills in the target environment.
- [SPDX License List overview](https://spdx.dev/learn/overview/): stable license identifiers and the requirement to match actual license text before applying an SPDX identifier.
- [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use): full commit pinning as immutable third-party source selection and source auditing before reuse. The guidance is written for Actions; this method applies the same provenance principle to imported executable Skill content.
- [Microsoft Agent Framework workflows](https://learn.microsoft.com/en-us/agent-framework/workflows/workflows): directed-graph workflow construction and validation of connectivity, bindings, edges, and message compatibility.
- [Microsoft AutoGen GraphFlow](https://microsoft.github.io/autogen/dev/user-guide/agentchat-user-guide/graph-flow.html): concrete sequential, parallel fan-out, and all-parent join patterns. GraphFlow is experimental; only the topology concepts are used here.
