Repair the batch document-download project. Deliver deliverable.pyz,
maintainable source and a concise tested handoff. Python 3 standard library only.
Invocation: python deliverable.pyz JOBS_JSON --output OUTPUT_DIRECTORY
JOBS_JSON is UTF-8 JSON {base_url:HTTP_URL,jobs:[{document_id:TEXT,output:RELATIVE_PATH},...]}.
The base URL includes an API path prefix, contains no query/fragment, and may end in '/'.
For each job GET base_url (without its final slash) + '/documents/' + the document ID
encoded as exactly one UTF-8 URL path segment. document_id is exact nonempty Unicode
business text; slashes, percent signs, query/fragment characters and spaces are legal
identifier data, not address syntax. Already percent-looking text remains literal data.
The API returns HTTP200 JSON {document_id:EXACT_ID,content_base64:BASE64}. The public
demo_server.py serves the sample; production inputs provide a reachable HTTP service.
Decode the content and write exact bytes to the job's relative native filesystem path
under OUTPUT_DIRECTORY, creating parent directories. Distinct output paths contain no
absolute/traversal components and never equal receipt.json. Text and binary/empty payloads
are supported. Source IDs and filesystem output paths belong to different contracts.
Write receipt.json {files:[{document_id:ID,output:EXACT_ORIGINAL_OUTPUT_TEXT,url:ACTUAL_URL,
bytes:INTEGER},...]} sorted by document_id. Exit 0 when all downloads are complete.
The archive must work from a different cwd using only itself, Python, inputs and API.
Preserve the base URL prefix, IDs, requested output names and exact response contents.
