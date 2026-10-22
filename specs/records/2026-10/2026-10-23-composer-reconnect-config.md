# 重连时模型配置被过期健康状态拦截

## Recall

549延续用户自主体验、修复Sources/Rendering/UI/功能并提交推送的长期要求，最新单agent约束优先，不委托。548已推送01292d888，fresh 0/0，修复Session完整成员快照和三类Source契约，54聚焦合同、10次Sol EOF、七张实图。上一轮是progress；首张恢复图出现短暂模型配置警告，后续自动消失，本轮以该真实现象继续调查。当前仅原有 .bun/ 与 packages/opencorvus/bun/ 未跟踪缓存，五个548服务和三页均已闭合，20份配对退休。

用户已授权使用当前OpenCorvus OpenAI热认证；隔离验收精确复制完整openai条目与相邻完整models.json，目标gpt-6.1-sol、全流式。真实用户应用、进程和数据库不操作。UI只手工内置浏览器实页/截图，禁止UI自动化测试；现有composer-model-projection为纯HostTransport/服务状态合同，不当实页。computer-use及benchmark-debug-template沿用。

已读548Recall/证据/真实日志，composer-model、config.getSessionConfig/patchSessionConfig、connection/checkConnection/monitor、connection-projection、SSE connected入口、init恢复、ChatComposer反馈、store连接状态、全部getSessionConfig/模型投影调用点及07-panel-reactivity。模型投影仅使用getSessionConfig这一入口；主Task、普通Session/Mission首次选择、连接恢复、config.changed和用户Retry共用该服务。Side Chat不直接调用该GET包装。

## 修改前根因与影响面

548最终页真实Session快照19:38:52.767恢复，独立流式Provider预检成功，模型配置警告却出现；服务日志根Session/config唯一GET到19:39:01.759才发出并7ms返回200。SSE onEvent收到session.connected或task.connected后调用refreshActiveComposerModelFromSession，而getSessionConfig在appStore.connected=false时本地抛“Cannot load session config while disconnected”，未进入真实API。该布尔值仅由全局健康探测更新；SSE只更新messageStore.sseStatus，健康监测每10秒一次。因此恢复的流与过期健康观察交错时，成功服务被旧UI状态挡住，模型清空并显示配置错误；稍后完整workspace恢复重读成功掩盖问题。实际错误文本与时间将在私有只读诊断实页中确认，不凭截图标题判定认证故障。

这是前端读取资格重复判断，不是Provider认证、模型目录或执行调度失败。共享横审覆盖Task/普通Session/Mission、初次/重连/显式Retry/config.changed、同目录多选择、authority和selectionEpoch变更、并发在途读取及旧响应退休；原模型投影generation/selection/authority继续决定提交，真实网络失败与typed API错误继续反馈。全局健康状态仍负责页面在线呈现和发送/写入控制；不将SSE open当成整个workspace已恢复，也不添加健康探测、重试定时器或影子状态。

唯一方案是在确认原局部异常后删除getSessionConfig这项只读GET的过期connected门槛，让现有apiJson、捕获authority和调用方所有权完成真实请求。patchSessionConfig等写入条件保持现行独立契约；不扩大为通用离线策略重构。公共响应/持久schema/版本不变。纯服务正向测试验证离线健康观察下实际请求仍映射到ready模型，以及真实网络/API错误的原反馈；现有选择/authority并发用例保持。UI验收覆盖实际重连的第一次读，而非等待十秒后的补读。

## 固定验收计划

1. 以已正常闭合548-verified-after完整90表/所有原行字段时间/canonical为同一固定源，保留原parent ses_-zUS0X33CzzWEKMgCk98、member ses_-zUS0WzzQzzDOGrIbYwN、project prj_hSQinOa1MIVoNEeARpn5与原自有目录；没有新的业务输入、成员、Task或Goal。只读serialize，inventory实际发布附件，并核对源native/原exec/输出/request闭合、2次Sol EOF和四份配对退休。
2. before/after两份隔离scope在同一19109顺序启动，保持同一自有浏览器页离线→恢复；固定后复验使用19111两份fresh scope。每个最多4次模型尝试，总16，仅独立预检，全部reader EOF后关闭。20分钟原生资源边界、180秒启动/Provider无活动界限，至少留五分钟收尾。Node正式私有诊断构建先完成，再复制当前认证/全模型目录，Source CLI提供/ui，不单独启动Vite。
3. 私有诊断仅观测原projectComposerModelFromSession请求进入时connected、原错误/ready结果，以及原成员生命周期；不改状态/时间/返回值/渲染算法。截图查看断线、第一次恢复及最终模型控件/来源。服务真实GET日志与页面观测对齐，不把独立checker当页面请求；需要时展开原警告Details取实际错误，随后修复并重复同一路径。
4. 聚焦正向服务合同、类型/build与必要检查；所有自有页/服务/原native/exec输出闭合、成对退休、源和目标数据核验；最小非秘密证据及三索引、架构同步。范围提交，fresh fetch/merge、待推全集审核、正常hook与push，Goal保持active。ResizeObserver及Mission独立实页为后续范围。

## 修复前实际复现

内置浏览器169保持原parent/member/URL，服务36070→32081同端口19109自然恢复。19:51:48.896，原模型projection generation5进入时connected=false，在36.3ms内抛出原文Error: Cannot load session config while disconnected；真实截图03显示模型警告及Choose model。19:51:56.814，generation6才读取ready openai/gpt-6.1-sol，延迟约7.918秒。Details点击时原提示已自行消失，未伪称读到了Details截图；错误来自原函数仅观测日志。35正文/11来源及原组件保持。两scope各2次current Sol流式200/EOF，原exec/native/launcher0、输出/request闭合，八份配对成员已退休；再按已落盘唯一方案修改。

上述UTC为浏览器日志捕获时间，捕获延迟可能变化；原函数performance.now从failed=62264.7到后续ready=70751.3，相差8486.6ms，应以约8.487秒描述原模型空缺窗口。

## 修复后实际结果

[六张人工查看的实图与原请求证据](../../artifacts/2026-10-23-composer-reconnect-config/README.md)。只删除getSessionConfig对过期connected的本地拦截，保留原apiJson/authority、selectionEpoch、projection generation、错误反馈与PATCH/发送条件。

最终页170同parent/member/URL，16702→25782在19111顺序恢复，没有reload或切换选择。原generation5在connected=false时开始，真实GET在19:56:19.763抵达服务，1735ms返回200，原前端读取历时1819.2ms得到ready openai/gpt-6.1-sol；此时健康状态已自然转true，不能声称返回发生在健康恢复之前。关键是原请求直接执行，没有本地错误或等待下一次workspace重载。后续generation6/7保持相同模型。实图09正常恢复；图08拍得过早、仍是离线画面，留在私有目录而不当通过证据。实际打开模型选择器、搜索6.1并查看已选Sol后Escape，没有配置写入。

两页原35正文owner与11Source owner及top=64017保持。UI只真实交互/截图，无UI自动化测试。9项纯服务正向合同通过（包括离线观察下实际HostTransport请求与原错误、选择/authority交错），Overlay typecheck通过；两次Node正式诊断build为54.43s和58.77s，fixed-after使用同一修复资产。docs:check 345ops/26groups、architecture-index 20篇、diff检查通过，完整push hook按当前合同执行。

四scope均以同一闭合548-verified-after的90表165335原行为源，完整原行字段/时间、canonical、数据库字节mtime保留，目标实际schema3/对象/integrity保持，原行变化只有两条运行租约。各两次当前OpenCorvus Sol流式200/EOF，共8/16；原exec 36070/32081/16702/25782、native/launcher均0，输出/request与精确进程出生结算，16份runtime/private auth/models退休，源App认证和完整目录保持。全部关闭时距20分钟资源边界超过五分钟。

本批无数据库迁移、版本更新或发布，无新增业务消息或成员。全局健康呈现与流状态之间的短暂差异、ResizeObserver通知，以及Mission独立实页仍是后续体验范围；不以本批修复宣称全部问题解决。长期Goal active、单agent继续。
