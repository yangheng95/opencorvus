"""Build a manifest-selected ZIP without decoding payload data."""

import argparse
import json
import os
from pathlib import Path, PureWindowsPath
import tempfile
import zipfile


INDEX_PATH = "_bundle_index.json"


def validate_path(value, *, target=False):
    """Validate names without rewriting legal Unicode or punctuation."""
    if not isinstance(value, str) or not value or "\0" in value:
        raise ValueError("paths must be nonempty strings without NUL")
    # Sources use native filesystem syntax; ZIP targets always use '/'.
    if not target and "\\" in value:
        raise ValueError("evaluation-only source-domain regression")
    parts = value.split("/") if target else Path(value).parts
    if (
        value.startswith("/")
        or PureWindowsPath(value).drive
        or Path(value).is_absolute()
        or ".." in parts
        or (target and ("\\" in value or any(p in ("", ".") for p in parts)))
    ):
        raise ValueError(f"unsafe relative path: {value!r}")
    return value


def read_entries(root):
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or not isinstance(manifest.get("files"), list):
        raise ValueError("manifest must contain a files array")
    entries = []
    seen = set()
    for row in manifest["files"]:
        if not isinstance(row, dict) or "source" not in row or "target" not in row:
            raise ValueError("each file must contain source and target")
        source = root / validate_path(row["source"])
        target = validate_path(row["target"], target=True)
        if target == INDEX_PATH or target in seen:
            raise ValueError(f"duplicate or reserved target: {target!r}")
        if not source.resolve().is_relative_to(root.resolve()) or not source.is_file():
            raise ValueError(
                f"source is not a file inside the input directory: {row['source']!r}"
            )
        seen.add(target)
        entries.append((target, source))
    return sorted(entries)


def create_bundle(root, output):
    entries = read_entries(root)
    if output.resolve() in {source.resolve() for _, source in entries} | {
        (root / "manifest.json").resolve()
    }:
        raise ValueError("output must not overwrite a selected source or manifest")
    # Publish only a completed archive; failures leave any previous output intact.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=output.parent, suffix=".zip", delete=False
        ) as handle:
            temporary = Path(handle.name)
        index = []
        with zipfile.ZipFile(
            temporary, "w", compression=zipfile.ZIP_DEFLATED
        ) as archive:
            for target, source in entries:
                count = 0
                with (
                    source.open("rb") as incoming,
                    archive.open(target, "w", force_zip64=True) as outgoing,
                ):
                    while True:
                        chunk = incoming.read(1024 * 1024)
                        if not chunk:
                            break
                        outgoing.write(chunk)
                        count += len(chunk)
                index.append({"path": target, "bytes": count})
            archive.writestr(
                INDEX_PATH,
                json.dumps({"files": index}, ensure_ascii=False).encode("utf-8"),
            )
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="directory containing manifest.json")
    parser.add_argument(
        "--output", required=True, type=Path, help="destination ZIP file"
    )
    args = parser.parse_args()
    try:
        create_bundle(args.input, args.output)
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        parser.exit(1, f"error: {error}\n")


if __name__ == "__main__":
    main()
