# Third-Party Notices

OpenCorvus includes and adapts open-source software. Dependency package
manifests and lockfiles identify the complete dependency graph; the notices
below cover source-derived work and bundled capability payloads that require a
durable attribution path outside the package manager graph.

## OpenCode

Parts of OpenCorvus evolved from OpenCode and retain explicitly identified,
synchronized OpenCode work.

Upstream: <https://github.com/anomalyco/opencode>

```text
MIT License

Copyright (c) 2025 opencode

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Built-in capability payloads

Adapted built-in Skills retain their own license and provenance files:

- `packages/opencorvus/src/skill/builtin/design-taste-frontend/`
- `packages/opencorvus/src/skill/builtin/grill-me/`
- `packages/opencorvus/src/skill/builtin/office-artifacts/PROVENANCE.md`

The packaged OfficeCLI runtime carries its upstream license and immutable
runtime lock under each release closure's `licenses/` directory.

All other third-party packages remain governed by the license files and
metadata distributed with those packages. Product and project names are the
property of their respective owners; inclusion does not imply endorsement.
