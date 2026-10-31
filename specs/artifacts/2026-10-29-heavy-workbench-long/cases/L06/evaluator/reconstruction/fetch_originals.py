"""Cache the named MIRPLIB original inputs for local research; do not redistribute them."""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import urllib.request
import zipfile


SOURCES = {
    "Group1_data_format_only_files.zip": "https://mirplib.scl.gatech.edu/sites/default/files/Group1_data_format_only_files.zip",
    "Group1_MPS_files.zip": "https://mirplib.scl.gatech.edu/sites/default/files/Group1_MPS_files.zip",
    "Group1_MIP_Model.pdf": "https://mirplib.scl.gatech.edu/sites/default/files/Group1_MIP_Model.pdf",
    "Data_only_format_instructions.pdf": "https://mirplib.scl.gatech.edu/sites/default/files/Data_only_format_instructions.pdf",
    "Group1_Incumbents.zip": "https://mirplib.scl.gatech.edu/sites/default/files/Group1_Incumbents.zip",
}
INSTANCE_NAMES = [
    "LR1_1_DR1_3_VC1_V7a",
    "LR1_2_DR1_3_VC3_V8a",
    "LR2_22_DR2_22_VC3_V10a",
]
GROUP2_PROFILE = {
    "sources": {
        "Group2_data_format_only_files.zip": "https://mirplib.scl.gatech.edu/sites/default/files/Group2_data_format_only_files.zip",
        "Group2_MPS_files.zip": "https://mirplib.scl.gatech.edu/sites/default/files/Group2_MPS_files.zip",
        "Group2_MIP_Model.pdf": "https://mirplib.scl.gatech.edu/sites/default/files/Group2_MIP_Model.pdf",
    },
    "instances": ["LR1_DR02_VC01_V6a", "LR1_DR02_VC05_V8a", "LR1_DR03_VC03_V16a"],
    "periods": 120,
}


def acquire(root: Path, sources: dict, instance_names: list, periods: int):
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    receipt = {
        "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "original third-party input acquisition, not solver or benchmark acceptance",
        "redistribution": "not established; originals retained only in external local research cache",
        "registered_original_instances": instance_names,
        "original_periods": periods,
        "downloads": [],
    }
    for name, url in sources.items():
        target = root / name
        if target.exists():
            raise FileExistsError(f"Preserve prior download and its receipt: {target}")
        record = {"url": url, "path": str(target)}
        with urllib.request.urlopen(url, timeout=60) as response, target.open("xb") as output:
            record.update(status=response.status, content_type=response.headers.get("Content-Type"),
                          last_modified=response.headers.get("Last-Modified"), etag=response.headers.get("ETag"))
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        raw = target.read_bytes()
        record.update(bytes=len(raw), immutable_resource_sha256=hashlib.sha256(raw).hexdigest())
        if target.suffix == ".zip":
            with zipfile.ZipFile(target) as archive:
                record["members"] = [{"name": x.filename, "bytes": x.file_size, "crc32": x.CRC}
                                     for x in archive.infolist()]
                record["original_instance_members"] = {
                    instance: [x.filename for x in archive.infolist()
                               if instance.lower() in x.filename.lower()]
                    for instance in instance_names
                }
        receipt["downloads"].append(record)
        (root / "acquisition.partial.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({k: record[k] for k in ["url", "path", "status", "bytes"]}), flush=True)
    receipt["finished_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (root / "acquisition.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--group", choices=["1", "2"], required=True)
    args = parser.parse_args()
    if args.group == "1":
        acquire(args.out, SOURCES, INSTANCE_NAMES, 45)
    else:
        acquire(args.out, GROUP2_PROFILE["sources"], GROUP2_PROFILE["instances"], GROUP2_PROFILE["periods"])


if __name__ == "__main__":
    main()
