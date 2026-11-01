"""Download document bytes without confusing business IDs with paths."""

import argparse
import base64
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def download(config, root):
    """Write all jobs, then publish the completion receipt.

    IDs are opaque Unicode text. Only output names are filesystem paths;
    their original spelling is retained separately for the receipt.
    """
    base_url = config["base_url"]
    parts = urllib.parse.urlsplit(base_url)
    if (
        parts.scheme not in ("http", "https")
        or not parts.netloc
        or parts.query
        or parts.fragment
    ):
        raise ValueError("base_url must be an HTTP URL without query or fragment")
    jobs = config["jobs"]
    if not isinstance(jobs, list):
        raise ValueError("jobs must be a list")

    root = Path(root).resolve()
    prepared = []
    targets = set()
    for job in jobs:
        document_id, output = job["document_id"], job["output"]
        if not isinstance(document_id, str) or not document_id:
            raise ValueError("document_id must be nonempty text")
        if not isinstance(output, str) or not output:
            raise ValueError("output must be a relative native filesystem path")
        path = Path(output)
        target = (root / path).resolve()
        if (
            path.is_absolute()
            or path.drive
            or ".." in path.parts
            or root not in target.parents
            or target == root / "receipt.json"
        ):
            raise ValueError(
                "output must stay under the output directory and not be receipt.json"
            )
        if target in targets:
            raise ValueError("output paths must be distinct")
        targets.add(target)
        # Never unquote first: a literal '%2F' ID must become '%252F'.
        url = (
            (base_url[:-1] if base_url.endswith("/") else base_url)
            + "/documents/"
            + urllib.parse.quote(document_id, safe="")
        )
        prepared.append((document_id, output, target, url))

    root.mkdir(parents=True, exist_ok=True)
    receipt = root / "receipt.json"
    # A failed rerun must not leave an old receipt claiming completion.
    if receipt.exists():
        receipt.unlink()
    files = []
    for document_id, output, target, url in prepared:
        with urllib.request.urlopen(url) as response:
            if response.status != 200:
                raise ValueError("document response must have HTTP status 200")
            data = json.load(response)
        if data["document_id"] != document_id:
            raise ValueError("response document_id does not match the requested ID")
        raw = base64.b64decode(data["content_base64"], validate=True)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        files.append(
            dict(document_id=document_id, output=output, url=url, bytes=len(raw))
        )
    receipt.write_text(
        json.dumps(
            {"files": sorted(files, key=lambda item: item["document_id"])},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="UTF-8 jobs JSON file")
    parser.add_argument("--output", required=True, help="output directory")
    args = parser.parse_args(argv)
    try:
        config = json.loads(Path(args.input).read_text(encoding="utf-8"))
        download(config, args.output)
    except (OSError, ValueError, TypeError, KeyError, urllib.error.URLError) as error:
        print("Download failed: {}".format(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
