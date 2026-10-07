Browser tab: 50, Title: "OpenCorvus", URL: "http://localhost:18034/ui/".
The following is a diff from the previous accessibility tree with ~ and + representing changed and added elements, respectively. Removed elements are summarized by ID range.
Removed element IDs: 77-85
~										71 tab (selectable, settable, boolean) Agents & Capabilities, Value: 0, ID: tabs-cl-441-trigger-agents
~										74 tab (selected, settable, boolean) Package Details, Value: 1, ID: tabs-cl-441-trigger-package
~									75 container Description: Package Details, ID: tabs-cl-441-content-package
~										76 text Source
+										77 text Project package
+										78 text Declaration hash
+										79 text 3c96a1e841c6
+										80 text Projected agents
+										81 text mission, producer, verifier
+										82 heading README, Value: 3
+											83 text README
+										84 text Appended to Orchestrator
+										85 heading Task Resource QA, Value: 1
+											86 text Task Resource QA
+										87 text This package delivers a small persistent text resource through a real Task after current Project observation and independent verification. The Project Observer has the dynamic identity mission and the explore runtime; it is not a native Mission. Published resources, real participant messages and verification evidence remain the current Task's canonical facts. A file on disk alone is not a declared downloadable delivery. Missing capabilities, query errors, incomplete publication and verification failures remain visible.
+										88 heading Selector Guidance, Value: 3
+											89 text Selector Guidance
+										90 text selector/task-resource-qa
+										91 text Deliver a small text resource after observing the current Project, with independent verification.
+										92 text Use query-produce-verify when the request needs current Project Task observation and a verified persistent text delivery.
+										93 heading Selection, Value: 1
+											94 text Selection
+										95 text Use query-produce-verify for current Project Task observation followed by a small text resource and independent verification. Its declared dependencies identify useful work boundaries; the scheduler owns dispatch and acceptance decisions from actual facts. Do not invent missing evidence or a successful outcome.
+										96 heading Scheduler Capability Projection, Value: 3
+											97 text Scheduler Capability Projection
+										98 text 0 tools
+										99 text capability_refs
+										100 text capability:capability_set:platform:tool-registry:orchestrator-base, capability:capability_set:platform:tool-registry:scheduler-transport
The focused UI element is 74 tab (selected, settable, boolean) Package Details, Value: 1, ID: tabs-cl-441-trigger-package