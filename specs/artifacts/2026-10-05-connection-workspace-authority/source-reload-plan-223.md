# 223 Sources 展开与已加载文件重读体验

## Recall

用户要求持续自主体验、改进 UI（User Interface，用户界面）与功能，重点 Sources 和 Rendering；最新明确只使用单 agent，不再委托。222 已推送 3d136b1f，起始 git status 干净。上一轮完成真实 Sol 来源、404 诊断/重试/恢复和单行文件标签；此次复查原生 Sources 展开，并进入此前未验的已加载文件重读失败。不得修改用户页面 IAB（In-App Browser，应用内浏览器）23/进程，禁止 UI 自动化测试、伪造消息/来源、重启旧 scope 或扩大凭据授权。

已读 AGENTS.md、222 Recall/结果、SourceParts、Disclosure、conversation-ui、FileEditorPane、Shared Feedback、07-panel 与 07-panel-reactivity，以及现行完整历史 copy/launch/readiness/frontier/custody/sole shutdown 工具。搜索定义/调用点：Sources 的两种 Disclosure 均由 cardExpanded 控制；通用 Disclosure 原生 toggle 后通知；其他 UI 原生展开控件共享同一 primitive。FileEditorPane 的 save/reload/close 与离开对话框目前共用 error 字符串，初始 load 独立保留原 cause。没有与本次组件相关的 UI 自动化测试被执行。

验收：真实原 Source 展开/收起、文件打开；已加载文件在原路径暂不可读时原正文及草稿保持，错误简短且完整诊断可访问；同一重读恢复成功。必须保存实际截图人工查看及原错误，不把 DOM（Document Object Model，文档对象模型）观察、类型/build 或历史模型结果冒充当前视觉/模型验收。

## 修改前调查与影响

Sources 之前存在点击后仍收起的操作线索，但没有足够事件证据；原生 toggle 异步回写只是假设。没有证实共享控件根因前不改 Disclosure 或增加第二个展开 owner。当前文件已加载后 reload catch 会将 ApiError 字符串化到 footer，丢失 status/path/body/requestID 的原始结构；这是代码证据，当前可观察长度与布局仍需真实页面确认。222 仅处理初始未加载文件，所以旧 footer 路径未根治。

相关公开 API（Application Programming Interface，应用编程接口）、File content/revision、保存前提、目标/API authority/load-save-reload generation、draftRevision、离开确认与 reservation 必须保持。若发现恢复/并发/终态异常立即横审共享执行机制；目前未发现新的调度异常，不推定模型问题。可能的 UI 改动限定文件 pane 原错误表示及已有 Shared Feedback；保存冲突仍保留现有简短专用提示，禁止重试自动写入或丢草稿。Backend/SDK（Software Development Kit，软件开发工具包）与 Provider 无拟议改动；功能/视觉范围需根据实际 before 明确后再实施。

## 实施前步骤

只读重新核验原 222 before 完整配置、两个 Project/终端/孤儿目录、Task/Mission/Session/发布/请求/lease/恢复前沿；原 README 已恢复，不能继续使用其 quarantined 旧事实。原服务 birth 死亡、原/新端口空闲、复制凭据对已清理后，复用全 90 表实际完整行比对的正常 serve，保留原 Project directory/Session/Source。fresh 18149 / source-reload-223-before-01，固定 900000ms 期限，无模型、子 agent 或历史 Task 重启。

真实页面展开/收起/再次展开及打开原 README。若未复现展开问题按未证实记录。只对前轮自己生成且已恢复的 46-byte README 在同一原 Run 内单文件可逆移动；先落盘 owner/绝对边界/完整实际字节 receipt。已加载编辑器重读、查看原失败和草稿保护，按同一 receipt 归还原路径；不得触及用户仓库文件。完成根因与影响记录后才修改。若实施，types/build/docs，fresh 完整当前准入/历史副本验证新 asset 与真实错误/恢复，截图亲自复核；UI-only 不创建组件/DOM/快照测试。

所有自有页面、sole shutdown、原 foreground exit、Native settled 的物理/output/request、独立 birth/port/pair 闭合；最终 canonical 13 表实际完整行相同及 Project inventory 明确变化审查。源 README 原路径/完整字节恢复，原失败保留。自有 FFI（Foreign Function Interface，外部函数接口）逐文件只在全部进程/checker 结束后按精确出生范围归档。同步 root/月/本目录索引并运行 docs:check，范围提交、fetch/merge upstream、完整待推送集合复核与正常 hooks/push。目标保持 active。

## 当前 before 实证、根因与准许实施范围

fresh 18149/IAB44 原 main-C66LIH6m，原 Source 真实 click 展开、click 收起、Enter 重新展开均正确；没有本次展开失效证据，不修改通用 Disclosure。原自然 README 打开/正文正确。精确原 owner/路径/46 bytes receipt 后仅该自有文件可逆 Move；真实已加载 reload GET404，原正文保留，底部 raw API encoded directory 长串占约 117px，无 Details。截图 loaded-reload-original-failure 与 draft-reload-original-failure 亲自查看；草稿追加 draft-223 后确认 Discard and reload 的 GET404 仍保留实际草稿/dirty 标记，正确保护不得改变。恢复原文件后最后截图拍在 reload 尚进行时即关闭；虽操作成功提交，该截图不能证明已恢复正文，留作原时序事实，最终 after 必须补真正成功后的截图。

根因确认：loaded reload catch 的 errorMessage 丢弃 ApiError 原值，footer 只有 raw string；离开 Dialog 同一 error 字符串重复展示。222 仅改初始 load，因此保留此旧路径。全仓当前相关定义/调用/样式/i18n/架构检索完成。拟将唯一 action error 信号改为 nullable {message,cause?}；字符串业务反馈仍是相同 message，真实 thrown cause 同一记录保留，不增加错误缓存。loaded reload 采用简短本地化提示（当前内容仍保留）+原 formatter Details；save/close 仍相同错误文字/冲突专用提示，只随结构保留原 cause。业务异步 guard/draft/leave/reservation/写入合同不变。Shared Feedback 替换 footer raw 容器，文件局部限制最大高度并承接 native scroll，展开完整长诊断时仍留正文；Dialog 使用同一 message/cause。save/close 新 Details 的实际故障视觉未知，不宣称本轮验收。UI-only，非 UI 运行合同不改，不创建 UI 自动化测试。

## 当前完成项与未完成项

按分析实施唯一 action error/message-cause 与局部共享 Feedback；types/build/docs0。fresh after18150/main-BKapQkFd 原生完整诊断末尾、带草稿取消/确认失败、文件完整归还再真正同一 reload200/原正文/Source返回均人工截图复核。之前过早捕获的 before截图不冒充成功。语言更改在无模型目录投影副本遭config PATCH400，保留实际两请求/目录mtime变化和错误截图，中文/深色未达成，后续须先完整配置事务/入口根因审计。

两Native/原foreground真实0/fullcleanup、deadline未改、13表完整行相等。最终after Host PID晚期被svchost.exe复用，production observer unknown_live原错误保留，独立Windows实际新出生晚于原终态证明原执行已终止，不改变observer或触及系统服务。唯一自己README完整bytes/原路径恢复，目录mtime差异如实记录。细节[结果](source-reload-223/README.md)，整体持续goal active。
