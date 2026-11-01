Repair the supplied SQLite query-export project. Deliver deliverable.pyz,
maintainable source and a concise tested handoff. Python 3 standard library only.
Invocation: python deliverable.pyz INPUT_DIRECTORY --output RESULT_JSON
INPUT_DIRECTORY contains source.db and UTF-8 export.json {exports:[{name:TEXT,
table:TABLE_NAME,columns:[COLUMN_NAME,...],match:{column:COLUMN_NAME,value:TEXT},
order_by:[COLUMN_NAME,...]},...]}. Names refer to existing ordinary SQLite tables and
columns. All identifiers are nonempty, contain no NUL, and may contain spaces, Unicode,
SQL keywords, punctuation or double quotes. They are identifiers, not SQL expressions.
Every requested column exists; columns/order_by are nonempty and distinct within each
list. Export names are distinct exact nonempty text. match.value is exact text data,
including apostrophes, SQL-looking text, numeric-looking text and case distinctions.
Filter rows by exact SQLite BINARY text equality; order by the listed columns ascending
using SQLite ordering. Source cells are TEXT, INTEGER or NULL. Preserve value types,
identifier spelling, requested column order and export order. Output UTF-8 JSON
{exports:[{name:EXACT_NAME,columns:EXACT_COLUMN_LIST,rows:[[CELL,...],...]},...]} and exit0.
Read the existing database without altering its schema, data, indexes or user_version.
Do not confuse identifier quoting with value binding. The final zipapp works from
arbitrary cwd using only itself, Python and supplied inputs. Actual exported values
and source preservation matter, not merely successful SQL or JSON serialization.
