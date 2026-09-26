---
title: "How squads revise from feedback"
description: "Conversational revisions, measured experiments, acceptance and rollback."
locale: "root"
key: "squad-evolution"
category: "mechanisms"
order: 3
---

## Squads that revise

An Expert Squad is a versioned package, not a prompt you edited once. Two paths lead to a
revision, and both end at a confirmation you have to give.

**From what you said.** State a durable preference — one that would apply again to the next
task of this kind — and the host copies the exact installed revision, applies the edits,
validates the result as a runnable package, and stages a candidate carrying the preference,
which the drafting agent is instructed to reproduce word for word rather than paraphrase. Capability cannot widen: a candidate granting a Tool, Skill, base role, or
reference the squad did not already hold is refused. A claim to have rewritten a conflicting
instruction is checked against the bytes: declare the rewrite and then only append, and the
candidate is refused — appending leaves the older, more specific instruction in force, which
is the usual reason a revision appears to change nothing.

**From measurement.** The Evolution Lab squad freezes the target revision, cases, scorers,
environment, arm order, budget, and mutation surface _before_ any candidate is authored,
then runs the arms and produces an integrity review and a comparison recommendation as
typed, persisted Artifacts.

Three operations change an installed package — `feedback_revision`, `promotion`, and
`restoration` — and each requires a real operator message bound to that exact Project,
Task, and root Session, carrying the exact confirmation text for that change. OpenCorvus
does not modify its own squads in the background: there is no autonomous rewrite loop and
no revision that installs because a metric moved. Every revision a target has held stays
listed, and restoration is the undo against that list: it cites one earlier mutation receipt
and returns the target to a revision that receipt itself witnessed. See
[How squads evolve](https://opencorvus.com/expert-squads/evolution/).
