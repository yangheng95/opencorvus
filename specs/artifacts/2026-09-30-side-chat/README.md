# Side chat desktop evidence

- [Dark, Chinese interface](desktop-dark.png)
- [Light, Chinese interface](desktop-light.png)
- [Pending question card](pending-question.png)

Captured from the repository development server at `http://127.0.0.1:4199/ui/`
with an isolated runtime and project. Viewport: 1440 × 960. The screenshots
were displayed and manually reviewed after changes to the visual hierarchy,
translation, iconography, quotation cards, suggested questions and composer.
They are evidence artifacts, not screenshot baselines or automated UI tests.

The source conversation is explicitly named **local acceptance sample** and
contains canonical persisted presentation data. No Provider credentials were
copied or used, so these images do not establish actual model generation.

Real page interactions verified: open side chat; select a transcript passage;
quote into the main composer; ask in a new side chat with the selected passage;
edit independent Chinese drafts; switch language and theme; expand reference
history; close/reopen the panel while retaining both drafts; remove a main
quotation without altering the side draft; `/side` preloads a side question.

A supplementary local server harness invoked the real `Question.ask` within
an active request scope. The side panel rendered its options, accepted keyboard
selection and submitted through `/question/que_g0VWdQLkO00dRSlRvGlJ/reply`.
The server recorded HTTP 200 and the waiting Question resolved with
`[["context"]]`. This checks the real Question event/reply path without calling
a Provider. Early detached-process harness attempts were not valid runtime
ownership and were replaced; they are not counted as acceptance.

Related [implementation record](../../records/2026-09/2026-09-30-side-chat-and-quotation.md).
