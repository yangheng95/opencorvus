# 380 长行读取的 Unicode 边界

## Recall

用户要求持续按批次并行体验 UI/UX（User Interface/User Experience，用户界面与体验）、功能完成度与缺陷，先分析并落盘 specs，再修复、真实桌面交互与截图人工复核、聚焦正向测试、必要的授权 GPT-6.1 Sol 验收、范围提交、上游合并与正常推送。当前目标保持 active，未经明确停止不结束目标。起始 main/ba1c6e5a6，git status --short 为空。仅一层两个只读 agent：audit_ui 检查文件工作台/设置，audit_functionality 检查文件与网页工具；禁止二次委托，实施和页面由主 agent 负责。

硬约束：保留无关更改；不创建分支/工作树；不用 UI 自动化测试；独立新服务及页面，不操作用户服务或窗口；不使用凭据，不创建模型请求。本批候选为文件树呈现，Provider 和调度执行不适用。若后续确需模型请求，另明确该次验收边界。specs 索引与当前文档检查同步。

已读根 AGENTS、package 脚本、07-panel、server-runtime-readiness、377/379 记录及证据、FileExplorerPanel 全部加载/状态/rows 路径。全仓定义和调用点搜索由 audit_ui 进一步核对；未完成信息在下节保留未知。真实页面使用生产 listener/recovery 的开发源码入口、独立无凭据运行目录和377正式私有前端产物，其后该界面文件未修改。修改后必须正式构建独立产物并启动新服务。

## 初步调查与实施前边界

源码候选：FileExplorerPanel 的重置 effect 同时订阅 directory/API authority/selection epoch/active，active 变动清空 childrenByPath/loading/errors；expandedPaths 只跟项目/authority/selection 重置。恢复时仅加载根目录，定时刷新只刷新已有 children/error 的展开目录。因此已展开但未选中文件的目录可能显示展开箭头但失去子项。尚待真实页面复现，未据此修改生产代码。

根因候选是内容缓存生命周期与展开意图生命周期不一致。旧路径的选中文件祖先补载只能覆盖 selectedFileTarget 祖先，不能覆盖其它展开分支。影响面包括同项目文件树隐藏/恢复、工作台 tab 切换与目录/API 切换；准确生产 active 调用尚待 agent 反馈。服务器文件数据、文件读写接口、数据库、Task/Mission/Session 调度均未发现相关修改需求。

计划：先用真实目录层级展开、离开再返回并截图；若复现，核对作用域生命周期并仅调整现有加载/缓存归属，保持项目/API/epoch 隔离与真实刷新。不得增加第二份树状态。复核多个展开分支、选中文件祖先、隐藏期磁盘变化和项目切换。UI 无自动化测试；正式类型检查/build 仅辅助，真实页面截图为视觉证据。纯数据/服务器合同若有变更，再添加聚焦正向测试。次批候选为 text-file 长行截断切开 Unicode 代理对，单独评估与提交。

## 候选收敛与委托反馈

audit_ui 进一步核对 main.tsx/TabPanel，生产 active 表示页签存在且常规切换会卸载组件，所以最初文件树候选未证明可到达，不实施推测性修复。无凭据 localhost:18480/ui 页面实际检查了文件菜单、命令搜索和设置网络页；没有进行代理写入。随后发现另一独立任务已经创建 iteration-proxy-credentials 方案、并负责相同认证问题。本批保留其文件、索引行和运行环境，不重复代理修复。

audit_functionality 用实际 readTextFilePageContent 执行 1999 个 a + 🙂tail，原始返回孤立高代理项，UTF-8 编解码后出现替代字符。主 agent 复读 text-file、read、skill、grep 和 text-file-page/read-tool-cited-range 测试，核对全仓调用：共享 collector 的字符串和文件流两个入口分别由 ReadTool 与 SkillTool/MissionSkillTool 消费；没有另外的分页实现。已读 340 历史分页统一及 grep 当前已修复的同类截断边界。当前代码仍直接 substring(0,2000)，已有中文测试只覆盖基本多文种平面字符。

## 确定的根因与影响

ECMAScript 字符串按 UTF-16（16位 Unicode 转换格式）编码单元计数，substring 可在代理对中间结束（[ECMA-262 String Type](https://tc39.es/ecma262/2024/#sec-ecmascript-language-types-string-type)）。当前 2000 单元长行上限在高代理项后截断，返回的字符身份已改变；普通 read 的输出/preview、技能附属文本的输出，以及后续工具结果持久化/模型输入均受影响。源文件保持原字节，Source 的文件路径和行范围、分页 offset/limit/总行数没有错误证据。图片/PDF/二进制分支、配置、授权、Provider 请求机制、Task/Mission/Session 调度、队列与恢复不适用。

旧分页修复没有根治的原因是集中行数和字节计数时保留了原 substring；grep 的命中窗口已独立处理代理对，但其双端窗口与此处前缀不是同一能力，不为本次抽象新通用裁剪框架。

## 实施前最终方案

1. 共享 collector 计算 end=min(length,2000)，仅当边界正好切开有效高低代理对时 end 退一位，再从同一 text.slice(0,end) 加现有截断后缀。2000预算、50 KB页预算、提示、行数、来源均保持同一合同。非目标的字形组合簇分割及原输入非法Unicode不扩大处理。
2. 修改前增加明确完整输出正例并经正式隔离 runner 实证失败：跨边界 emoji、恰好边界内 emoji、边界后 emoji、BMP 字符和含补充平面字符的字节截断。字符串/真实文件流两入口均覆盖，普通Read及两种Skill工具使用实际文件执行，检查正文/preview/metadata/来源事实。
3. 修改后同命令重跑，相关来源行范围合同与类型/文档/架构检查。界面不改动、不创建UI自动化测试。真实桌面模型验收仅在该次明确边界后执行；真实Provider、工具持久化和视觉证据与局部合同分开记录。尚未执行则不得宣称模型端到端通过。
4. 当前规范在02-data记录完整字符输出边界。本记录、根/月索引与实际证据同步；只暂存本任务文件/索引hunk，范围提交、fresh fetch/merge、待推送集合审查、正常push。并行代理任务文件及索引保持原样。

## 状态

正式 runner 改前18项测试12pass/6fail，实际普通Read和两类Skill均在预期字符串处失败。实现已限定在共享collector的完整代理对边界，正在同命令复跑。

用户本轮明确要求必要的授权 GPT-6.1 Sol 端到端验收，本次按该范围执行一次最终真实流式read验证。固定 text-unicode-380-after NativeService，localhost:18481/ui，600000ms和最多12次累计Provider请求（包含预检）；使用已经检查的live-sol-locale-377-after.ps1与唯一CLI wrapper，不重建运行器。隔离目录与auth/models配对复制及清理均由既有运行器执行，启动前分别验证credential usable/catalog projected/actual gpt-6.1-sol streaming。只提交新建公开Unicode测试文件；不向模型发送私有原文件或凭据。模型实际调用read，主agent从真实工具卡查看结果并截图，随后通过原Source打开同一物理文件查看完整内容；规范数据库工具结果由独立非UI checker核对精确前缀。页签、Host、Native、输出、请求、端口和配对凭据均正常收尾。技能两类只声明正式功能工具路径通过，不外推其模型端到端。

## 中断事实与共享机制复核

上述为预定验收要求，不是收尾已完成结论。实际模型完成一次read并回复；1440×900桌面工具卡横向滚动截图显示第一行a后接截断提示、第二行完整🙂后接提示。随后Source点击进入Loading时收到目标继续上下文。13:30复查：原exec 26032/53182/28617句柄均丢失，原Host68552和Target77772已不在，18481没有listener；原native-host-settled和stdout排空回执不存在。因果来源未知，不能把上下文切换当作已证实根因，不能包装为正常退出或重写原验收。正式测试最终日志仍为20pass/74断言，类型日志无错误但原exit结果不可恢复，须重新实际执行以取得退出码。

按178既有调查重新核对共享恢复机制：唯一生产recoverOrphanedWindowsRequests由cli/server-runtime启动入口调用；ProcessFacade/ProcessSupervisor按runtime occurrence和原生进程birth归属Host、Task、Session shell、浏览器/MCP/capsule/plugin等生产入口，正常退出、终态和恢复复用该owner；多项目/并行由独立runtime/request隔离，重启转移另有transfer receipt。当前只准入本轮runtime/tmp/supervisor-gB7cBm，非detached、terminate_children_on_root_exit=true，request64af08e9-86de-4161-9ce0-c86f27f5d136，helper81772/win32:639274659806474542。不启动整库Task/Mission/Session恢复、不重放会话或运行模型。原生产调度多入口/重试/并发/重启的完整运行矩阵未知；本轮没有证据证明它们导致进程消失，也不能仅凭会话完成就排除共享根因。

恢复前保存原请求私有副本和无凭据身份投影；以生产observer确认Host/Target/helper精确旧实例死亡后，仅调用一次同runtime的生产orphan recovery。只有removed=1且无未收敛请求，并重新确认三实例与端口退出，才清理原scope/runtime/data下已复制的auth/models两文件，核对无reparse与精确父目录。该回执是恢复后custody清理，不是原生正常收尾证明。浏览器仅剩该scope的不可达页，读取被浏览器URL策略拒绝，未绕过；不再访问该失效目标。后续新scope独立声明预算、请求和实际页面，原失败完整保留。

13:33实际生产恢复inspected1/removed1，live/current/unknown/quarantine均0；三个原生实例再次dead_or_reused，18481无listener。配对复制文件已在精确非reparse路径删除，原会话和请求目录私有原件保留。只读归档保留实际一次read完成结果和原始截图。新的text-unicode-380-final/18482维持独立600000ms/12请求固定预算，同公开输入、同377私有UI和当前后端；补齐Source原文件查看、正常shutdown和原launcher exit。不得拿新轮通过覆盖旧轮缺少输出排空的事实。

## 最终验收

20项聚焦测试、74断言在正式隔离runner通过，初次PATH使用Bun1.3.14的通过记录保留；最终把已有Bun1.4.0目录前置PATH后，真实子runner输出确认1.4.0并exit0，不仅切换外层bun run。后端类型96050exit0。真实最终Sol共5次HTTP200/EOF，唯一read参数为原公开文件offset1/limit3；规范持久化完整正文/preview和Source经独立checker精确匹配，原物理文件全文保持原值。实际Source打开与Ctrl+End查看、工具长行横向阅读均截图人工复核。最终launcher11757及shutdown18857exit0，Native243281ms，Host/Target/output/request/端口和auth-models副本闭合。原中断事实如上保留。

全部证据及限制见 [验收目录](../../artifacts/2026-10-13-text-unicode-380/README.md)。docs:check（345ops/25groups）和architecture-index（18文档）通过；本批提交只收录长行边界实现、正向功能合同、未发布双语说明及本批文档/截图/证据。并行文件文本准入和Composer记录更改保持原样，根/月索引仅暂存本批条目。随后按fresh fetch/merge、完整待推集合审查和正常push交付，目标active，后续批次继续。
