# Manifest delivery handoff

Run with Python and the archive only; no third-party packages or project files are needed:

```sh
python deliverable.pyz INPUT_DIRECTORY --output OUTPUT_ZIP
```

The input directory must contain UTF-8 `manifest.json`. Source paths use the host
filesystem's syntax; ZIP targets use forward slashes. The destination's parent
directory must already exist. `_bundle_index.json` is reserved for the generated
index, so it cannot also be a payload target.

`main.py` validates the manifest, streams source bytes into their full target
paths, and records actual copied byte lengths. Payloads and the index are sorted
by target Unicode order. Unlisted files are excluded. Output is built in a
temporary file and replaced only after successful copying.

Rebuild and verify from the project directory:

```sh
python build.py
python -m unittest -v test_delivery
```

Verification: five tests passed on Windows with Python 3.14. Tests invoke an
isolated copy of the final archive from an unrelated working directory, then
read the resulting ZIP with the standard library. Assertions cover exact member
sets and bytes, binary data larger than a copy chunk, empty files/manifests,
Unicode (including supplementary-plane ordering), spaces/dots/commas, nesting,
duplicate source basenames, one source mapped to multiple targets, native
Windows source separators, exclusion of unlisted files, sorted byte-count
indexes, and equivalent logical output after reversing manifest order. Invalid
paths, duplicate targets and missing sources are rejected; pre-existing output
is preserved on invalid input. Tests were authored and executed directly,
without delegation. Other operating systems were not executed in this run.
