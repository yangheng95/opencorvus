# 文件格式化与最终保存事实

## Recall

用户要求持续自主查找UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能问题，只使用一个agent，实际验证后精确提交、同步上游并正常推送；已关闭的Rendering闪烁不再排查，仅实际冲突才等待。600已推334f3096a，真实Sol原Chat新增127字节三行文本、摘要5文件与Review通过；34项后端合同/110断言通过。9次真实请求含原overloaded失败及同Chat续跑，累计111次；自有服务/原调用/输出/请求结清并提前533287ms关闭，auth/models副本退休，用户18571和真实数据库未操作。旧598关闭预留失败、原生batch和594连接失败未知项继续保留，Goal保持active。

开始HEAD334f3096a，MCP（Model Context Protocol，模型上下文协议）/Config共享死锁由另一用户授权会话处理，声明占用src/config/config.ts、src/mcp/index.ts、05-config及对应测试；本轮避开这些文件，不发消息、不使用子agent。工作区还有其修改、内存测试修改及旧产物删除/索引排序，全部保留，无新branch/worktree。

已重读600 Recall及FileTime、WriteTool/EditTool/ApplyPatchTool、全部File.Event.Edited生产入口、Bus真实await收敛、Format.init/file进程、InstanceBootstrap、File.create/copy/move/delete/upload/writeText、GUI FileEditorPane.save和公共file-workbench。全仓搜索证明Format.init仅由bootstrap调用；唯一Format订阅器接受所有edited事件。当前FileEditorPane已经以返回content/revision更新基线，并仅在提交草稿未被后续输入改变时更新正文，无需新增界面状态或双源。现有格式化执行器对host/Task保留同一Process权限和物理结清；OCI（Open Container Initiative，开放容器倡议）工作目录绑定同一sourceRoot。未检索到本范围的UI自动化测试，不新增或运行它们。

## 修改前分析

本轮沿600未完的跨写入口审计，发现格式化是共享写入数据流中的隐式变更。Bus确实await所有订阅者，Format.init对每次File.Event.Edited运行已配置formatter；它没有区别“编辑文本”和“原样传输字节”。600的write在发布事件前已经读取after；edit则在事件后读取，说明两条当前路径对最终字节的定义不一致。apply_patch的files/diff又在实际写入/事件前生成。附件write的canonical源声明可以在事件后的格式化中失真；File.copy通知source和target，可能同时改变两个原本只应复制的文件；move/upload同样可能改变转移字节。

GUI File.writeText在原子写入后等待该事件，但返回输入content及其revision；若订阅器格式化，返回值就不对应最终磁盘。下一次编辑用该revision保存可能冲突。FileEditorPane已正确消费返回值，因此首先修复唯一实际保存事实，不在界面复制文件状态。以上有代码证据；真实Prettier路径的触发、具体输出及HTTP（Hypertext Transfer Protocol，超文本传输协议）保存行为仍待下述原生probe验证，验证前不实施生产修改。

共享机制横向审计覆盖全部生产编辑/字节传输入口、普通Chat/Work/Task/Mission公共工具目录及Task原生/Capsule执行权属、正常/失败/取消/重启路径。格式化是本次写入内实际子进程，不新增调度状态，沿同一个runFormatterProcess执行并结清。现有FileTime只约束同实例write/edit，apply_patch、GUI与跨进程/外部写入仍是未完成的共享并发审计，不能据本轮成功判定为单一工具或用例问题。本批优先关闭已证实的格式化所有权与最终字节事实，不宣称解决全部写入并发。

方案是删除自动格式化事件订阅及其bootstrap入口，把同一formatter循环作为唯一显式Format.file操作，直接放入文本变更流程；事件只通知实际完成的文件改变。write/edit/apply_patch和GUI文本保存/创建继续按现有单一formatter配置格式化并在完成后记录真实结果；附件、上传、复制、移动和删除只保留真实操作语义，不格式化。没有新开关、保留旧订阅器、旧协议分支、影子状态或LLM工具选择gate。当前公开接口形状、编辑事件和schema8不变，复用既有filediff与FileContent/revision；不改旧迁移、不重写旧消息。

apply_patch需从实际写入和格式化后读回文本再生成files/diff，避免预先计算事实。GUI在格式化后捕获真实提交快照，再通知观察者并返回；之后外部写入不反向改变这次快照。格式化命令现有失败/超时政策保持，未承诺格式化成功时不能伪报，最终字节仍须实际读回。格式化日志当前直接展开formatter.environment，删除该不必要的值转储，避免把配置环境值写入日志；不新增秘密提示或确认流程。

影响面包括Format模块、bootstrap、三个内建文本工具、GUI文件服务、原FileEvent消费者及其成熟Process执行器。保留具体文件路径授权、Task文件绑定、预期revision、字节独占新建、外部资源约束、现有语言和真实消息。风险为漏掉生产文本入口、把字节操作误作编辑、formatter后读回失败、GUI基线错误及Task进程权属丢失。交付仅Git提交/推送，不更新版本或发布。

## 实施与验收

修改前真实进程probe已完成。最初两次是测试助手自身的异步生命周期、错误配置路径问题，已修正为await完整Instance作用域和唯一`.opencorvus/opencorvus.jsonc`，不作为产品失败。`contracts-canonical-before`进入真实Prettier后发现GUI和copy的即时读回仍是原文；继续追到Bus.publishOwned，它返回的是持久化accepted Promise，格式化在后台实际delivery执行，await notifyEdited并非await formatter。加入现有Bus.TestHooks.disposeOwnedState结清真实publication后，`contracts-settled-before`原调用退出1、物理和输出结清，5项全部复现失败：write/patch after仍是未格式化正文、附件14字节被改成19字节、GUI回执与最终正文/revision不符、copy同时改写源和目标。GUI下一次保存409。这里不是durable订阅器被忽略，而是返回持久化接受与异步完成的时序区别；先前“Bus确实await”的分析只适用于直接publish，现已补正。代码和真实证据共同确认显式文本变更所有权方案，后续按其实施。

1. 先运行当前真实Config/Format/Process/Prettier的原生集成probe，覆盖文本write回执、canonical附件原样保存及GUI保存回执/下一次保存；保留实际失败输入、输出和原进程结清。它是后端集成证据，不冒充模型、GUI或视觉验收。
2. 有真实证据后按本方案改唯一当前实现。聚焦正向合同覆盖write/edit/apply_patch、创建、复制、移动、上传的最终实际字节和事件观察；GUI必须通过真实HTTP checker验证返回content/revision、实际磁盘及连续保存。Task原生formatter调用走既有Task权限和原生进程，记录其完成事实；不以mock/stub或不存在某调用为核心断言。
3. 本轮不发起模型请求、不复制凭据。使用独立自有项目/数据和开发CLI `/ui`，当前UI代码若未改变可复用已核对的普通Node生产构建。单人实际打开JS文件、输入未格式化文本、保存、查看格式化结果并再次保存，截图人工复核；页面/服务20分钟物理边界且至少提前5分钟公开关闭，结清原调用/物理/输出/请求。用户18571不操作。
4. 更新当前架构、记录/证据与三索引，文档和必要类型/功能检查后精确提交；fetch/merge、完整待推集合复核及正常hook与证书验证推送。旧未知项、未满足项及跨入口并发审计继续保留。

## 结果与复核

唯一Format.file现已由文本变更所有者显式await，旧Format.init订阅及bootstrap调用删除；事件/HTTP响应形状和schema8均不变。write/edit（含新建）/patch新增、更新和移动在格式化结束后真实读回；patch重复的预写diff/行数计算改为唯一实际结果计算。GUI在原锁内抓取格式化提交快照再通知，已有FileEditorPane直接采用实际返回值。附件、copy、move、upload现在保留精确输入字节。删除formatter.environment日志展开，保留命令、文件和真实错误。

首组4文件48项/204断言通过，补充组2文件8项/46断言通过（7项formatter与首组5项重叠，另加真实HTTP跨进程/重启/符号链接检查）；唯一计51项，核心typecheck通过。Task测试使用真实native绑定及实际Node Prettier进程，不使用模拟formatter。测试工具链最初两次未进入真实契约，已按当前唯一配置与异步生命周期修正；修改前结清probe5项失败、修改后7项通过。

实际开发CLI54109使用全新自有数据、项目和相同普通Node UI main-BXg7TeEn.js。通过公开Session接口建立空Work Chat，未产生任何消息，再在真实Files/File编辑器两次输入未格式化JS并点击Save。截图01至03逐张人工查看：首次显示const x = { a: 1 }，第二次显示const next = { b: 2 }，未保存标记随真实返回清除。最终公开GET200正文与磁盘匹配；实际PATCH file/content两次。不是模型端到端验收，不复制auth、不发模型请求，用户18571及真实数据库未操作。自有数据库schema8、integrity ok、message行数0。

自有服务公开shutdown200、原始exec97947退出0、launcher/native退出0，物理/输出/请求完整结清，原进程链dead_or_reused；物理结清较20分钟边界提前835136ms，超过5分钟预留。一次用Windows PowerShell5调用关闭脚本时因旧.NET不支持ArgumentList而在身份检查前失败，已用当前PowerShell7重跑原关闭/结清checker成功，没有绕过检查。自有标签282已关闭。

共享跨入口锁仍未全部收敛，旧native batch/594连接/598关闭预留未知项不被本轮覆盖；不是所有功能已完成。继续自主迭代，不恢复已关闭的闪烁调查。docs:check通过（350操作、26组），核心typecheck和两个聚焦原调用均退出0；本轮提交只包含上述源代码、测试、当前契约与证据/索引。提交身份和远端同步结果以对应Git提交及正常push输出为证据，完整待推送集合须在fetch/merge后复核，不跳过hook或证书验证。
