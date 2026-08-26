# Third-party notices

## ApodexAI/FrontierAgent

The benchmark definitions, judge prompts, and parsing semantics in
`opencorvus_inspect.benchmark.apodex` are adapted from
[ApodexAI/FrontierAgent](https://github.com/ApodexAI/FrontierAgent) commit
`3364b7a51b5b235d6de10f692160980bfb7544e9`, specifically the public
BrowseComp and FrontierScience benchmark integrations.

Copyright belongs to the original contributors. The source is licensed under
the Apache License, Version 2.0. OpenCorvus changed the execution boundary to
Inspect AI, removed FrontierAgent runtime/runner/Provider dependencies, added
versioned provenance and deterministic dataset manifests, and emits Inspect
Score values and metadata.

The Apache-2.0 license text is included in `LICENSES/Apache-2.0.txt`. The
package's own MIT license text is included separately in `LICENSES/MIT.txt`.

Third-party benchmark datasets are not distributed by this package and are not
covered by this code notice.
