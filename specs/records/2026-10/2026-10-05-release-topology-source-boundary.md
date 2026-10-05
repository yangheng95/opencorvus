# Release checker operational-source boundary

## Recall

- User authorizes continuous autonomous fixes, scoped commits and normal upstream push; local checker failures must be repaired and the original check rerun. No release/tag or hook bypass is authorized.
- Product batch db479ca1 is committed. Fetch/merge found upstream current and exactly that authorized commit pending. Its normal pre-push passed types/API/docs/leases/architecture/package checks but release-mutation-topology rejected an extra rest:release-write in specs/artifacts/dependency-remediation/dependency-advisory-details.json.
- Read/searched: whole checker, focused tests, pre-push hook, original/after authority lists, advisory JSON and unchanged operational release writers. Git diff proves the five canonical authorities unchanged. The error printed all six findings, not five new writers.
- Acceptance: the real frozen Git-tree checker must produce the same five canonical operational authorities. Unexpected operational CLI/wrapper/tag/REST writers retain their named topology-error contract. No UI test, external mutation or mutable source-hash gate.

## Qualified depth and selected repair

- operationalSource accepts every JSON path by extension, including the repository's mandated documentation/evidence namespace. The analyzer sees an HTTP write-method string somewhere in advisory data and an unrelated /releases link elsewhere, classifying that data as executable release authority. The canonical comparison rejects this incorrectly classified input.
- All CLI treeish/staged-index and hook callers share the same predicate/batched Git reader. Any specifications artifact JSON can hit this root; filename/advisory-keyword exceptions would preserve the faulty boundary. Existing release writers/parsers/authority declarations remain untouched.
- The specs namespace owns documentation/input/evidence under the user's repository contract. Exclude that whole namespace in the sole operationalSource classifier before extension selection. Preserve operational JSON, scripts, .github scanning, wrapper/REST detection and immutable Git-tree reads. This repairs ownership classification, not release authorization or an ignored-authority list.
- The existing positive frozen-tree test contains the exact committed advisory artifact and asserts all five canonical findings. Run it as actual regression proof. Remove its auxiliary forty-hex tree-shape assertion, which proves no authority/identity; real Git reads and exact functional inventory remain acceptance. Unexpected-writer tests assert named errors/findings and retain their positive error contracts.
- Update root/month indices and declared docs check. Commit checker/test/record/index separately, then fetch/merge/review both pending commits and rerun normal push. Product source stays frozen. No runtime, provider, package install or release mutation is involved.

## Actual repair qualification

The single source predicate now excludes specs before extension selection; the operational authority inventory/parsers are unchanged. Seven positive focused tests pass, including real frozen-index reading and exact named errors for each unexpected writer. The original committed product tree db479ca1 now passes the real CLI with exactly five canonical authorities. Declared docs:check passes345 operations/25 groups. The original hook failure is retained in iteration-03-push.log; normal push will be repeated after this separate repair commit and upstream synchronization.
