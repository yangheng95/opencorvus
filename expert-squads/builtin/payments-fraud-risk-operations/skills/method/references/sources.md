# Sources and clean-room boundary

This method and its assets were clean-room authored for read-only payment-fraud evidence. They do not reproduce vendor Skill text, API code, network rules, model thresholds, dispute deadlines or regulatory interpretations. Current processor, acquirer, network, merchant agreement and jurisdictional sources remain authoritative.

## Rejected Agent Skill

- Repository: `https://github.com/stripe/agent-toolkit`
- Fixed commit: `1953b6cce7344d880a054c42b8dd21ca3e50ebd5`
- Exact path: `skills/stripe-best-practices/SKILL.md`
- License closure: root MIT `LICENSE`; no root `NOTICE` was present in the reviewed fixed tree.
- Rejection: the Skill selects Stripe APIs and directs Checkout, PaymentIntent, Connect, Tax, key, CLI and MCP integration work. It includes actionable account/API behavior and vendor-version defaults but no merchant-fraud cohort, label-maturity, independent model validation or bounded dispute-evidence method. No content is retained. If Stripe is an actual source, current official object/event documentation may be cited as vendor data authority, not copied as cross-network rules.

## Primary sources to refresh

- Federal Reserve FedPayments Improvement, FraudClassifier Model: `https://fedpaymentsimprovement.org/strategic-initiatives/payments-security/fraudclassifier-model/`
- United States eCFR 12 CFR 1005.11, error resolution procedures: `https://www.ecfr.gov/current/title-12/chapter-X/part-1005/subpart-A/section-1005.11`
- EMVCo, EMV 3-D Secure: `https://www.emvco.com/emv-technologies/3-d-secure/`

These sources support fraud classification, error/dispute chronology and authentication evidence. They do not define universal fraud thresholds or authorize an action. Record retrieval date, version/effective period, payment rail, network/acquirer/processor, jurisdiction and contractual source. Stop when current authority cannot be confirmed.
