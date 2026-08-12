# CS-032 — 收敛 SDK server startup observer 生命周期

## Recall

- 用户要求主 agent 持续直接修复审计问题，并与并行 agent 协作，避免局部补丁制造新的事实源。
- 验收目标：JavaScript SDK 启动的长寿命 OpenCorvus server 在 readiness 后不继续累积、重扫启动日志；启动失败仍只返回有界、完整 UTF-8 diagnostics；close 的进程清理合同不退化。
- 硬约束：非 UI 正向测试；不运行或修改 UI 自动化；先全仓核验定义/调用/测试/公共合同；实现后独立只读复审至 PASS。
- 已读资料：审计 CS-032；`packages/sdk/js/src/server.ts`、`src/index.ts`、`test/server.test.ts`、package exports/scripts；OpenCorvus `cli/cmd/serve.ts` readiness emission；AGENTS.md。
- 全仓搜索：`createOpenCorvusServer` 是公开 SDK server API，并由 `createOpenCorvus` 使用；startup observer 只存在于 `src/server.ts`。stdout/stderr 的 `data` listeners 在 readiness 后仍存活；`output` 无界增长并在每次 stdout chunk 上重新 `split` 全串。现有真实 child tests覆盖 timeout、pre-ready exit、descendant cleanup和close，但没有 bounded diagnostic/lifecycle 验收。现有最后一条测试读取 `server.ts` 源码文案，属于仓库禁止保留/运行的源码文案测试，触及本文件后应删除。
- 独立 agent 反馈：方案可独立实施，但必须由一个 observer 同时拥有 decoder、bounded tail、listener、timer、abort 与 settlement；失败先同步 claim，阻止迟到 ready；ready 后必须继续 drain pipe；byte cap 要覆盖跨 chunk UTF-8 与无换行洪泛；本批明确不替代 CS-011 英文 readiness。

## 根因与影响面

### 可观察现象与直接触发

SDK child 输出 readiness 行后继续运行并打印日志。startup Promise 已 resolve，但 stdout/stderr listeners、`output` 字符串和 readiness parser 保留到进程退出；每个 stdout chunk 都重新切分全部历史输出。

### 控制流根因

启动观察、diagnostic retention 和整个 child 运行期日志监听共用一个 closure；`finishStartup` 只清 timeout，没有执行 startup observer teardown。输入 chunk 也没有按行增量解码，UTF-8 码点可被 Buffer 边界拆开。

### 旧路径为何不能根治

只把 `output` 截断仍保留 readiness 后 listener/解析成本；只移除 listener而不处理启动期有界 tail与 UTF-8 chunk边界会破坏失败诊断。CS-011 将另行替换人类日志 readiness 协议，本批不发明第二个 machine receipt，也不把两个 finding 混成兼容层。

### 公共契约、数据与调用

- `ServerOptions`、`OpenCorvusServer`、`createOpenCorvusServer/createOpenCorvus` 类型不变。
- 不增加 runtime log callback；readiness 后 SDK 明确不消费 child output。child stdout/stderr 仍为 pipe，但移除 data listeners后不保留诊断；长期高流量若需要 drain，必须显式 `resume()` 丢弃而不是停止读取造成 backpressure。
- 启动失败 Error 仍包含 exit code和 bounded output tail；timeout/abort cleanup合同不变。
- 无持久数据或 OpenAPI/生成 SDK变更。

## 实施方案

1. 引入 server-local 64KiB fixed-byte diagnostic tail，按 UTF-8 bytes保留最后固定阈值并在生成 Error 时安全解码。
2. 用 `StringDecoder` 增量解析 stdout readiness 行，只保留尚未完成的一行；stderr仅进入 bounded tail。
3. readiness 成功时完整 teardown startup listeners/abort listener/timer，然后将 stdout/stderr切换为显式 discard drain；close/exit时移除 discard listeners。
4. timeout、abort、parse failure、pre-ready exit、spawn error均通过同一 settlement teardown；cleanup failure保持其现有终态语义。
5. 扩展真实 child测试：启动前输出超过阈值并exit，Error只含精确有界tail；成功 readiness 后持续输出超过阈值且close，diagnostic collector保持settled且process tree仍正确退出。通过内部只读 diagnostic observation测试 seam仅暴露size/listener phase，不暴露日志内容或第二运行时authority。
6. 删除 `server.test.ts` 中读取生产源码并匹配PowerShell文案的禁止测试；进程清理继续由真实 child正向tests负责。

## 正向验收

- `bun test --timeout=0 test/server.test.ts`
- `bun run typecheck`（`packages/sdk/js`）
- `bun run check:sdk-imports`
- task-owned `git diff --check`
- 独立 agent复审完整生命周期、UTF-8边界、错误/cleanup语义和测试证据至 PASS。

## 明确不做

- 不在本批替换 `server listening` 人类日志协议；该边界属于 CS-011。
- 不新增 runtime log API、fallback readiness reader或第二套 child owner。
- 不运行 UI 自动化。

## Verification Log

- 方案独立复核：PASS（已吸收 single owner、failure claim、pipe drain、byte/UTF-8 与 CS-011 边界）。
- 实现/首轮验证：完成。真实 server child focused tests 7/7、15 assertions PASS；SDK typecheck、SDK import check 与 task-owned diff-check PASS。源码文案测试已删除并由真实 drain/bounded-tail行为覆盖。首轮交付复审发现 partial line 在换行前被交给 readiness parser 的竞态；已修为只返回 completed lines，并将真实 child 精确分块在 `server listening` 后、延迟 URL remainder。
- 独立交付复审：PASS after correction。首轮 P1 指出 partial readiness line 被过早解析；修复和真实分块测试后最终复审确认无剩余 actionable。
