# Manifest bundle repair

## Use

```text
python deliverable.pyz INPUT_DIRECTORY --output OUTPUT_ZIP
```

Requires Python 3.8+ and its standard library only. Copy `deliverable.pyz`
wherever needed; no adjacent source files, dependencies or project working
directory are required. Relative input/output arguments resolve from the caller's
working directory. The output parent directory must already exist.

## Source and rebuild

- `main.py`: CLI, manifest validation, binary streaming and sorted byte-count index.
- `build.py`: packages `main.py` as the archive's sole `__main__.py` entry.
- `test_delivery.py`: black-box tests of the actual packaged program and output ZIPs.

```text
python build.py
python -m unittest -v test_delivery
```

Payloads are never decoded. Target names retain their full paths. Entries and
`_bundle_index.json` are sorted by Python Unicode string order; stable ZIP metadata
also makes the tested manifest permutations byte-for-byte identical. Files are
streamed in 1 MiB chunks and stored without compression; ZIP64 is enabled.
Only manifest-selected files and the generated index are included.

The manifest must be UTF-8 JSON. Paths use forward slashes and cannot include
empty, absolute, `.` or `..` components. Duplicate targets and the reserved
`_bundle_index.json` target are rejected. Sources resolving outside the input
directory are rejected. The output cannot overwrite the manifest or a selected
source. Output replacement is atomic after successful construction; errors return
a nonzero status without replacing an existing output.

## Tested handoff

Eight standard-library unittest checks passed against the released zipapp:
the supplied sample; arbitrary working-directory execution using only a copied
archive and inputs; relative output paths; binary data covering all byte values
and exceeding one streaming chunk; empty files and an empty manifest; UTF-8 text;
Unicode, spaces, dots and commas; nested targets and duplicate source basenames;
40 varied generated files and a reused source; reversed/shuffled manifest order;
invalid paths, duplicate/reserved targets, missing sources and output collision.

The checks open the resulting ZIP, validate CRCs, require the exact payload file
set, compare every payload byte, and compare the parsed index with independently
supplied expected targets and byte lengths. A separate check confirms the archive
contains the current source and no runtime dependencies. Multi-gigabyte ZIP64
payloads and concurrent input modification were not exercised.
