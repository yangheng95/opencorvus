# Explorer upload translation consumers

Read-only repository searches after implementation; no tests or UI text assertions were added or run for this audit.

Commands:

```text
rg -n 'explorer\.upload_(error|reload_error)' . --glob '!specs/artifacts/**' --glob '!**/dist*/**' --glob '!packages/opencorvus/bun/**'
git show HEAD:packages/overlay/src/components/FileExplorerPanel.tsx | rg -n 'explorer\.upload_(error|reload_error)'
rg -n 'upload_error|upload_reload_error' packages/overlay/src packages/overlay/test packages/overlay/script --glob '*.ts' --glob '*.tsx' --glob '*.json'
```

Original search output chunks `3ebc2e` and `102720`:

- Current authored consumers of `explorer.upload_reload_error`: `FileExplorerPanel.tsx:240` calls `tc(key, feedback.count, { count: localizedCount, target })`; two declarations at `i18n/en-US.json:1454` and `i18n/zh-CN.json:1453` are plural objects. No other production, test or script consumer was returned.
- Current `explorer.upload_error`: no authored match returned.
- Original HEAD component was the only found caller of the old keys: line 1349 called `t("explorer.upload_reload_error", { message })`; line 1359 called `setUploadMessage(t("explorer.upload_error", { message }))`.
- The old unstructured upload-error key is replaced by `explorer.upload_failed` only for the existing upload operation's generic failure summary. The original cause stays in its existing upload feedback owner.
- All other new Explorer error keys are declared in both catalogs and consumed only by this component's operation-name/NamedError-data rendering or expanded-directory feedback. Historical artifacts and built output were excluded as records/derived files, not treated as extra current implementations.

This is a consumer/source audit, not a localization screenshot or UI acceptance result.
