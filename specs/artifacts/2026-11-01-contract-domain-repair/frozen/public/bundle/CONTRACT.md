Repair this manifest-driven file delivery project. Deliver deliverable.pyz,
maintainable source and a concise tested handoff; Python 3 standard library only.
Invocation: python deliverable.pyz INPUT_DIRECTORY --output OUTPUT_ZIP
INPUT_DIRECTORY contains manifest.json {files:[{source:RELATIVE_PATH,target:ZIP_PATH},...]}.
Source paths are relative to that directory; targets are distinct relative forward-slash
ZIP paths; all paths are nonempty and contain no traversal/absolute components.
Legal names include Unicode, spaces, dots and commas; nested paths and duplicate source
basenames in different directories are supported. Inputs may be binary, empty or text.
Copy the exact bytes of every specified source to its exact target, without text decoding.
The ZIP also contains _bundle_index.json {files:[{path:TARGET,bytes:INTEGER},...]} sorted
by target Unicode order. Other payload files must not be included; directory entries are
allowed. manifest order does not affect the delivered logical tree or sorted index.
The zipapp must run from an arbitrary working directory with only its own archive,
Python and the supplied inputs. Verify the actual resulting ZIP, not just zipapp exit.
