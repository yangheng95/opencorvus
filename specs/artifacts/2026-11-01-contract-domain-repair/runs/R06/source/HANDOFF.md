# Manifest bundle delivery

Run with Python 3.9 or later; no third-party packages are required:

```sh
python deliverable.pyz INPUT_DIRECTORY --output OUTPUT_ZIP
```

The output's parent directory must already exist. Relative command-line paths
are relative to the caller's working directory. Sources are relative to the
input directory; targets retain their exact forward-slash ZIP paths.

`main.py` is the maintainable application source. Rebuild the standalone archive
with `python build.py`; run the black-box checks with
`python -m unittest -v test_delivery`.

The application streams binary payloads, sorts entries and the index by target,
and replaces the destination only after the archive is complete. It rejects
unsafe paths, missing sources, duplicate targets, and the reserved target
`_bundle_index.json`. Sources resolving outside the input directory are rejected.
Do not modify inputs while bundling. Logical contents are order-independent;
byte-identical ZIP serialization is not promised.

Verified the actual `deliverable.pyz` through four passing acceptance tests,
including standalone execution of a copied archive in an unrelated working
directory. Tests open the resulting ZIPs and compare every payload's exact bytes,
the full member set, and the sorted index against independently constructed
expectations. Coverage includes binary bytes, empty files, UTF-8 text, Unicode,
spaces, dots, commas, nesting, duplicate basenames, repeated source selection,
a payload larger than the streaming chunk, reversed manifests, an empty
manifest, relative invocation paths, and invalid-input preservation of an
existing output. ZIP CRC checks also pass. No third-party runtime was used.
