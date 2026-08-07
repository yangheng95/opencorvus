# Install this skill in an assistant

This file installs the `opencorvus` Agent Skill. It does not install the OpenCorvus runtime.

## Package layout

Copy the complete directory, not only `SKILL.md`:

```text
opencorvus/
├── SKILL.md
├── agents/openai.yaml
└── references/*.md
```

The `agents/openai.yaml` file is optional host metadata. Hermes Agent and OpenClaw use `SKILL.md` and its relative references.

## Hermes Agent

Hermes discovers skills below `~/.hermes/skills/`, including grouped subdirectories. From an OpenCorvus checkout, copy the complete package into a category directory:

```bash
mkdir -p ~/.hermes/skills/developer-tools
cp -R ./skills/opencorvus ~/.hermes/skills/developer-tools/opencorvus
hermes skills list
```

On PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME\.hermes\skills\developer-tools" | Out-Null
Copy-Item -Recurse -Force ".\skills\opencorvus" "$HOME\.hermes\skills\developer-tools\opencorvus"
hermes skills list
```

Start a new session, use `/reset`, or install with the Hermes `--now` option when using a supported Uniform Resource Locator (URL) install. Invoke the skill with:

```text
/opencorvus Install OpenCorvus in this environment and verify it.
```

Hermes can also install a published `SKILL.md` URL together with its referenced support files:

```bash
hermes skills install <published-SKILL.md-url> --name opencorvus
```

Do not substitute an unverified URL. Confirm the publisher and inspect the downloaded skill before enabling it.

## OpenClaw

From an OpenCorvus checkout, install the local skill into the active workspace:

```bash
openclaw skills install ./skills/opencorvus --as opencorvus
openclaw skills check
```

Add `--global` to the install command only when the user wants the skill shared by all local agents. OpenClaw also discovers manual copies under these roots, in descending precedence:

1. `<workspace>/skills`
2. `<workspace>/.agents/skills`
3. `~/.agents/skills` for the default state
4. `~/.openclaw/skills` by default for managed shared skills

Start a new session if the current session has an older skill snapshot. Invoke it in the Control user interface with `$opencorvus`, or use `/opencorvus` where slash commands are supported:

```text
Use $opencorvus to start a secured OpenCorvus service for this repository.
```

In non-Control messaging channels, prefer `/opencorvus`; `$name` references may remain ordinary text.

## Verify behavior

Ask a read-only question first:

```text
/opencorvus Check whether OpenCorvus is already installed. Do not change anything.
```

The assistant should inspect the environment, load the relevant reference, report the discovered command or checkout, and avoid installation mutations.
