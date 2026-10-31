"""Identity only: compare delivered binary bytes to independently published refs.

These are immutable snapshot identity checks, not functional acceptance checks.
Behavior, optimum and completeness are established separately by reconciliation.
"""

import hashlib, json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
expected = {
    "submission/dependencies.zip": "9c3e7b5efd9d040dc4a8b9952c1858cabe03d7989f9b839ce537c74932f662aa",
    "submission/report.pdf": "d5b3a6b7608d6d3816d3c562f50ea50a71c0c574983f797112d7d0dbbc951e99",
    "submission/report.md": "55a69390136884f045aef01646585ceec6e76f5e08802b930a91f88f527e6882",
    "submission/exports-complete/stage-ledger.csv": "6e614e2183ee2edce50112a1a9cc14dc1b9040429aab75020ca2637acf29140f",
    "submission/exports-complete/summary.json": "3a989761a2bd2e08b52ae39e4f657e5e00938445b49ea4e92c780e5451063d24",
    "submission/figures/belief-information.png": "844eb0c6b4126e7e461a34f8408c94fe419f7e2144f3a8142891eaa6cd56d52d",
    "submission/figures/cash.png": "ab4a4350ac180c3649e1e908d1c8000c0b9599f24148aa2d83e965765cb58a12",
    "submission/figures/cost-information.png": "eac60b05830ef4cd3b80e3be7e059a351ae121cd0fc41cda8d3b523ff9373078",
    "submission/figures/decisions.png": "e2b11877da6e29ca31850675c909d5e143db900b0fd33e7ec7e8b9ff5763a2a9",
    "submission/figures/material.png": "eeb65d52884f67871d8e4e378dd0951ef55751b779e86d2dcd9277aa9c4e5297",
}
for path, digest in expected.items():
    assert hashlib.sha256((root / path).read_bytes()).hexdigest() == digest, path
for ident in ["base", "cash-tight", "shifted-prior"]:
    a = json.loads(
        (root / "submission/review/rebuilt/actor/tables" / f"{ident}.json").read_text()
    )
    b = json.loads((root / "submission/actor/tables" / f"{ident}.json").read_text())
    assert a == b
result = {
    "identity_reference": "immutable Task snapshot 5f46f60d-7a84-5ad7-a1e8-2c99b339953e, resources tree",
    "purpose": "Exact binary publication/primary identity, not correctness or completeness proof",
    "verified_files": list(expected),
    "published_source_fresh_rebuild_tables_equal": True,
}
(root / "submission/review/publication-identity.json").write_text(
    json.dumps(result, indent=2)
)
print(json.dumps(result, indent=2))
