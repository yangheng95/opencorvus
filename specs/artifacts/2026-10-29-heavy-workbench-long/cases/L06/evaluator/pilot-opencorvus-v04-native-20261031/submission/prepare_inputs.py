"""Copy public bytes, not Windows read-only attributes, to an execution input."""

from pathlib import Path
import argparse, json, shutil


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=False)
    records = []
    for source in sorted(a.source.rglob("*")):
        if source.is_file() and "__pycache__" not in source.parts:
            target = a.out / source.relative_to(a.source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            assert target.read_bytes() == source.read_bytes()
            records.append(
                {
                    "path": source.relative_to(a.source).as_posix(),
                    "bytes": source.stat().st_size,
                    "exact_bytes_equal": True,
                }
            )
    assert len(records) == 21
    (a.out.parent / (a.out.name + "-copy-record.json")).write_text(
        json.dumps(records, indent=2), encoding="utf-8"
    )
    print(
        "21 original input files copied with exact byte comparison; writable destination attributes"
    )


if __name__ == "__main__":
    main()
