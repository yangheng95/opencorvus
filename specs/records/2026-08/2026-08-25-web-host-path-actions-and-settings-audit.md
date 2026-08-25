# Web host path actions, and a settings-surface audit

## Recall

**用户原始要求**（2026-08-25，两条）：

1. 「继续检查设置页面里面的组件功能是否完整正常可用」
2. 「然后给 web 版本都加上文件管理器打开的 fallback」

**验收指标**

- 设置页每个分区在 Web 版真实渲染，控件可用；不可用项必须有说明，不得静默空白。
- Web 版每一个「用文件管理器打开」入口都能给出可用动作，不得消失、不得抛技术错误。
- 桌面版行为不变。

**硬约束**（`AGENTS.md`）

- 二-2「每项能力只能有一个当前实现和一个事实来源。禁止 fallback（后备路径）……」
  → 本任务不在 `nativeOpen` 内部加降级分支。`utils/native.ts` 现有注释同样写明
  「no silent fallback to `window.open`」。改动落在 **UI 动作选择**：同一个位置，按
  宿主能力提供**不同的动作**，与仓库既有的 `manualWorkspacePathEntry`、
  `projectEditors: []`、`desktopUpdateSupported()` 同构。用户所说的 fallback 指
  「Web 版没有可用入口」这一缺口，不是要求同一能力的第二条实现路径。
- 三「端到端验收一般启动项目开发模式，并通过 `http://localhost:<port>/ui` 使用 Web UI」
  → 已用 `opencorvus serve` + `/ui` 验收，未单独启动 Vite 作为验收入口
  （仅用 `build:vite` 产出 `/ui` 所需的 `dist-vite`）。
- 六「工作区可能包含用户或并行任务的改动；只修改本任务文件」
  → 用户 `AppData` 下的真实数据库 schema 与本分支不匹配，`serve` 要求重置。
  **未重置**；改用 `OPENCORVUS_HOME` 指向 scratchpad 的隔离实例验收。
- 四「UI 验收只能使用真实页面交互、截图和人工视觉复核」「禁止新增 UI 自动化测试」
  → 不新增任何 UI 测试；服务层契约用非 UI 正向测试覆盖。

**已读资料**

- `AGENTS.md` 全文
- `packages/overlay/src/services/host-transport.ts`（`HOST_CAPABILITIES`、`HostCapabilities`）
- `packages/overlay/src/services/tauri-transport.ts`（`native()` 的 browser 分支）
- `packages/overlay/src/services/host-transport-runtime.ts`
- `packages/overlay/src/services/workspace.ts`（`openDirectory` / `browseDirectory` / `openProjectPathInEditor`）
- `packages/overlay/src/utils/native.ts`（`nativeOpen` 及其禁止降级的注释）
- `packages/overlay/src/services/app-dialog.ts`（`nativeMessage` / `showAppDialog`）
- `packages/opencorvus/src/server/overlay-ui.ts`（`/ui` 由 `packages/overlay/dist-vite` 提供）

**全仓搜索结果**

- `nativeCommands["open-path"]` 消费点 6 处：`WorkspaceEditorLaunchers.tsx:33`、
  `SkillMarketPanel.tsx:242`、`main.tsx:2161`、`workspace.ts:962`、
  `tauri-transport.ts:561`、`host-transport.ts:165/196`。
- 调用 `nativeOpen` 的设置面板 3 处：`ChannelsPanel.tsx:289`、
  `MissionSkillPanel.tsx:157`、`SkillMarketPanel.tsx:387`。
- `openDirectory` 调用点：`TaskDirBar.tsx:705,1420`、`WorkspaceEditorLaunchers.tsx:75`、
  `main.tsx:758`。
- `manualWorkspacePathEntry` 唯一消费点：`workspace.ts:840`（已正确处理 Web）。
- 既有的「能力缺失说明」范式：`DesktopUpdatePanel.tsx:29`
  `<Show when={desktopUpdateSupported()} fallback={<SettingsState>…</SettingsState>}>`。

**独立 agent 反馈**：实施完成后补记；当前为「无」。

---

## 一、设置页分区检查（要求 1）

### 方法

`OPENCORVUS_HOME` 隔离实例 + `opencorvus serve`（`http://127.0.0.1:7878/ui/`），
CDP 驱动真实页面：逐个点击 17 个 `.oc-tab`，采集面板挂载、可交互控件数、
提示文案、page error。分别在「无活动项目目录」和「有活动项目目录」两种前置下各跑一轮。

活动目录通过真实交互建立：命令面板 → `Open folder` → Web 版按
`manualWorkspacePathEntry` 弹出路径输入框 → 填入 fixture 目录 → `Use this folder`。
**这条路径本身即证明 Web 版的目录选择可用。**

### 结果

17 个分区全部真实渲染，无一空白、无渲染异常。有活动目录后的控件数：

| 分区 | 控件 | 备注 |
|---|---|---|
| General / Appearance / Network / Usage | 4 / 6 / 12 / 5 | 正常 |
| Chat / Work | 12 / 12 | 无目录时 0，并给出「Open a project directory…」前置说明 |
| Mission Card | 10 | 正常，附 Mission-only 说明 |
| Scheduled tasks | 13 | 正常 |
| Squad Market | 6 | 正常 |
| Installed Expert Squads | 14 | 无目录时 0，并给出前置说明 |
| Providers | 210 | 正常 |
| Skill Library | 12 | 正常（内置技能列表、Install Skill、Reload、拖放区） |
| MCP Connections | 2 | 正常 |
| Channel | 29 | 无目录时 2 |
| Memory & Context | 5 | 正常，附「Select a Task」说明 |
| Archive | 0 | 空归档，属正常空态 |
| About | 0 | 正确显示「Updates are managed by the installed desktop application.」 |

**未发现设置分区功能缺失。** 需要项目目录的 4 个分区在缺目录时给出明确前置说明，
符合既有范式，不是缺陷。

两点必须如实记录：

- 初次打开设置时曾观察到 General 分区**纯空白**。追查为面板懒加载延迟（约 2–5 秒），
  期间没有任何加载指示。渲染本身无异常，无 page error。这是体验问题，不在本次
  用户要求范围内，单独记录，未改。
- 隔离实例的 `/expert-squad/market/detail` 返回 404/500（`advanced`、`base` 包不存在）。
  属隔离环境未安装 market 包，非代码缺陷。

## 二、Web 版「用文件管理器打开」缺口（要求 2）

### 现象与根因

`HOST_CAPABILITIES.browser.nativeCommands["open-path"] === false`
（`host-transport.ts:196`），`tauri-transport.ts` 的 browser 分支只实现
`settings.load/save`、`clipboard.writeText`、`notification.*`，其余一律
`nativeUnsupported("browser", command)` 抛错。浏览器确实无法调用系统文件管理器，
**该能力值本身正确，不改**。

问题在消费端各行其是，共 3 种互不一致的处理：

| 位置 | 当前 Web 行为 |
|---|---|
| `WorkspaceEditorLaunchers.tsx:122` | `<Show when={canOpenDirectory}>` → 菜单项消失 |
| `SkillMarketPanel.tsx:838` | `<Show when={… canOpenLocalPath()}>` → 按钮消失，且 `handleOpenSkill:385` 再守一次静默 return |
| `ProjectLedgerGroup.tsx:232` | `<Show when={canOpenProjectDirectory()}>` → 菜单项消失 |
| `MissionSkillPanel.tsx:154` | **无守卫** → `nativeOpen` 抛 `UnsupportedNativeCommandError` → 显示技术错误文案 |

即：Web 用户要么看不到入口，要么点了得到一句报错。没有任何一处告诉他路径是什么。

### 方案

`services/workspace.ts` 新增单一事实源：

```ts
export type PathRevealOutcome = "opened" | "copied"

/** 把一个文件系统路径交给用户 —— 用当前宿主真正能做到的方式。 */
export async function revealPath(target: string): Promise<PathRevealOutcome>

/** 当前宿主提供的动作对应的 i18n key。 */
export function pathRevealLabelKey(): "cwd.open" | "cwd.copy_path"
```

- 有 `open-path` → `nativeOpen(target)` → `"opened"`
- 无 → `clipboard.writeText`（browser 能力表为 `true`）→ `"copied"`
- 失败照常抛出，由既有 catch 呈现

四处消费点改为：调用 `revealPath`，标签取 `pathRevealLabelKey()`，
`"copied"` 时用各自既有的提示机制（`nativeMessage` / `setPanelNotice` / `setNotice`）
告知路径已复制。移除各自的隐藏守卫与重复判断。

`nativeOpen` 不变，`open-path` 能力值不变，不新增第二条打开实现。

### i18n

新增 `cwd.copy_path`、`cwd.path_copied`（en-US / zh-CN 两份，键序与既有文件一致）。

### 不做

- 不改 `BROWSER_NATIVE_COMMANDS["open-url"]`。浏览器宿主本可用 `window.open` 真正实现
  它（现为 `false`，导致 Web 版所有外链入口同样不可用），但那是**新增一项宿主能力实现**，
  与本次「文件管理器打开」不同源，且 `native.ts` 的现有注释显式约束过这条路径。
  作为发现单独上报，等用户决定。
- 不动懒加载无加载指示的问题（见上）。

## 三、落地

`services/workspace.ts`

- 新增 `revealPath` / `pathRevealLabelKey` / `pathRevealNoticeKey` / `pathRevealFailureKey`。
- `openDirectory` 改为经 `revealPath`，成功走 `cwd.path_copied`，失败按宿主选
  `cwd.open_failed` 或 `cwd.copy_failed`。
- `revealPath` 内部错误刻意不走 i18n：它由各调用方转成自己的用户文案，
  与 `nativeOpen` 的 `"native open returned false"` 同风格。

消费点

| 文件 | 改动 |
|---|---|
| `main.tsx` | `onOpenProjectDirectory` 去掉 `open-path` 条件，不再对浏览器传 `undefined` |
| `ProjectLedgerGroup.tsx` | 菜单项标签取 `pathRevealLabelKey()` |
| `TaskDirBar.tsx` | `local-open` 菜单项标签同上；两处 `openDirectory` 调用自动继承新行为 |
| `WorkspaceEditorLaunchers.tsx` | 去掉 `canOpenDirectory` 与包裹的 `<Show>`，标签同上（见下方说明） |
| `SkillMarketPanel.tsx` | 本地路径走 `revealPath`；远程 URL 仍受 `open-url` 约束；`canOpenLocalPath` 随最后一个消费者一起删除 |
| `MissionSkillPanel.tsx` | `openPath` 与 `openRoot` 均走 `revealPath`，不再抛出 `UnsupportedNativeCommandError` 给用户；三个按钮标签改为 `pathRevealLabelKey()` |

i18n：新增 `cwd.copy_path`、`cwd.path_copied`、`cwd.copy_failed`（en-US / zh-CN）；
删除 `mission_skill.open_source` —— 它的唯一消费者改用 `pathRevealLabelKey()` 后成为死键，
属本次改动的直接后果，不是无关清理。

**首轮自查发现并已修**：只改动作、未改标签，会让 Web 用户看到写着「Open」的按钮却
执行复制。`MissionSkillPanel` 的三处与 `SkillMarketPanel` 的一处标签因此一并能力化。
`SkillMarketPanel` 那一处按 location 类型分流：远程 URL 仍是「打开」（受 `open-url` 约束），
本地路径才取 `pathRevealLabelKey()`。

`WorkspaceEditorLaunchers` 的说明：该组件的 `disabled` 判定含
`supportedEditors().length === 0`，而浏览器宿主的 `projectEditors` 为空数组，
所以**整个启动器在 Web 版仍不可用**，这处改动对 Web 用户实际不可见。这是正确的
——它是「编辑器启动器」，没有编辑器时本就该禁用；改它只是让其中的路径项与其余入口
保持同一套标签逻辑。Web 用户的路径入口来自 Work Ledger 项目菜单与 TaskDirBar。

未改：`nativeOpen`、`BROWSER_NATIVE_COMMANDS`、`open-path` 能力值、
`workspace.ts` 中「带行号的文件引用转 workbench」那条分支。

## 四、验收

**非 UI 正向测试** `test/reveal-path-host-action.test.ts`：desktop → `"opened"` 且下发
`{kind:"open-path"}`；browser → `"copied"` 且下发 `{kind:"clipboard.writeText"}`；
入参裁剪；空路径抛错；两种宿主的标签键；仅复制需要确认提示。6 passed。

**Web 真实页面**（`opencorvus serve` + `http://127.0.0.1:7878/ui/`，隔离
`OPENCORVUS_HOME`，CDP 真实 pointer 事件）：

1. 命令面板 → `Open folder` → 手动路径输入 → `Use this folder`，项目激活，
   首屏标题变为 `What should we build in acceptance-project?`。
2. Work Ledger 项目行 `…` 菜单项渲染为 **`Copy path`**（改前该项在浏览器下完全不存在）。
3. 点击后弹出 `Working Directory / Path copied to the clipboard`，
   `navigator.clipboard.readText()` 读回该项目的绝对路径。
   截图：[`specs/artifacts/2026-08-25-web-host-path-actions/web-copy-path-confirmation.png`](../../artifacts/2026-08-25-web-host-path-actions/web-copy-path-confirmation.png)。
   设置页 General 的 Web 渲染：[`web-settings-general.png`](../../artifacts/2026-08-25-web-host-path-actions/web-settings-general.png)。

首轮验收暴露并已修复的问题：复制失败时沿用了 `cwd.open_failed`（"Failed to open
directory"），与实际动作不符 —— 新增 `cwd.copy_failed` 并按宿主选择。
（该问题正是在 headless 拒绝剪贴板权限的那一次验收中显形。）

**其他检查**：`typecheck` 0；`check:i18n` ok（2 locales / 1839 keys）；
`check:css-tokens` ok（277 tokens）；overlay 单元测试 73 文件全过。

**未达成的验收，如实记录**：桌面（Tauri）宿主未做真实页面截图验收。原因是需要
`cargo` 构建 Tauri 产物，且用户可能正在运行 overlay、占用 `dist`。桌面路径的
覆盖仅有上述单元测试与「该分支代码未变（仍是 `nativeOpen`）」这一事实，
**不能替代视觉验收**。

## 五、独立 agent 审查

一名未参与实现的 agent 只读审查了完整差异、测试与验收证据，并自行跑了
`tsc --noEmit`、`check:i18n` 与受影响的测试。

**对 二-2 的裁定**：服务层的「按能力选择动作」成立 —— `utils/native.ts` 未被改动、
`open-path` 对 browser 仍为 `false`、`revealPath` 在**尝试之前**按已声明的能力分派而不是
捕获拒绝，与同文件既有的 `browseDirectory` / `openPathInSelectedEditor` 同构。
**但审查同时指出：这个论证只有在 UI 真的改名了动作时才成立** —— 而当时五处里有两处
没改，浏览器用户点「Open」却静默得到复制，行为上与 二-2 禁止的 fallback 无法区分。

### 必须修复项（全部已修并复验）

1. **编辑器启动器在浏览器下是一个永久灰掉的控件。** 它的 `disabled` 含
   `supportedEditors().length === 0`，而 browser 的 `projectEditors` 为空数组，
   菜单永远打不开 —— 那处解除隐藏因此是 no-op。
   **修法**：不是把「编辑器启动器」改造成路径启动器，而是没有编辑器的宿主根本不渲染它
   （`workspaceEditorLaunchersAvailable()` + `App.tsx` 的 `<Show>`）。浏览器的路径入口
   由 Work Ledger 项目菜单、目录栏与日志查看器提供。实测 `#solidChatHeaderEditorLaunchers`
   已不存在于 Web 版 DOM。
2. **漏掉第五个入口。** `LogViewer.tsx:326` 对服务端日志路径直接 `nativeOpen`，无任何守卫，
   浏览器上把 `Native command "open-path" is not available in host "browser".` 原样显示给用户
   —— 正是本方案要消灭的那个缺陷。**我的全仓搜索只扫了「设置面板 3 处」，因此没看到它。**
   已改走 `revealPath`，并复用其 `copyNotice` 短提示（顺带把重复的提示逻辑提取为
   `flashNotice`）。
3. **spec 被 `/specs/` 的 gitignore 规则忽略**，而已跟踪的 `README.md` 已链接它 ——
   提交后会留下悬空链接并丢失记录。该目录其余 198 份记录均已跟踪，惯例是 `git add -f`。
4. **失败文案仍说「打开失败」。** `pathRevealFailureKey()` 当时只在 5 处中的 1 处被调用，
   `cwd.copy_failed` 几乎不可达；浏览器上一次失败的剪贴板写入会显示
   「Failed to open skill source: ...」。已统一：新增 `pathRevealFailureText(error)`
   作为唯一出口（内部走既有的 `errorText` 拼接），四处调用点全部改用。
   审查同时发现调用方传的 `{ error }` / `{ path }` 参数落在没有占位符的键上、被静默丢弃 ——
   失败文案改为拼接式，`cwd.path_copied` 补上 `{{path}}`（对没有文件管理器的宿主，
   告诉用户复制的是哪个路径正是重点）。
5. **测试含 三-2 禁止的负向断言**（`expect(issued).toEqual([])` 与「rather than issuing」
   的命名）。已改为对错误契约的正向断言：`rejects.toThrow(/requires a non-empty path/)`。

### 采纳的其余建议

- 删除因本次改动而失去消费者的两个死键：`mission_skill.open_source`、
  `project.open_in_file_manager`。
- `openRoot` 在 `await revealPath` 之后补上 `owner.owns()` 复查，与同文件的 `openPath` 一致。

### 审查确认无误的部分

`nativeOpen` 与能力表未被触碰；两份 locale 的键集合与**键序**完全一致、除新增外无其他改动；
`main.tsx` 移除能力判断是正确的（`ProjectLedgerGroup` 的菜单可见性与分隔线判定仍自洽）；
`openDirectory` 现在会因 `nativeOpen` 返回 false 而报错，经查 Tauri 侧仅在空路径时返回
`Ok(false)`，而 `revealPath` 已先行拒空，无桌面回归。

### 已知限制（审查提出，本次不修）

- **非安全上下文下整个复制动作失效。** `navigator.clipboard` 在非安全源不可用，因此通过
  `http://<lan-ip>:port/ui` 访问的 Web 版（即最常见的非 localhost 用法）每一次复制都会失败。
  本次验收用的 `http://127.0.0.1:7878/ui/` 恰好是唯一不会暴露该问题的源。
  能力表把 `clipboard.writeText` 静态声明为 `true`，而真实可用性取决于 `isSecureContext` ——
  要根治需让该能力项动态求值，超出本次范围。当前的表现是一条**文案正确**的失败提示
  （「复制路径失败: navigator.clipboard.writeText is unavailable」），不是误导。
- 相关范围提示：复制出的是**服务端**路径，对远程浏览器用户用途有限。
- `workspace.ts` 中 `openProjectFile` 仍自行判断 `open-path`（带行号的文件引用转 workbench）。
  意图不同（查看文件内容 vs 定位到磁盘），审查判定合理且属范围外，保留。

### 复验

修复后重跑：`tsc --noEmit` 0；`check:i18n` ok（1837 keys）；`check:css-tokens` ok；
overlay 单元测试 73 文件全过。Web 真实页面复验：编辑器启动器已不渲染、
项目菜单项为 `Copy path`、确认提示为
`Path copied to the clipboard: <绝对路径>`。


---

# 续章：给浏览器宿主补上 `open-url`

## Recall（本章）

**用户要求**：上一章末尾把「`open-url` 在浏览器下同为 `false`，8 处入口全部打不开，
而浏览器本就能 `window.open`」作为发现上报并询问是否要做；用户答「做」。

**与上一章的性质区别**：上一章是**同一意图在不同宿主上换动作**（开文件管理器 / 复制路径），
因为浏览器根本做不到前者。本章是**给浏览器宿主补一项它真正具备的能力实现** ——
`window.open` 就是浏览器打开外部链接的原生方式，不是任何东西的降级。
因此本章直接改 `BROWSER_NATIVE_COMMANDS`，这与 二-2 不冲突：
仍然是「一项能力、一个实现、一个事实来源」，只是那个实现此前缺失。

**硬约束**：`utils/native.ts` 的注释写着「no silent fallback to `window.open`」。
该约束针对的是「宿主不支持时偷偷降级」。本章使 `window.open` 成为浏览器宿主
**已声明**的实现，`nativeOpen` 在能力缺失时仍然抛错。该注释现在会误导，一并更正。

## 分析

**现状**：`tauri-transport.ts` 的 browser 分支只实现 5 条命令，`open-url` 落到
`nativeUnsupported("browser", command)`。8 处消费点全部据此关闭功能：

**能力门控的 7 处**：`BrowserPreviewPanel.tsx:1204`、`McpAppArtifact.tsx:381`、
`ChannelsPanel.tsx:59`、`SkillMarketPanel.tsx:247`、`TitlebarMenubar.tsx:683`、
`main.tsx:1529`、`main.tsx:2040`。（初稿写「8 处」是笔误，独立审查指出；实为 7 处门控。）

**另有 3 处未受能力门控、但行为同样随本次改动变化**（审查补充）：
`services/llm.ts:611`、`services/documentation.ts:22`、`services/browser-preview-link.ts:29`。
它们打开的也都是 http(s) 链接 —— 教程文档、Squad Market 网页、MCP 应用内链接、
Provider 授权页、外部 URL。

**安全边界**：Tauri 侧 `overlay_open_url`（`src-tauri/src/main.rs:1794`）把 URL 直接交给
OS opener，没有协议白名单 —— 在桌面上由操作系统兜底。**浏览器里不能照搬**：
`javascript:` 与 `data:` URL 在页面上下文中是 XSS 面，`window.open` 会照单执行。
另外 `McpAppArtifact` 的链接来自 MCP 应用，属不可信输入。

**既有重复**：http(s) + 无凭据的校验在仓库里已有 4 份 ——
`McpAppArtifact.tsx:73`（`safeHttpUrl`）、`NetworkPanel.tsx:41`、
`browser-preview-native.ts:108`、`SkillMarketPanel.tsx:205`（`isRemoteUrl`）。
不新增第五份。

## 方案

1. `BROWSER_NATIVE_COMMANDS["open-url"]` → `true`。
2. 新增纯函数 `utils/external-url.ts::externalUrl(value): URL` —— http(s)、禁止内嵌凭据，
   否则抛出明确错误。无 DOM 依赖，可直接做非 UI 正向测试。
3. `tauri-transport.ts` 的 browser 分支实现 `open-url`：经 `externalUrl` 校验后
   `window.open(href, "_blank", "noopener,noreferrer")`；返回 `null` 视为被弹窗拦截并抛错
   （`nativeOpen` 期待 `true`，调用方已有 catch）。`noopener` 同时消除 tabnabbing。
4. `McpAppArtifact` 的 `safeHttpUrl` 改用 `externalUrl` —— 它正在本次路径上，且是
   不可信输入的那一处，消除一份重复。`NetworkPanel` 与 `browser-preview-native`
   不在本次路径上，记录不动。
5. 更正 `utils/native.ts` 中现已误导的注释。

**不做**：`clipboard.readText`、`workspace.pickDir` 等其余 browser 侧 `false` 能力 ——
浏览器要么确实做不到，要么需要独立的交互设计，不在本次要求内。

## 落地

- `host-transport.ts`：`BROWSER_NATIVE_COMMANDS["open-url"]` → `true`。
- `utils/external-url.ts`（新增）：`externalUrl(value): URL` —— http(s)、禁内嵌凭据，
  否则抛明确错误。纯函数，无 DOM 依赖。
- `tauri-transport.ts` browser 分支实现 `open-url`：经 `externalUrl` 校验后
  `window.open(href, "_blank", "noopener,noreferrer")`；返回 `null` 判为被拦截并抛错。
- `McpAppArtifact.tsx`：删除私有的 `safeHttpUrl`，改用 `externalUrl`（不可信输入那一处）。
- `utils/native.ts`：更正现已误导的注释 —— 它禁止的是「宿主不支持时偷偷降级」，
  而浏览器**实现** `open-url` 用 `window.open` 是另一回事。

未动：`NetworkPanel.tsx:41` 与 `browser-preview-native.ts:108` 的同类校验 ——
不在本次路径上，记录待后续合并。

## 验收

**非 UI 正向测试** `test/external-url-gate.test.ts`（8 passed）：接受 http/https、
查询串/片段/端口、首尾空白；拒绝 `javascript:`、`data:`、`file:`、`vbscript:`、
内嵌凭据、非 URL、空值 —— 每一条都以**明确错误契约**断言，不使用「不发生」断言。

**既有契约测试抓到了本次变更**：`test/host-transport-capabilities.test.ts` 的能力矩阵
断言失败，因为 browser 的受支持命令集合多了 `open-url`。这正是它的职责；已更新期望
并加注说明原因。（74 个测试文件全过。）

**Web 真实页面**：设置 → Squad Market → 「Open Squad Market」。该按钮受
`canOpenMarketWebPage`（`main.tsx:2040`，读 `open-url`）控制。点击后记录到
`window.open("https://opencorvus.com/market/", "_blank", "noopener,noreferrer")` ——
目标、`_blank`、`noopener,noreferrer` 三项均正确。

**桌面路径未变**：仍走 `invokeTauri("overlay_open_url")`；同上一章，桌面无真实截图验收。

## 独立 agent 审查

一名未参与实现的 agent 只读审查了完整差异，重点为安全边界。

### 决定性缺陷（已修）

**`window.open(..., "noopener,noreferrer")` 按 HTML 规范恒返回 `null`** —— 成功与失败
都一样。原实现把 `null` 判为「被弹窗拦截」并抛错，因此**每一次成功打开都会向用户报错**：
Channel 教程提示、Squad Market 通知、浏览器预览地址栏错误、标题栏 `reportError` 对话框、
Mission 创建对话框的 market 错误，以及 MCP 应用在用户已批准链接之后收到 `{isError:true}`。
带 `noopener` 时不存在能区分「已打开」与「被拦截」的返回值，因此正确做法是保留
`noopener,noreferrer` 并忽略返回值 —— 仓库自身的先例
（`TitlebarMenubar.tsx:370` 用 `"noopener"` 且不看返回值）本就如此。

**我的验收方法掩盖了它。** 首轮 Web 验收把 `window.open` stub 成返回一个假窗口对象，
于是那条永远为真的失败分支从未触发。改用不 stub 的验收后，判据变为「面板是否出现
错误提示」：修复后 `errorsShown: []`。

### 测试覆盖（已补）

审查指出 transport 分支零覆盖，且 `test/notification-host-transports.test.ts` 早有
可复用的 fake `window` harness。新增 `test/browser-open-url-transport.test.ts`：
fake 的 `open` **刻意返回 `null`**（与真实 `noopener` 行为一致），断言
`native({kind:"open-url"})` 仍 resolve；并断言交给 `window.open` 的
`href` / `_blank` / `noopener,noreferrer` 三元组，以及恶意 scheme 与内嵌凭据在
transport 边界被拒。**已验证其有效性**：临时回退修复后该文件 3 项失败，恢复后 5 项通过。

### 采纳的其余意见

- **`browser-preview-native.ts` 其实在本次路径上**（其输出直接喂给 `nativeOpen`），
  且与新 gate 对内嵌凭据的判断相反 —— 桌面接受、Web 拒绝。已让它同样拒绝凭据。
  两个函数不合并：一个规范化宽松的地址栏输入，一个校验成品 URL，契约不同；
  但对「什么可接受」必须一致。
- **注释在四处重复同一段辩护**（spec、`native.ts`、`tauri-transport.ts`、能力矩阵测试）。
  论证留在 spec，代码只陈述行为。

### 未采纳，并说明理由

- **把 gate 从 browser 分支上移到 `native()` 共享入口**（覆盖两个宿主）。审查确认
  当前无任何调用点能把恶意 scheme 送到 `open-url`：`native.ts:132` 按
  `/^https?:\/\//i` 路由，非 http(s) 一律走 `open-path`（browser 下为 `false`，抛错）；
  唯一直接构造 `{kind:"open-url"}` 的 `McpAppArtifact` 已在上一帧校验。上移会让桌面
  开始拒绝带凭据的 URL —— 那是产品决策，且当前不存在可利用路径，不在本次范围内。
  记录为后续。
- **弹窗拦截**（审查 §4）：`llm.ts:611` 在 `await apiJson(...)` 之后才调用，用户手势
  已失效，浏览器上会被拦截。这不是回归（此前是直接抛
  `UnsupportedNativeCommandError`），但声明能力并不能修复它。MCP 应用链接在
  `await askConfirmation` 之后打开，Chrome 的瞬时激活通常够用，Firefox/Safari 更严格。
  两者均记录，未处理。

### 审查确认无误

`externalUrl` 的校验逻辑无可构造的绕过；MCP 应用的用户确认步骤未被削弱且仍在打开之前；
`test/external-url-gate.test.ts` 完全符合 三-2（每条拒绝都以明确错误契约断言）；
6 个点击驱动的消费点保持到 `window.open` 的同步路径；`nativeOpen` 仍对缺失能力抛错，
「非 fallback」的论证成立。

### 复验

`tsc --noEmit` 0；overlay 单元测试 **75 个文件全过**；Web 真实页面（不 stub）
点击「Open Squad Market」后面板无任何错误提示。


---

# 续章二：Provider 授权在浏览器上的弹窗拦截

## Recall（本章）

**用户要求**：上一章把 `services/llm.ts:611` 的弹窗拦截作为「记录、未处理」上报，
用户答「把 llm.ts 的弹窗拦截问题也修了」。

## 分析

**根因**：浏览器只在**瞬时用户激活**期内允许 `window.open`。OAuth 流程从用户点击
「连接 Provider」到打开授权页之间隔着 1–2 次网络往返：

```
点击 → [nativeConfirm?] → providerAuthInputs()（内含 apiJson，可能不弹任何对话框）
     → apiJson(oauth/authorize) → nativeOpen(authorization.url)
```

`providerAuthInputs` 在 provider 不需要输入时**一个对话框都不弹**，直接返回 —— 此时
最后一次手势远在两次网络往返之前，激活必然已过期。

**为什么不能靠「确认对话框刚点完」**：`finishAppDialog`
（`services/app-dialog.ts:168`）在 resolve 之前 `await runAppDialogTransition(...)`
与 `await revealNativeSurfaces(...)`，都是真实异步。对话框 resolve 之后的代码不再享有
点击时的激活。

**为什么当前不会卡死**：后续步骤已把 URL 显示给用户 —— `code` 流程的 prompt
message 含 `authorization.url`，隐式流走 `showLlmNotice`。用户可以手动复制打开。
所以这是**体验缺陷**（点了没反应，然后被要求粘贴回调），不是功能阻断。

**为什么不能只加提示**：那是缓解不是修复。根因是「在没有手势的地方尝试开窗」，
修复就应当**把开窗移回一次真实点击里**。

**现有 UI 原语不足**：`AppDialogOptions`（`services/app-dialog.ts:9`）只有纯文本
`message`，没有链接、没有自定义动作。`showLlmNotice` 也只是 `nativeMessage` 的包装。
所以用户无处可点。

## 方案

1. `AppDialogOptions` 增加可选 `link?: { url: string; label: string }`。
   `AppDialogState` 由继承自动获得。
2. `AppDialogHost` 在 footer 渲染该动作按钮，`onClick` 内**同步**调用 `nativeOpen(url)`。
   `native()` 的 browser 分支在首个 `await` 之前执行 `window.open`，因此调用发生在
   点击的同步路径上，激活有效 —— 这正是根因的对应修复。
3. `nativePrompt` / `nativeMessage` 透传 `link`。
4. `llm.ts` 的授权流程按宿主分支：
   - 声明 `open-url` **且**无需用户激活的宿主（桌面）：保持现有自动打开，行为不变。
   - 浏览器：不再在无手势处尝试自动打开，改为把授权 URL 作为对话框的动作按钮交给用户点击。
5. 新增判定：宿主是否需要用户手势才能打开外部 URL。它是 `HostCapabilities.ui` 的一项，
   与 `manualWorkspacePathEntry`、`overlayZoomHotkeys` 同类 —— 描述的是宿主的交互约束，
   不是能力有无。

**不做**：预开空窗口后异步导航（`window.open("", "_blank")` 再设 `location`）。
它要求把窗口句柄穿过整条异步链、失去 `noopener` 保护，并在流程取消时泄漏窗口 ——
代价高于收益，且引入有状态的窗口管理。

## 落地

| 文件 | 改动 |
|---|---|
| `services/host-transport.ts` | `HostCapabilities.ui` 新增 `externalUrlNeedsUserGesture`（tauri `false` / browser `true`） |
| `services/app-dialog.ts` | `AppDialogOptions` 新增 `link?: { url, label }`；`nativeMessage` 透传 |
| `components/AppDialogHost.tsx` | footer 渲染该动作按钮，`onClick` 内同步调 `nativeOpen` |
| `utils/native.ts` | `nativePrompt` 透传 `link` |
| `services/llm.ts` | 授权流程按 `externalUrlNeedsUserGesture` 分支；`AuthDialogCallbacks` 的 `nativePrompt` / `showLlmNotice` 接受 `link` |
| `settings/ProvidersPanel.tsx` | `showLlmNotice` 把 `link` 转交给 `nativeMessage` |
| i18n | 新增 `llm.auth_open_page` |

同步性是这次修复的全部要害：`AppDialogHost` 的 `onClick` → `nativeOpen` →
`native()` 的 browser 分支，在首个 `await` 之前执行 `window.open`，因此仍处在这次点击的
激活期内。

## 验收

**非 UI 正向测试** `test/provider-auth-open-gesture.test.ts`（3 passed）：
桌面宿主自行打开授权页且不下发动作；需要手势的宿主不打开、改把
`{ url, label }` 交给对话框；两个宿主的 `externalUrlNeedsUserGesture` 取值。

**既有测试的契约更新**：`test/llm-provider-auth-select-source.test.ts` 断言
「授权 URL 被打开」，而测试环境默认解析为 browser 宿主，新契约下不再自动打开。
该文件验证的是**请求路径不注入 project directory**，与宿主交互约束无关，
因此在 `beforeEach` 里显式固定为桌面宿主并加注说明 —— 而不是把断言改成空数组。

**其他检查**：`typecheck` 0；`check:i18n` ok（1838 keys）；`check:css-tokens` ok；
overlay 单元测试 **76 个文件全过**。

**真实页面**：按钮的渲染与 OAuth 无关 —— 独立审查指出我最初「隔离实例没有 OAuth
provider 所以无法验收」的理由不成立。任何一个对话框调用点加上 `link` 都能看到它。
用临时探针给「选择文件夹」对话框挂一个 `link`，经命令面板 → `Open folder` 触发：

- 按钮渲染为 outline/accent，与 ghost 的 Cancel、solid 的主按钮层次分明；
- `<button type="button">`，键盘可达，且不抢初始焦点；
- 点击后失败信息以红字显示在对话框正文下方；
- 辅助动作左对齐，与 `Cancel` / 主按钮分组分开（见下）。

截图：[`dialog-link-action.png`](../../artifacts/2026-08-25-web-host-path-actions/dialog-link-action.png)。
探针已撤销，`workspace.ts` 回到无改动状态。

**该次验收顺带产生的一个运行时事实**：探针用 `javascript:alert(1)` 作为 URL，
显示的错误是 `Native command "open-path" is not available in host "browser"` ——
即 `nativeOpen` 按 `/^https?:\/\//i` 路由，非 http(s) 一律走 `open-path`，
**根本到不了 `externalUrl` 的 scheme 拒绝分支**。这与上一章审查的判断一致：
transport 侧的 gate 对经由 `nativeOpen` 的调用是防御纵深，真正会送入非 http(s) 的
只有直接构造 `{kind:"open-url"}` 的调用点。

## 独立 agent 审查

一名未参与实现的 agent 只读审查了完整差异，并在真实模块上做了运行时验证。

### 致命缺陷（已修）

**`link` 从未到达 store，按钮是不可达的死代码。** `showAppDialog`
（`services/app-dialog.ts:130`）以一次**穷举式整对象写入**提交对话框状态，
而 `link` 不在那个字面量里。`AppDialogState extends AppDialogOptions` 给了**类型**，
方案里「`AppDialogState` 由继承自动获得」对类型成立、对运行时值不成立。
审查实测：`showAppDialog({ link })` 之后 `dialogStore.app.link === undefined`。

后果比不改更糟：browser 上 `llm.ts` 不再尝试 `nativeOpen`，而**没有任何东西替代它**。

修复是在那次写入里显式列出 `link`。同时确认它是自清理的 —— Solid 的
`setProperty` 在合并值为 `undefined` 时删除该键，所以下一个不带 link 的对话框
不会继承上一个的按钮。

### 其余必修项（已修）

- **按钮吞掉自己的失败**：`void nativeOpen(...)` 没有 `catch`，而 `externalUrl` 与
  `UnsupportedNativeCommandError` 都会拒绝。它是操作者在授权流程中的最后一个可用入口，
  静默失败等于无路可走。现在捕获并在对话框内显红字（`.app-dialog-link-error`）。
  附 `.catch()` 不影响激活：`nativeOpen(url)` 仍先被求值。
- **测试停在 mock 边界，恰好差一跳**：两个用例都断言测试自己的 `nativePrompt` stub
  收到了什么，没有任何一处触及 `showAppDialog` → `dialogStore` —— 也就是这次真正
  出问题的那一层，因此功能完全失效时它们仍然全绿。新增
  `test/app-dialog-link-action.test.ts` 断言 store 实际持有的值，并验证过它有效：
  移除那行写入后 2 项全部失败，恢复后全过。
- **`llm.ts` 绕过了自己的宿主边界**：`authorizeProvider` 的 `AuthDialogCallbacks`
  本是它与宿主之间的**唯一**接缝，我却给它加了对 `getHostTransport()` 单例的直接依赖，
  使一个原本完全可注入的函数变成环境耦合（症状：`llm-auth-cancel.test.ts` 会随环境
  单例漂移）。trait 改为经 callbacks 注入，`ProvidersPanel` 负责接线 —— 它本来就
  持有宿主接线。两个授权测试文件因此都显式声明该 trait，不再依赖任何 transport。
- **测试卫生**：能力矩阵断言归位到 `host-transport-capabilities.test.ts`
  （它本就断言其他 `ui` trait），删除无人读取的 recorder 参数与那条
  `toEqual([undefined])` 的缺席断言。

### 采纳的其余意见

- **方案里「激活必然已过期」的说法过强**。Chrome 的瞬时激活窗口是 5 秒，两次本地
  往返常常来得及；`providerAuthInputs` 有时还会补上一次对话框点击。所以改前的自动打开
  **有时可用**。本次改动在浏览器上无条件用一次额外点击换取可靠性 —— 这是一个取舍，
  不是纯粹的收益。（同时尝试自动打开**并**给出按钮，才正是 二-2 禁止的 fallback 形态。）
- **按钮位置**：审查质疑三个按钮挤在右侧。已让辅助动作 `margin-inline-end: auto`
  左对齐，与 Cancel / 主按钮分组分开，并重新截图确认。

### 审查确认无误

激活链逐跳验证：`onClick` → `nativeOpen`（`getHostTransport().native(...)` 在 `await`
挂起前被求值）→ browser 分支直达 `window.open`，其间没有 `await`、没有微任务边界，
瞬时激活保持。`externalUrlNeedsUserGesture` 位置与命名正确（陈述约束而非
`isBrowser`），且不存在第二事实源 —— `nativeCommands["open-url"]` 回答的是「能否打开」，
不是「何时可以」。二-3 未被违反：这是宿主交互约束，不是引导 LLM 的流程门。
按钮键盘可达、不抢初始焦点、不结算对话框（操作者需要回来粘贴 code），无不可信标记渲染。

### 记录但未修（横向审计结果）

`McpAppArtifact.tsx:456-465` 的 `bridge.onopenlink` 在 `await askConfirmation(...)`
之后才 `native({kind:"open-url"})` —— **同一个根因的另一处实例**。审查核对了其余
`open-url` 调用点（`main.tsx:1537`、`ChannelsPanel.tsx:289`、`SkillMarketPanel.tsx:400`）
均保持同步路径，无此问题。该处未修：修它需要决定「确认」与「打开」如何合并为一次点击，
是产品交互决策。

### 复验

`tsc --noEmit` 0；`check:i18n` ok（1838 keys）；`check:css-tokens` ok；
overlay 单元测试 **77 个文件全过**。


---

# 续章三：用真实环境补齐三项未验收

用户授权删除本机数据库并重启，因此上面三章里标注「未达成」的验收得以补做。
数据库以**重命名方式备份**（`data/opencorvus.db{,-wal,-shm}.backup-20260825-100525`），
未删除；`auth.json` 与 `models.json` 未触碰。执行前确认过 7878 端口空闲、
无 opencorvus 进程在运行，因此移走数据库不会打断任何正在使用的实例。

## 一、Provider 授权按钮 —— 已验收

真实 `OPENCORVUS_HOME` 的 `auth.json` 中 `openai` 的类型正是 `oauth`。
真实流程：Providers → OpenAI 的 `Connect` → 选择「ChatGPT Pro/Plus (browser)」→
弹出「Model & Provider」对话框，正文为
`Complete authorization in your browser. This window will close automatically.`，
footer 为 **`[Open authorization page]` … `[OK]`** —— 辅助动作左对齐，
与决定动作分组分开，与上一章的布局修正一致。

走的是**隐式流**分支（`showLlmNotice` + `link`），即 `llm.ts` 中
`authorization.method !== "code"` 的那条路径。

截图未归档：该页面同时显示用户已配置的 provider 清单，而本仓库是公开仓库。
截图保留在会话 scratchpad，未进入 git。

## 二、非安全源 —— 结论比原先记录的更严重

用 `--hostname 0.0.0.0` 启动并从局域网地址 `http://10.216.136.242:7878/ui/` 访问：

```
isSecureContext:      false
navigator.clipboard:  undefined     ← 上一章的判断成立
```

但真正的结论是：**页面完全白屏，应用根本没有启动**。
未捕获异常 `TypeError: crypto.randomUUID is not a function`。

`crypto.randomUUID` 同样是仅安全上下文可用的 API。overlay 中受影响的三类：

| API | 处数 | 后果 | 是否有非安全上下文等价物 |
|---|---|---|---|
| `crypto.randomUUID` | 8 | **启动即崩，白屏** | 有：`crypto.getRandomValues` 不限安全上下文 |
| `navigator.clipboard` | 6+ | 所有复制动作失效 | 无可靠等价物 |
| `crypto.subtle` | 1（`ExpertSquadMarketPanel` 的 SHA-256） | 该功能失效 | **无** |

因此「让 Web 版在纯 HTTP 下完全可用」做不到 —— 这是浏览器安全模型，不是本仓库的缺陷。
上一章记录的「复制会失败」属实但不完整：在到达复制之前，应用已经起不来了。

**待用户决策**，本章未实施：

- 方案 A（推荐）：明确要求安全上下文。在 `index.html` 的 bootstrap 里检测
  `isSecureContext`，非安全源时渲染一条明确说明（需要 HTTPS 或 localhost），
  而不是留下白屏。成本小，把无法诊断的白屏变成可理解的提示。
- 方案 B：把 `crypto.randomUUID` 换成基于 `getRandomValues` 的 v4 生成器，让启动
  不再崩溃。这能救回启动，但复制与 SHA-256 仍然不可用，属于部分可用，
  且需要在 8 个调用点统一到一个工具函数。
- 两者可叠加：B 让应用起得来，A 让用户知道哪些功能在此环境下不可用。


---

# 续章四：非安全来源下的 Web 版（用户选定 A+B）

## Recall（本章）

用户在读过三个选项后选择「A+B 都做」。

- **B**：把 `crypto.randomUUID` 收敛到一个工具函数，内部在缺失时用
  `crypto.getRandomValues` 生成 v4 —— 后者不受安全上下文限制。目的是让应用**能启动**。
- **A**：原始描述是「非安全源时渲染说明而不是白屏」。B 落地后白屏不再存在，
  因此 A 的合理形态调整为**明确告知哪些功能在此环境下不可用**，并在用户实际
  撞上时给出人话而不是 API 名字。

## 分析

`isSecureContext` 为 false 时（即经非 localhost 的 HTTP 访问），overlay 触及三类受限 API：

| API | 位置 | 后果 | 处理 |
|---|---|---|---|
| `crypto.randomUUID` | 8 处，含 `tauri-transport.ts:440` 的流 ID（**启动必经**） | 启动即崩、白屏 | **B**：等价实现 |
| `navigator.clipboard` | 6+ 处 | 复制静默失败 | **A**：人话错误 |
| `crypto.subtle` | `ExpertSquadMarketPanel.tsx:49` 的包 SHA-256 校验 | 该功能失败 | **A**：人话错误 |

这三处 `crypto.randomUUID` 自 `v0.0.35beta` 即存在，非本轮引入。

**为什么 B 只能救启动**：`getRandomValues` 不受安全上下文限制，所以 UUID 有等价实现；
而剪贴板没有可靠等价物（`execCommand('copy')` 已废弃且行为不一），
`crypto.subtle` 在非安全上下文**完全不存在**。因此 HTTP 部署下这两项功能
不可能可用 —— 这是浏览器安全模型，不是本仓库的缺陷。A 的价值正在于把这一点
说清楚，而不是让它表现为「点了没反应」。

## 方案

**B**：`src/utils/random-id.ts` 导出 `randomUUID()`。优先 `crypto.randomUUID()`；
缺失时用 `crypto.getRandomValues` 取 16 字节，按 RFC 4122 置 version/variant 位后
格式化。8 个调用点全部改用它 —— 一个实现、一个事实来源，不在调用点各写各的。

**A**：
1. 受限能力失败时给出可理解的原因，而不是 API 名字。判据是 `isSecureContext`：
   为 false 时说明「需要经 HTTPS 或 localhost 访问」。落在**抛出点**
   （`tauri-transport.ts` 的 clipboard 分支、`ExpertSquadMarketPanel` 的摘要函数），
   因为那里才知道失败的真实原因。
2. 设置页 General 增加一条环境说明，仅在非安全上下文出现，列出受影响的功能。
   复用既有的 `SettingsState`，与 About 页「仅桌面版可用」同一范式，不新增 UI 构件。

**不做**：启动时的全局横幅。`ConnectionBanner` 的语义是连接故障，扩展它会混淆职责；
另造一个常驻横幅会在每次启动打扰用户，而按需提示已覆盖真实触发场景。

## 验收

非 UI 正向测试：`randomUUID()` 在有/无 `crypto.randomUUID` 两种环境下都产出合法 v4，
且两次调用不相同。真实页面：经 `http://<lan-ip>:7878/ui/` 访问 —— 应用**启动成功**
（不再白屏），设置页 General 出现环境说明，触发复制时给出人话错误。
localhost 与桌面路径不受影响。

### 实测结果

经 `http://10.216.136.242:7878/ui/`（`isSecureContext === false`）实测，先确认环境本身：

| 能力 | 实测 |
|---|---|
| `crypto.randomUUID` | `undefined` —— 白屏的直接成因 |
| `crypto.getRandomValues` | `function` —— B 的等价实现依据 |
| `navigator.clipboard` | `undefined` |
| `crypto.subtle` | `undefined` |

在此环境下：

- **应用启动成功**，不再白屏（`appBooted: true`）。
- 设置页 General 出现环境说明：「This page is not in a secure context. Copying to the
  clipboard and Expert Squad package verification are unavailable here — open OpenCorvus
  over HTTPS, or from localhost.」证据：`insecure-origin-general-notice.png`。
- 项目菜单条目为 **Copy path**，点击后弹出「Working Directory / Failed to copy the path:
  The clipboard needs a secure context: open OpenCorvus over HTTPS, or from localhost」——
  动词为 copy 而非 open，说明 `pathRevealFailureKey()` 选中了 `cwd.copy_failed`；未出现
  `UnsupportedNativeCommandError` 或裸 TypeError。证据：`insecure-origin-copy-failure.png`。

桌面 Tauri 侧同一入口显示 **Open in File Manager**，编辑器启动器正常渲染，
证明能力分支两端各自成立。证据：`desktop-open-in-file-manager.png`。
