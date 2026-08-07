# Install and configure OpenCorvus

## Supported installation authority

The current project documentation identifies a source build as the verifiable installation path. Use it unless the user provides a specific release artifact and its matching first-party instructions.

Prerequisites:

- Git
- Bun `1.3.14`, matching the root `packageManager` declaration
- network access to clone the repository and install dependencies
- a model-provider credential or supported sign-in method

Never paste a secret into source files, chat output, shell history when avoidable, or version control.

## Build from source

```bash
git clone https://github.com/yangheng95/opencorvus.git
cd opencorvus
bun install
bun run --cwd packages/opencorvus build
bun packages/opencorvus/src/index.ts doctor
```

Treat a nonzero `doctor` exit as a real failure. Warnings remain visible; use `doctor --strict` when the user requires warning-free capability health.

Keep the source entry point explicit when the built command is not installed globally:

```bash
OPENCORVUS_SOURCE=/absolute/path/to/opencorvus/packages/opencorvus/src/index.ts
bun "$OPENCORVUS_SOURCE" doctor
```

In PowerShell:

```powershell
$opencorvusSource = "C:\absolute\path\to\opencorvus\packages\opencorvus\src\index.ts"
bun $opencorvusSource doctor
```

Do not overload common environment variables such as `HOME` or `PATH` to store this path.

## Configure a provider

Use the interactive credential flow when possible:

```bash
bun "$OPENCORVUS_SOURCE" auth login
bun "$OPENCORVUS_SOURCE" auth list
bun "$OPENCORVUS_SOURCE" models
```

If the installed `opencorvus` command exists, the equivalent commands are:

```bash
opencorvus auth login
opencorvus auth list
opencorvus models
```

Provider environment variables such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENROUTER_API_KEY` are also supported when the selected provider uses them. Set only the credential required for the chosen provider. Confirm availability with `auth list` and `models`; never assume an environment variable name proves that a usable model exists.

Model identifiers use `provider/model`, for example a provider identifier followed by its exact listed model identifier. Select from `models`; do not guess a model name.

## Optional configuration

Project configuration lives at `.opencorvus/opencorvus.jsonc`. Global configuration lives under the OpenCorvus runtime configuration root. To discover resolved paths and configuration, use:

```bash
opencorvus debug paths
opencorvus debug config
```

The principal model keys are:

```jsonc
{
  "$schema": "https://opencorvus.ai/config.json",
  "model": "provider/model-id",
  "small_model": "provider/model-id"
}
```

Configuration precedence, from lower to higher, is remote organization defaults, global configuration, `OPENCORVUS_CONFIG`, project configuration, other local `.opencorvus` resources, and `OPENCORVUS_CONFIG_CONTENT`. Managed enterprise configuration overrides those sources. Edit the authoritative scope requested by the user; do not write the same setting in multiple scopes.

## Installation acceptance

Record all of the following:

1. the OpenCorvus checkout or binary path;
2. `doctor` summary and unresolved warnings;
3. authenticated provider identities without secret values;
4. at least one exact model returned by `models`;
5. the project directory that OpenCorvus will operate on.
