"""Build a manifest-selected ZIP without interpreting payload bytes."""

import argparse
import json
import ntpath
import os
from pathlib import Path
import tempfile
import zipfile


INDEX_PATH = "_bundle_index.json"


def relative_parts(value):
    """Validate portable, relative manifest paths without changing their names."""
    if not isinstance(value, str) or not value or "\x00" in value:
        raise ValueError("paths must be nonempty strings without NUL characters")
    if "\\" in value or ntpath.splitdrive(value)[0]:
        raise ValueError("paths must be relative and use forward slashes")
    parts = value.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError("paths must not contain absolute or traversal components")
    return parts


def load_entries(root):
    """Resolve and validate the complete manifest before creating an output."""
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or not isinstance(manifest.get("files"), list):
        raise ValueError("manifest must contain a files array")
    entries = []
    targets = set()
    for row in manifest["files"]:
        if not isinstance(row, dict) or "source" not in row or "target" not in row:
            raise ValueError("each file must contain source and target")
        source = root.joinpath(*relative_parts(row["source"])).resolve()
        target = row["target"]
        relative_parts(target)
        if target == INDEX_PATH or target in targets:
            raise ValueError(
                "targets must be distinct and must not replace the bundle index"
            )
        try:
            source.relative_to(root)
        except ValueError:
            raise ValueError("source resolves outside the input directory") from None
        if not source.is_file():
            raise ValueError("source is not a file: " + row["source"])
        targets.add(target)
        entries.append((target, source))
    return sorted(entries)


def zip_member(name):
    """Use stable metadata; payload order is determined by Unicode target order."""
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_STORED
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    return info


def bundle(input_directory, output_zip):
    root = Path(input_directory).resolve()
    entries = load_entries(root)
    output = Path(output_zip).resolve()
    if output == root / "manifest.json" or any(
        output == source for _, source in entries
    ):
        raise ValueError("output must not overwrite the manifest or a selected source")
    # A failed read/write leaves any existing output untouched.
    descriptor, temporary = tempfile.mkstemp(
        prefix=".bundle-", suffix=".zip", dir=output.parent
    )
    os.close(descriptor)
    try:
        index = []
        with zipfile.ZipFile(temporary, "w", allowZip64=True) as archive:
            for target, source in entries:
                size = 0
                with source.open("rb") as reader:
                    with archive.open(
                        zip_member(target), "w", force_zip64=True
                    ) as writer:
                        while True:
                            chunk = reader.read(1024 * 1024)
                            if not chunk:
                                break
                            writer.write(chunk)
                            size += len(chunk)
                index.append({"path": target, "bytes": size})
            archive.writestr(
                zip_member(INDEX_PATH),
                json.dumps({"files": index}, ensure_ascii=False).encode("utf-8"),
            )
        os.replace(temporary, output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="directory containing manifest.json")
    parser.add_argument("--output", required=True, help="destination ZIP file")
    args = parser.parse_args(argv)
    try:
        bundle(args.input, args.output)
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as error:
        parser.exit(1, "error: {}\n".format(error))


if __name__ == "__main__":
    main()
