# First qualification failure

Actual child import failed with OpenCorvusTestRuntimeIsolationError / INVALID_OPENCORVUS_TEST_RUNTIME because OPENCORVUS_TEST_HOME requires an absolute OPENCORVUS_TEST_PROCESS_ROOT. No identity outcome was returned. Reviewed util/runtime-paths.ts82-98: runtime must be a child of the process root. Final child binds the exact owned diagnostic root plus its runtime/home children; no default user or original109 path is used.
