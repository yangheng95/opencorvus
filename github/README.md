# opencorvus GitHub Action

A GitHub Action that integrates [opencorvus](https://opencorvus.ai) directly into comments, issue or PR lifecycle events, scheduled workflows, and manual workflow dispatch events.

Comment triggers read `/opencorvus` or `/oc`, and repository events use the configured workflow prompt. OpenCorvus executes tasks within your GitHub Actions runner.

## Features

#### Explain an issue

Leave the following comment on a GitHub issue. `opencorvus` will read the entire thread, including all comments, and reply with a clear explanation.

```
/opencorvus explain this issue
```

#### Fix an issue

Leave the following comment on a GitHub issue. opencorvus will create a new branch, implement the changes, and open a PR with the changes.

```
/opencorvus fix this
```

#### Review PRs and make changes

Leave the following comment on a GitHub PR. opencorvus will implement the requested change and commit it to the same PR.

```
Delete the attachment from S3 when the note is removed /oc
```

#### Review specific code lines

Leave a comment directly on code lines in the PR's "Files" tab. opencorvus will automatically detect the file, line numbers, and diff context to provide precise responses.

```
[Comment on specific lines in Files tab]
/oc add error handling here
```

When commenting on specific lines, opencorvus receives:

- The exact file being reviewed
- The specific lines of code
- The surrounding diff context
- Line number information

This allows for more targeted requests without needing to specify file paths or line numbers manually.

## Installation

The action runs the repository source entrypoint directly with Bun:
`bun "$GITHUB_ACTION_PATH/../packages/opencorvus/src/index.ts" github run`.
That runtime parses the GitHub event, creates the session, and calls `SessionPrompt.prompt` in-process.

Supported triggers:

- `issue_comment` - Issue and PR comments
- `pull_request_review_comment` - line-level PR review comments
- `issues` - issue lifecycle events
- `pull_request` - PR lifecycle events
- `schedule` - scheduled repository automation
- `workflow_dispatch` - manually triggered repository automation

Comment triggers read the `/opencorvus` or `/oc` request from the GitHub comment. `issues`, `schedule`, and `workflow_dispatch` require the `prompt` input because their payloads do not include a comment body. The quickstart workflow below enables comment triggers only; use the repository event workflow when you want issue, PR, scheduled, or manual automation.

1. Install the GitHub app https://github.com/apps/opencorvus-agent. Make sure it is installed on the target repository.
2. Add the following workflow file to `.github/workflows/opencorvus.yml` in your repo. Set the appropriate `model` and required API keys in `env`.

   ```yml
   name: opencorvus

   on:
     issue_comment:
       types: [created]
     pull_request_review_comment:
       types: [created]

   jobs:
     opencorvus:
       if: |
         contains(github.event.comment.body, ' /oc') ||
         startsWith(github.event.comment.body, '/oc') ||
         contains(github.event.comment.body, ' /opencorvus') ||
         startsWith(github.event.comment.body, '/opencorvus')
       runs-on: ubuntu-latest
       permissions:
         id-token: write
         contents: read
         pull-requests: read
         issues: read
       steps:
         - name: Checkout repository
           uses: actions/checkout@v7
           with:
             persist-credentials: false

         - name: Run OpenCorvus
           uses: yangheng95/opencorvus/github@latest
           env:
             ALIBABA_CODING_PLAN_API_KEY: ${{ secrets.ALIBABA_CODING_PLAN_API_KEY }}
             OPENCORVUS_PERMISSION: '{"bash": "deny"}'
           with:
             model: alibaba-coding-plan-cn/qwen3.5-plus
   ```

   Repository event workflow:

   ```yml
   name: opencorvus-repository

   on:
     issues:
       types: [opened, reopened]
     pull_request:
       types: [opened, synchronize, reopened, ready_for_review]
     schedule:
       - cron: "0 9 * * 1"
     workflow_dispatch: {}

   jobs:
     opencorvus:
       runs-on: ubuntu-latest
       permissions:
         id-token: write
         contents: read
         pull-requests: read
         issues: read
       steps:
         - name: Checkout repository
           uses: actions/checkout@v7
           with:
             persist-credentials: false

         - name: Run OpenCorvus
           uses: yangheng95/opencorvus/github@latest
           env:
             ALIBABA_CODING_PLAN_API_KEY: ${{ secrets.ALIBABA_CODING_PLAN_API_KEY }}
             OPENCORVUS_PERMISSION: '{"bash": "deny"}'
           with:
             model: alibaba-coding-plan-cn/qwen3.5-plus
             prompt: Maintain this repository from the triggering issue, pull request, schedule, or manual dispatch.
   ```

3. Store the API keys in secrets. In your organization or project **settings**, expand **Secrets and variables** on the left and select **Actions**. Add the required API keys.

## Support

This is an early release. If you encounter issues or have feedback, please create an issue at https://github.com/yangheng95/opencorvus/issues.

## Development

To validate changes locally, use the repository test suite instead of a personal repository token:

```bash
bun test packages/opencorvus/test/cli/github-action-run.test.ts
```

The runtime also accepts `--event` for repository tests that mock the GitHub event payload. Token exchange remains the same OIDC App-token path used by the published Action.

### Issue comment event

```
--event '{"eventName":"issue_comment","repo":{"owner":"sst","repo":"hello-world"},"actor":"fwang","payload":{"issue":{"number":4},"comment":{"id":1,"body":"hey opencorvus, summarize thread"}}}'
```

Replace:

- `"owner":"sst"` with repo owner
- `"repo":"hello-world"` with repo name
- `"actor":"fwang"` with the GitHub username of commenter
- `"number":4` with the GitHub issue id
- `"body":"hey opencorvus, summarize thread"` with comment body

### Issue comment with image attachment.

```
--event '{"eventName":"issue_comment","repo":{"owner":"sst","repo":"hello-world"},"actor":"fwang","payload":{"issue":{"number":4},"comment":{"id":1,"body":"hey opencorvus, what is in my image ![Image](https://github.com/user-attachments/assets/xxxxxxxx)"}}}'
```

Replace the image URL `https://github.com/user-attachments/assets/xxxxxxxx` with a valid GitHub attachment (you can generate one by commenting with an image in any issue).

### PR comment event

```
--event '{"eventName":"issue_comment","repo":{"owner":"sst","repo":"hello-world"},"actor":"fwang","payload":{"issue":{"number":4,"pull_request":{}},"comment":{"id":1,"body":"hey opencorvus, summarize thread"}}}'
```

### PR review comment event

```
--event '{"eventName":"pull_request_review_comment","repo":{"owner":"sst","repo":"hello-world"},"actor":"fwang","payload":{"pull_request":{"number":7},"comment":{"id":1,"body":"hey opencorvus, add error handling","path":"src/components/Button.tsx","diff_hunk":"@@ -45,8 +45,11 @@\n- const handleClick = () => {\n-   console.log('clicked')\n+ const handleClick = useCallback(() => {\n+   console.log('clicked')\n+   doSomething()\n+ }, [doSomething])","line":47,"original_line":45,"position":10,"commit_id":"abc123","original_commit_id":"def456"}}}'
```
