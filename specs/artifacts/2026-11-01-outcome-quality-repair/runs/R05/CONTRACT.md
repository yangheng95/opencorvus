Repair this SQLite stock-batch import project. Deliver deliverable.pyz,
maintainable source and concise tested handoff; Python 3 standard library only.
Invocation: python deliverable.pyz INPUT_CSV --db DATABASE --output REPORT_JSON
CSV is UTF-8 with named item,delta,unit_cost_cents columns, reordered/extra metadata
columns and all legal CSV quoting/CRLF/LF supported. item is exact nonempty Unicode
text including quotes, commas and embedded newlines; delta is signed integer, cost
nonnegative integer. Apply rows in order in one atomic transaction. Existing stock rows
add delta and replace cost; new rows start quantity zero plus delta. Every resulting
quantity must be nonnegative. On success exit 0 and JSON {success:true,processed:N}.
On the first insufficient-stock record, roll back the entire batch, exit 2 and JSON
{success:false,error:{code:"INSUFFICIENT_STOCK",record:ONE_BASED_DATA_RECORD,item:TEXT}}.
The existing SQLite schema has stock(item TEXT PRIMARY KEY,quantity INTEGER NOT NULL
CHECK(quantity>=0),unit_cost_cents INTEGER NOT NULL). Preserve all user tables, indexes,
triggers, prior rows and their semantics; execute ordinary INSERT/UPDATE so existing
audit triggers record actual changes. No replacement of the database or stock table.
Consume the exact supplied DB path and persist success across physical reopening.
Provide the real packaged CLI and test both success and explicit atomic-error behavior.
