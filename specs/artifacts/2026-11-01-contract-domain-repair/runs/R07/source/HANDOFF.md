# Batch document downloader

## Run

Python 3, standard library only; no third-party packages required.

```sh
python deliverable.pyz JOBS_JSON --output OUTPUT_DIRECTORY
```

Input and output paths are relative to the caller's working directory unless
absolute. The archive can be copied elsewhere and run without this source tree.
Production inputs must specify a reachable HTTP service using the documented API.

## Repair

- Preserve the API prefix and encode each exact Unicode document ID as one URL
  segment. Literal percent-looking text is encoded again, not interpreted.
- Keep native output paths separate from business IDs; preserve original output
  spelling in the receipt, create parents, and write decoded bytes unchanged.
- Validate response identity and Base64; write the sorted completion receipt only
  after all jobs succeed. Errors return nonzero and print a diagnostic to stderr.
- Downloads are sequential. A failed batch can leave files already downloaded;
  it does not roll them back. An old receipt is removed before downloading a
  validated batch so it cannot claim that a failed rerun completed.

## Source and reproducible checks

`source.zip` contains the source, tests, original contract/demo/sample and this
handoff. `main.py` is the maintained implementation. `build.py` packages it as
`__main__.py` without external runtime files.

```sh
python build.py
python -m unittest -v test_download
```

Tested: all three test methods passed on the delivered archive. They copy the
archive into temporary directories, remove PYTHONPATH, and invoke the real CLI.
Checks include the public demo, an empty batch, prefixed URLs with and without a
trailing slash, slash/percent/query/fragment/space/backslash/Unicode/dot IDs,
binary/text/empty payloads, nested native paths with spaces and Unicode, observed
HTTP request targets, exact file bytes, and complete sorted receipt fields.
Fixture request targets are literal expectations independent of the downloader.
All test HTTP servers are shut down and closed after each run.

The checks use local HTTP servers; no production service or exhaustive platform
matrix was tested. Output names follow the native filesystem rules of the host.
