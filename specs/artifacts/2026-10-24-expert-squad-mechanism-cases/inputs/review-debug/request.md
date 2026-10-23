# Original defect

Target: this concrete local project, `src/invoice.mjs`, exported function `invoiceTotalCents` and caller `check.mjs`. Input unitPrice is a nonnegative decimal currency string with exactly two fractional digits; quantity is a nonnegative integer. Output is the integer total in cents.

Reproduce from the project directory with `node check.mjs`. Current first result is 2400 cents; required result is 2800 cents. Repeated 9.99 × 3 must yield 2997 cents, zero and empty input must both yield zero. No network, dependency installation, UI, release or remote Git operation is needed or authorized. Preserve the supplied check as the original acceptance contract.

Investigate the full cause and relevant calls, repair the product source with focused positive regression verification, and have the read-only reviewers check the final repair evidence. Keep all work and evidence local to this isolated project.
