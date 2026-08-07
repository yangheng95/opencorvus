# Open-source readiness closeout

## Recall

- User request: finish the final checklist before OpenCorvus is made open source.
- Acceptance: repository policy and community files are present; release artifacts are produced only after the build matrix succeeds; published artifacts carry licenses, notices, and SHA-256 checksums; security automation exists; core and Overlay non-UI contracts, type checking, documentation, route generation, secret scanning, and Windows packaging pass from the current source tree.
- Hard constraints: preserve unrelated worktree changes; do not publish, push, restart, or close a running OpenCorvus instance without explicit authorization; do not add, update, retain, or run UI automation tests; validate UI changes only through an isolated real page and human screenshot review; retain a reviewable commit.
- Sources read: root `AGENTS.md`, existing release workflows, package scripts, release documentation, runtime executable contract, Overlay Tauri configuration, and all paths named by the repository checks.
- Repository-wide searches: release workflows and packaging scripts; version declarations; license and notice references; UI tests and their dedicated fixtures; runtime executable path readers; worktree and expert-squad test fixtures.
- Independent-agent feedback: none; the user did not request sub-agent delegation.

## Implementation record

1. Remove UI automation tests encountered during the closeout and delete their test-only browser fixture. Retain service, protocol, persistence, runtime, build, and type contracts.
2. Fix the Windows long-path executable packaging failure at the shared runtime executable filesystem boundary and cover platform capability differences with explicit fixtures.
3. Make GitHub release publication depend on the complete package matrix, and attach license, third-party notices, and SHA-256 checksums.
4. Add dependency review, secret scanning, and CodeQL workflows, and document the open-source support and release contract.
5. Run the final non-UI validation matrix, build the Windows executable and Overlay bundle, review the diff, then create one local commit without pushing.

## Codex review feedback

The initial closeout treated legacy Overlay source-string tests as ordinary unit tests. The newly added repository rule makes those tests invalid regardless of whether their assertions can be updated. The closeout was revised to delete the UI tests and their dedicated fixture, keep strict runtime/service contracts, and use build plus isolated visual review for UI evidence.
