# Expert Squad Evolution benchmark resources

`manifest.json`, `development-manifest.json`, and `case-01.md` through `case-10.md` are generated immutable benchmark inputs from
`specs/artifacts/五客户端长链路业务与开发需求.md`. The launcher consumes only these generated resources; it does not
parse prose headings at runtime.

Regenerate after changing the source artifact:

```text
bun run packages/opencorvus/script/generate-evolution-benchmark-cases.ts
```

Verify freshness without writes:

```text
bun run packages/opencorvus/script/generate-evolution-benchmark-cases.ts --check
```

The parent-only `manifest.json` fixes the development set to Cases 3, 4, and 10; the holdout set to Cases 6 and 7; and final
certification to all ten Cases. UI-bearing Case resources only declare their real visual surface; P6 performs real app
interaction, screenshots, and manual review without UI automation tests or screenshot baselines.

`development-manifest.json` is the only Dataset index permitted inside a Candidate Author-readable isolated project. It
contains only Cases 3, 4, and 10. The parent launcher validates the total manifest outside that project, then copies only
this development index and its three exact Case resources. The total manifest, source artifact, holdout resources, and
certification resources must not be copied, attached, mounted, or exposed to that project.

The real development run also freezes these non-secret controls:

- `runtime-config.json`: the single model, provider, and permission configuration; it never stores credential values.
- `mission-request.md`: the visible Evolution Mission request and ownership boundaries.
- `permission-snapshot.json`: the permission snapshot shared by both arms.
- `statistics-contract.json`: the predeclared paired-comparison contract.
- `project-seed/README.md`: the minimal Git seed copied into all 18 Trial workspaces.
