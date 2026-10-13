# 模型列表键盘前缀导航

## Recall

持续迭代当前版本，分批并行调查，先根因/影响分析落盘，再实现、真实桌面截图人工复核、必要正向功能验收及范围提交/上游同步/正常push，直到用户明确停止。禁止UI（User Interface，用户界面）自动化；未调用LLM（Large Language Model，大语言模型）时不伪称Provider端到端。本批不改模型执行，不需要GPT-6.1 Sol请求。

前两批b3f5c6ad3模型名称搜索、5768f3b35文件字节准入均已正常推送；后一批39项/228断言、真实桌面前后保存及全部hooks通过。当前HEAD ff879cabb含另任务SearchField清除改动；工作区另有session/message-store/source-persistence的并行修改，完全排除本批。model_keyboard_audit只读并行核对安装Kobalte0.13.11的typeahead（键入前缀定位）语义、共享Listbox与组件调用，未再次委托。主agent完成真实页面；另两只读分工调查原生Markdown/文件来源候选，没有授权产品实现。

已读现行07-panel、ComposerModelSelector、共享ui/Listbox、安装@kobalte/core Listbox optionTextValue定义及list-keyboard-delegate:getKeyForSearch、前批Composer Recall。全仓查同属性与调用：Reference使用label，ScheduledAutomation项目使用name；本问题不是共享primitive失效。Mention的身份首字段未实页复现，排除本批。没有触及UI自动化测试。

## 现象、根因和影响

18434独立源码CLI（Command Line Interface，命令行接口）开发服务/ui，原正式私有构建main-BEMBE3S7.js。打开模型选择器→Hugging Face→两次Tab，焦点进入DeepSeek-R1-0528。按q，焦点仍停留该项；等待下一次操作后按h，焦点移到DeepSeek-V3.2。两图已人工查看，真实焦点与可见Qwen项可复核。未发消息或模型请求。

列表optionTextValue使用完整id（provider/model），实际呈现label；Kobalte按textValue前缀导航，因而搜索的是隐藏Provider前缀。前批只修显式搜索框过滤，并保留未经验证的typeahead边界；本批已补真实证据。影响共享Composer各会话的键盘定位；指针、模型身份、持久化、请求路由无改动。没有Task/Mission/Session调度或并发异常证据，不改这些执行机制。

07-panel的旧段落仍声称列表显示完整ID，与现行canonical label矛盾；本批同步此触及合同，避免同文档两种事实源。

## 实施前方案与验收

仅将optionTextValue改为已有option.label，保持optionValue、currentModel、onPick和完整ID tooltip原值。复用Kobalte现有buffer、匹配和焦点生命周期，不新增事件处理或导航状态。

新私有正式前端构建后启动18435独立开发服务，重复Hugging Face→两次Tab→q，截图确认焦点实际跳至Qwen可见项；Enter选择后核对完整ID、重新打开所选状态。保留名称搜索、Provider筛选和Clear已交付行为。只做真实交互/截图，不新增或运行UI自动化；执行Overlay类型、构建、文档/架构检查与独立diff review。维护spec根/月/artifacts索引，范围提交后fresh fetch/merge与完整待推集合审查，正常push。

原生Markdown相对引用是后续候选：379明确保留原生正文；目前最终response.url只进Sources、模型工具转换仅取正文，重定向后的基址可能不可知。当前没有该类型的真实模型引用点击证据，不改正文、不让UI猜基址。应先独立真实验收再决定。

另一个文件身份候选来自只读分工：normalizeProjectFilePath保留README.md、./README.md、packages/../README.md的不同键；真实realpath核对三者同目标，而file-workbench严格key比较会进入离开判定。当前仅代码/真实纯函数/文件系统证据，未实页验证未保存草稿的引用点击。后续须先复现并核对点段、平台和符号链接语义，不直接做全局字符串替换。本批排除该功能变更。

## 状态

产品仅一行optionTextValue id→label。model_keyboard_audit独立复核通过：optionValue/选中判断/回调/tooltip保留原ID，标签同目录来源，重复显示名称仍有独立身份，沿原库循环定位，不改变搜索、分组或加载生命周期。07-panel的过期显示合同同步修正。

后态18435使用Bun1.4源码CLI与新私有正式构建（.tmp-codex-model-keyboard-01a133/ui），通过同样Hugging Face→Tab两次→q，真实焦点跳到Qwen 3 Embedding 4B。Enter后Composer选择仍为huggingface/Qwen/Qwen3-Embedding-4B；重开同项selected。Clear后焦点仍在搜索输入，键入DeepSeek Chat返回该可见名。共五张截图人工查看，见[证据](../../artifacts/2026-10-13-model-keyboard/README.md)。没有UI自动断言或模型请求。

Overlay类型session52011 exit0；正式私有build51402 exit0（79秒）；docs:check345operations/25groups、architecture-index18documents与diff --check通过。原18434/18435服务均/shutdown自然exit0，页面关闭。桌面范围Windows英文深色1280×720，未声称原生窗口或其它平台验证。

剩余交付：范围提交及fresh fetch/merge、正常push；持续目标保持active，两个后续候选尚待实际复现。
