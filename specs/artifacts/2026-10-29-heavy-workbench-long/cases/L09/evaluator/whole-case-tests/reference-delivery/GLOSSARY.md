# Field and reasoning glossary

| Term | Operational meaning | Common mistake to test |
|---|---|---|
| row_id | Original row evidence reference; retained in lineage | Using a displayed total instead of its source |
| tenant,event_id | A wire identity within one tenant | Assuming E1 is globally unique |
| tenant,order_id | Current business identity | Grouping all tenants' O1 together |
| revision | Source version, including missing/cancelled | Filtering valid/active before selecting highest |
| released_at / as_of | Canonical UTC publication / allowed clock | Treating a future release as currently eligible |
| received batch | When this experiment actually acquired a row | Dropping an old-version late row from history |
| amount / amount_minor | Decimal USD / exact integer cents | Binary float rounding1.005 into a valid cent |
| missing / cancelled | Unknown held value / known zero | Replacing unknown with an older active value |
| conflict / wire_conflict | Highest payload disagreement / conflicting immutable wire | First-arrival wins without explicit adjudication |
| request_id | Stable transport/application request for an original receipt | New key after an unacknowledged commit |
| commit / ACK | Durable transaction / later acknowledgement | Interpreting missing ACK as no committed state |
| checkpoint | Versioned journal, receipts, rejects and audit for restore | Final totals alone or deletion of accepted history |
| principal / requested tenant | Authority / untrusted target | Treating caller-selected target as permission |
| scripted rehearsal | Constructed program/operator trial | Claiming observed human learning or production proof |
