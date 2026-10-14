# Existing non-Question Checkbox entry in the 406 fixture

Recommended real page path: **Settings → Product (产品) → Chat → Available connections (可用连接) → browser row**. `ConfigDialogHost` maps tab ID `code` to `ConversationCapabilityPanel experience="chat"`; both locale resources display the tab as `Chat`.

Current actual public input evidence is `options-main-single-after01/public-global-config.json`, returned status200: `mcp.browser.enabled=false`, `mcp.computer.enabled=false`, `prompt_profile.active=base`; no explicit `primary_assistant_capabilities` assignment exists. These public facts were read from the saved receipt, not a new server call. The selected Main Session is `ses_hoMDjTPoDk9IDR18i22B`; its exact directory comes from that scope's `ready.session.directory`, not the bootstrap `ready.project` directory.

Code basis:

- `ConversationCapabilityPanel.tsx:242–271` renders one existing Checkbox per `configured_server_refs` entry, checked from `assigned_server_refs`, disabled only while saving. The browser row has existing root accessibility text `Assign MCP connection browser to Chat` / `将 MCP 连接 browser 分配给 Chat`.
- `conversation/capability.ts:21–23, 93–102`: Chat defaults to empty skills/MCP assignment arrays when not configured.
- `conversation/capability.ts:196–223`: settings uses current Config, the native PrimaryAssistantRegistry and installed Skill catalog. Configured MCP refs are the sorted keys of the actual `config.mcp` object, so a configured disabled server still has an assignment row.
- `server/routes/conversation-capability.ts:18–22` explicitly documents that this public route does not read the active Expert Squad or Session overlay. It therefore follows a different code path from the observed Mission-create Base catalog error; this is source support, not a claim that the real page has already succeeded.
- `services/conversation-capability.ts` reads `GET /chat/capability?directory=<exact current project directory>` and mutates the same route with PATCH. The browser mutation is `{kind:"mcp_server",ref:"browser",assigned:true}` and then the actual inverse `assigned:false`.
- `conversation/capability.ts:286–308` writes only project `primary_assistant_capabilities.chat` through `Config.updateProjectPatchAtomic`, then rereads the real settings. It does not set MCP `enabled`, call connect or send a model prompt.

Minimal Root manual sample after the Question's actual natural idle:

1. Open Settings and choose Product → Chat for the original selected Session/project. Scroll to Available connections and inspect browser/computer rows.
2. Record the actual initial browser checkbox and row state. Source predicts unassigned/unchecked for this untouched fixture; if live state differs, use the actual value and preserve it.
3. Focus/toggle the browser Checkbox once by native Space or actual pointer, wait for the original PATCH response and actual checked state, capture it, then toggle it back and confirm the original assignment is restored. Do not start a Provider, MCP connection, Task or goal.
4. This is a non-Question, no-new-description consumer sample. Its existing row/root accessibility layout is unchanged; do not claim that this batch fixed any separately observed naming issue in label-free controls. If capability loading fails, preserve the exact actual error and stop treating this candidate as successful.

Rejected as current shortcuts: ContinuousGoal's checkbox is inside editing of a paused/blocked existing goal, not the create dialog. Mailbox's select-visible control requires visible rows; an empty Inbox does not expose it. FileChangesView's Hide non-text checkbox requires actual change rows. MissionCreate has the independently observed Base catalog failure and was canceled without creating a Mission. None of those prerequisites should be fabricated just to obtain a shared primitive screenshot.

This note is read-only guidance: no public request, browser, service, Provider, UI test or product edit was performed.
