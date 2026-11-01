"""Stage one selected public GDPval task; keep its original files outside Git.

This is evaluator preparation, never a candidate tool. Public and expert material
are written to separate directories. No remote evaluation or model call occurs.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

REVISION = "11e7900cdcac61bc4daf59e65feb238acda98fbf"
BASE = "https://huggingface.co/datasets/openai/gdpval/resolve/" + REVISION + "/"


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--row-index", type=int, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    root.mkdir(parents=True, exist_ok=False)
    receipt = {"task_id": args.task_id, "revision": REVISION,
               "started": datetime.datetime.now(datetime.timezone.utc).isoformat(), "files": []}

    def save(relative, data, url):
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        receipt["files"].append({"path": relative, "url": url, "bytes": len(data),
                                 "sha256": hashlib.sha256(data).hexdigest()})

    # The selected row is captured verbatim. The immutable complete parquet is
    # retained too; the live row service has no separately verified revision.
    row_url = ("https://datasets-server.huggingface.co/rows?dataset=openai/gdpval"
               f"&config=default&split=train&offset={args.row_index}&length=1")
    raw = fetch(row_url)
    save("originals/row-service.json", raw, row_url)
    row = json.loads(raw)["rows"][0]["row"]
    if row["task_id"] != args.task_id:
        raise ValueError("ROW_IDENTITY_MISMATCH")
    save("originals/dataset.parquet", fetch(BASE + "data/train-00000-of-00001.parquet"),
         BASE + "data/train-00000-of-00001.parquet")
    save("originals/README.md", fetch(BASE + "README.md"), BASE + "README.md")
    save("public/TASK.original.txt", row["prompt"].encode("utf-8"), row_url)
    save("evaluator/rubric.original.json", row["rubric_json"].encode("utf-8"), row_url)
    save("evaluator/rubric.original.txt", row["rubric_pretty"].encode("utf-8"), row_url)
    for field, group in [("reference_files", "public"), ("deliverable_files", "expert")]:
        for remote in row[field]:
            url = BASE + urllib.parse.quote(remote, safe="/")
            save(group + "/" + Path(remote).name, fetch(url), url)
    receipt["row_service_revision_verified"] = False
    receipt["identity_scope"] = "Downloaded original byte identity only; not scientific correctness."
    receipt["completed"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (root / "download-receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps({"root": str(root), "task_id": args.task_id, "files": len(receipt["files"])}))


if __name__ == "__main__":
    main()
