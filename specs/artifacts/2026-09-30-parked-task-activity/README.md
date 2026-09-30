# Parked Task activity — manual evidence

- [Running](running.png): Task row and Recents show the current running indicator.
- [Parked](parked.png): the same mounted page removes those indicators after the real execution lifecycle publishes idle; the Task remains durably active.
- [Resumed](resumed.png): the same page restores the indicators on retry, without reloading.
- [After process restart](after-restart.png): automatic reconnect to the restarted development server retains inactive presentation even though its durable history ends with retry.

Actual `/ui` on `http://127.0.0.1:4229`, desktop 1440 × 960. All screenshots
were displayed and manually inspected; they are evidence, not automated test
baselines. The source change is backend projection/event fan-out; no new UI
renderer or fixture browser page is involved.

The isolated Task `tsk_g00VWfRht200CqTvIKeH` was created through
EngineService.createTask and settled through the real root-ingress/no_action
path using the repository's explicitly labelled scripted protocol participant.
Local lifecycle publications then exercise existing real Task status routes,
protocol bridge and Work Ledger Server-Sent Events. No Provider or account
credentials were used; these images do not claim model execution acceptance.

At idle the actual Task status route returned `status: inactive` and
`lifecycleStatus: active`. After stopping only the owned verification process,
`bun run dev serve --hostname 127.0.0.1 --port 4229 --project-dir <isolated project>`
recovered one project successfully, and returned the same state. The browser
remained mounted and reconnected through its existing stream mechanism.

Mission aggregation, child-worker activity, serial occurrences, terminal
lifecycles and separate projects were separately exercised through the real
backend projection and event-stream tests; see the linked investigation record.
