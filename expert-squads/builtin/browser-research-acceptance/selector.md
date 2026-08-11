# Browser Research & Acceptance selection

Select this package when the answer depends on what a current rendered page shows or how a real browser interaction behaves. Preserve the target URLs, authenticated-state assumptions, acceptance criteria, allowed mutations, viewport constraints, locale, and evidence requirements.

Use `browser-evidence-acceptance` exactly as declared. Do not replace real-page evidence with source-code assertions, fixture pages, DOM-only automation, or a prose claim that the page probably works. For API-only research, repository-only review, or tasks that do not need a browser, select a narrower package.

Require human control for login, CAPTCHA, one-time passwords, payment, destructive actions, or access to sensitive information. Stop when the declared observable goal is satisfied or when a recorded blocker requires user action.
