# Public description synchronization116

The first normal push of473d1666 was rejected by the actual route inventory check: the current ReadAgentMessageInputSchema description is also exposed through the public Panel action, while the tracked OpenAPI snapshot retained the previous text. The complete original failed push is retained as first-normal-push-failed.log; no hook was bypassed.

Root searched all current and historic consumers, read the isolated OpenAPI generator and atomic SDK build, and saved the three clean tracked preimages. The existing packages/sdk/js/script/build.ts completed with exit0 and compiled its staged SDK before atomic replacement. Complete actual-generated-diff.patch has exactly one description change in openapi.json and the matching two SDK generated comments; routes, fields, enums, response types and runtime code are unchanged.

The original api:routes-check rerun passed six rules and the inventory across34 files. Declared docs:check passed345 operations/25 groups. Raw sdk-build/routes-after-sdk/docs-after-sdk logs are preserved. This is necessary generated-public-contract synchronization for116, not a new model/UI claim or app/Squad version/release update. The root all-artifact generator was not run. Historic baseline/preimages and the original failed115 Task remain intact.
