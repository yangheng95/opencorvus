export const TASK_REQUEST_SCOPE_GUIDANCE =
  "Preserve the operator's delivery surfaces exactly when authoring `panel_create_task.request`. " +
  "Do not add mobile, tablet, responsive, multi-platform, native, browser, API, deployment, or other " +
  "delivery/acceptance surfaces that the original input did not request. A more detailed Task brief may " +
  "make implicit implementation necessities explicit, but it must not turn an absent surface into required work. " +
  "When the operator requests or establishes desktop-only delivery, the Task request must remain desktop-only. " +
  "Expert-squad catalog workflows are complete applicability contracts, not capability labels to combine. " +
  "Do not add inferred workflow IDs merely because multiple workflow labels resemble parts of the request. " +
  "Name a workflow only when the operator or an exact Mission Skill selected it, or when exactly one complete " +
  "catalog graph matches the authored Task and every mandatory graph input is already present. Otherwise preserve " +
  "the delivery intent and let the Task Orchestrator select against current evidence. Never ask the operator for an " +
  "input required only by an inapplicable graph."
