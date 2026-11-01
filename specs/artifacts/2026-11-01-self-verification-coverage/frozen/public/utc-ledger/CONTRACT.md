Repair the UTC session-ledger report project. Deliver deliverable.pyz,
maintainable source and concise tested handoff. Python 3 standard library only.
Invocation: python deliverable.pyz INPUT_DIRECTORY --output RESULT_JSON
INPUT_DIRECTORY contains UTF-8 sessions.csv with named columns session,started_at,ended_at.
Column reordering, extra metadata, CSV quoting, CRLF/LF are legal. session is distinct,
exact nonempty text, including numeric-looking IDs, punctuation, whitespace or Unicode.
Each timestamp is YYYY-MM-DDTHH:MM:SS with optional 1-6 fractional digits followed by
Z or a numeric +/-HH:MM offset; it denotes an aware instant. Convert both instants to
UTC before ordering, subtraction or date grouping; never strip an offset as decoration.
For each input row emit {session:EXACT_TEXT,start_utc:CANONICAL,end_utc:CANONICAL,
seconds:NUMBER,start_utc_date:YYYY-MM-DD} in original input order. CANONICAL is exactly
YYYY-MM-DDTHH:MM:SS.ffffffZ with six fractional digits. Group whole session durations
by their start UTC date (do not split midnight-spanning sessions), sorted by date.
Exit0 and JSON {sessions:[...],daily:[{date:DATE,sessions:INTEGER,seconds:NUMBER},...],
total_seconds:NUMBER}. Numeric tolerance is 1e-8 absolute. Zero durations are legal.
For the first row whose end instant precedes its start, exit2 and JSON
{error:{code:NEGATIVE_INTERVAL,session:EXACT_TEXT}} instead of a successful report.
Local clock labels can run backwards while elapsed UTC time is positive; equivalent
offset spellings represent the same instant. Preserve session text independently of
timestamp normalization. The final zipapp runs from arbitrary cwd with Python/inputs.
