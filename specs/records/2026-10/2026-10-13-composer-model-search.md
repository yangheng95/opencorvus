# Composer 可见模型名称搜索

## Recall

用户要求持续分批并行调查 UI/UX（User Interface / User Experience，用户界面与体验）、功能与缺陷；每批先分析并落盘，再实现、真实桌面交互截图人工复核、聚焦正向测试，必要时执行已授权 GPT-6.1 Sol 端到端验收，范围提交、合并上游并正常推送，继续下一批，直到用户明确停止。

本批开始 main/ba1c6e5a6，origin/main，工作区干净。调查中出现其它工作产生的 explorer-return-380 索引变更；保留这些变更，不混入本批提交。两个子 agent 仅调查且禁止再次委托：ui_audit 提供搜索漏传 label 的历史与调用证据；functional_audit 提供文件二进制识别候选，后者留待独立完整分析批次。

已读 AGENTS.md、当前 07-panel、07-panel-reactivity、05-config、06-provider 相关模型合同、server-runtime-readiness、379/377 记录与 Recall、ComposerModelSelector、llm、text-search 及已有 helper 测试。全仓搜索 connectedModelOptions、mirrorProviderGroups、模型标签/匹配调用。唯一 ComposerModelSelector 由 ChatComposer 共用；ScheduledAutomationsPanel 使用同一 catalog 但拥有独立选择呈现，不受本次组件修复影响。没有在触及路径发现 UI 自动化测试；text-search.test.ts 是纯字符串 helper 正向契约，无 DOM 或组件断言。

## 现象、根因与影响

独立生产开发命令 `bun run dev serve --hostname 127.0.0.1 --port 18430 --project-dir D:/myhexin-local/opencorvus/.tmp-codex-iteration-20261013/project`，OPENCORVUS_HOME 指向该隔离目录的 runtime；使用 /ui 真实页面，未复制凭据、未调用模型。Provider catalog 显示 DeepSeek Chat（身份 deepseek/deepseek-chat）；输入可见完整名称后实际显示 No matching models。原截图位于 ../../artifacts/2026-10-13-iteration-batch-380/，该证据目录最初命名早于发现其它任务占用编号，身份以本文件标题为准。

直接触发是可见名称与标识不同。filteredGroups 仅传 modelID/providerID/providerName 给字面子串 matcher；ProviderModelGroup 另读 canonical modelLabel 显示，造成显示/搜索输入分离。历史 8c06e8b55 统一字面匹配，36753fcea 改为友好标签时没有同步搜索字段。旧 helper 夹具只验证身份与 Provider，无法验证组件漏传标签。

影响共享 Composer 的 Chat/Work/Task/Mission 模型选择；名称包含空格、中文或别名皆可能受影响。模型请求、凭据、服务 API（Application Programming Interface，应用程序编程接口）、持久身份、数据迁移与调度不变。没有队列、唤醒、并发或终态异常证据。键盘 typeahead 的 optionTextValue=id 是另一个未经实测候选，本批排除。风险是 UI 选项形状变化必须保持所有选中/提交路径仍使用原 id。

## 实施方案（实施前）

ProviderGroup.models 使用既有 ModelOption[]；唯一 connectedModelOptions 投影同时携带 canonical id 与 label。搜索使用 id/label/providerID/providerName；列表直接消费相同 ModelOption，删除原重复 catalog→Map→选项重建。保持共享 matcher、身份选择、加载/错误归属、分组排序与文案合同。不会新增状态来源或依赖。

## 验收

真实桌面前后分别复核可见名 DeepSeek Chat、标识 deepseek-chat、Provider 名称、清空与选择结果；保存关键截图并人工查看。只用交互与截图，禁止 UI 自动化断言。当前属纯 UI 改动，不新增 UI 测试或纯镜像实现测试；执行 Overlay 类型检查、正式私有前端构建与现有文档检查。服务绑定不可变资源，后态启动新的独立端口捕获新构建，不重启用户服务。此修复无需 LLM（Large Language Model，大语言模型）运行，故本批不调用 GPT-6.1 Sol。

复核范围差异，范围提交后 fresh fetch、merge origin/main，核对完整 origin/main..HEAD 集合，执行正常 push 与 hooks；记录实际结果和未验证边界。持续目标保持 active。

## 进展

- 已完成：真实前态复现、根因与调用点核查、方案落盘、实现、后态桌面验收、独立复核与检查。
- 后态使用原生产 CLI（Command Line Interface，命令行接口）serve 于18431，独立 runtime-after。正式 Vite build 输出到本任务 ui-after，复制现有 Bun 可执行文件到本任务 after-host 并以本任务 ui junction 绑定私有构建，使用现有默认资源选择，无生产路由/加载旁路；没有替换共享 dist-vite 或用户进程。实际入口 main-BEMBE3S7.js。
- DeepSeek Chat 可见名与 deepseek-chat 标识均返回同项；Hugging Face 查询返回该 Provider 的16个模型；Clear 恢复完整分组；Qwen 3 Embedding 4B 名称能找到并选择，Composer 显示其名称且实际选择身份仍为 huggingface/Qwen/Qwen3-Embedding-4B。未发送消息或调用该模型，选择仅验证身份。
- 六张真实桌面截图在证据目录，已人工查看核心前后态、标识、Provider与选择结果。范围是 Windows 浏览器1280×720英文深色桌面；未声称验证原生 Tauri 或其他平台。
- Overlay typecheck session15738 exit0；私有 build34210 exit0；renderer-surface、docs:check（345 operations/25 groups）、architecture-index（18 documents）、diff --check 均通过。构建保留现有 use-client/大chunk提示，不是视觉验收替代。
- ui_audit 独立只读复核确认所有值/提交/check状态继续使用id，原排序与响应生命周期保持；未提出阻塞问题。
- 当前未完成：范围提交与推送。其它任务后续增加代理配置及Unicode截断修改，仍排除在本批暂存范围外。
