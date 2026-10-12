# 351 长来源列表的就近收起与阅读返回

## 当前恢复点

实现已完成，8张真实图片见 source-collapse-351/README。01原启动55760、02原启动68603均实际exit0，143/144页关闭，完整Host/Native/端口/输出/请求闭合。90表复制逐行相等，实际checker证明13Message/66Source/17持久化Provider身份完整等于原348历史，未发起新模型。类型73628、最终前端构建88361、完整桌面构建3865、i18n/CSS检查均通过；首次CSS失败按等值token修复，原失败保留。docs:check通过345操作/25组。剩余证据压缩/凭据扫描、范围commit及fetch/merge/push；其他任务mcp-service测试与CI月记录改动保留。

## Recall

用户要求持续自主改善 UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，重点 Sources 显示及子侧栏 Rendering 闪烁；最新只用单 agent，覆盖旧 goal 的多人措辞。350 已完成真实长段落重排和动画中 PageUp 修复，d06d5195e 已推送，上一轮为 progress。本轮开始 HEAD 41f2cbb20，另有外部检查目录 .module-topology-VefjTb/，保留；不提交或操作其他任务的文件。

## 调查、影响面与未知

已读 348/350 Recall、348 的来源密集截图、SourceParts 全实现、messages.css 来源样式、Disclosure 与架构 07。全仓搜索 more_sources/source_excerpt 只有共享来源组件和中英文资源。SourceParts 由主/Side/child 公共 CardParts 使用；第一条来源一直可见，其余来源通过原 cardExpanded 展开，按真实完整身份保留。Disclosure 使用原生 details/summary，只有第一个 summary 具有浏览器开关语义，不能为末尾入口再加第二个 summary。

348 真实64条搜索来源展开后，12图已经读到第42条，而唯一折叠入口在第1条之后、当前视口之外。代码也只有顶部入口。已知可观察问题是读完列表不能就近收起回到正文；是否出现额外阅读跳位，需要新真实页面证据，不能从静态代码推定。本轮先恢复348的完整已完成历史，检查末尾操作与当前 Sources 呈现，不先改生产代码。

若确认需要改善：保留唯一 details 与 cardExpanded 权威，复用现有 Button 提供末尾收起动作，焦点返回原 summary，并使用当前真实 transcript 阅读控制，避免活动跟随抢回底部。不截断、合并、重排或删除来源，不新增影子展开状态、队列、模型消息或数据协议。具体滚动方式先搜索现有合同和真实复现后补充。当前未观察到引擎调度异常；若发现队列、恢复或终态异常，立即按 Task/Mission/Session 全入口和执行轮次横审。

没有 API、持久化、Provider 或模型变更；可能影响主会话、Side 与子面板的共享来源操作、键盘焦点和滚动。风险是折叠远在视口上方的列表时，布局收缩让读者跳到无关正文。必须真实验证点击、键盘、重新展开、第一条来源和后续正文的衔接。纯 UI 改动不增加/运行 UI 自动化测试；当前检索路径若发现旧 UI 测试按仓库规则删除。

## 实施前实证与方案收敛

01 实际旧版页面143已进入348原Task/child。03图显示第52—64条来源与后续正文，整个来源组高1968px，顶部 summary 已在视口上方约1383px；末条之后没有就近收起入口，只有文件打开/复制。这是当前真实操作缺口，不是渲染队列异常。无凭据历史显示“Model configuration unavailable”是该只读模式的实际限制；没有发起新模型请求。完整90表内容相等，当前 schema 无漂移，原 Task completed/epoch1，派发恢复候选为空；原启动55760主动收尾后 actual exit0。

修复落在 SourceParts 唯一实现：展开区域末尾增加现有 mini ghost Button，关闭原 cardExpanded，先用最近 transcript 的既有 reading intent 暂停跟随，再把焦点还给唯一 summary，并以原生 scrollIntoView(nearest)让收起后的整个来源组可见。没有新的滚动状态、延时恢复或第二个 summary。引用[HTML details 合同](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element)和[焦点 API](https://html.spec.whatwg.org/multipage/interaction.html#focus-management-apis)，沿用浏览器原生键盘行为。全仓相同源只有中英文两份 i18n；新增“收起来源 / Collapse sources”，样式只使用现有 tokens 和 Button primitive。共享主/Side/child 都会得到入口，实际先验 child，主会话按已有同组数据复核。当前相关路径没有 UI 自动化测试。

私有准备脚本首次串联以未赋值 LASTEXITCODE 判非0而提前退出，首次 launch 在读取复制清单阶段失败，尚未创建进程。已把准备与复制分开执行，原检查全部重跑成功，保留原日志；这是调用器问题，不能当作产品失败或跳过验收。

## 真实验收与交付

类型和 i18n 检查通过；CSS token 检查在本轮已触及的 messages.css 发现既有 PDF（Portable Document Format，便携式文档格式）透明文字层 line-height:1 不符合当前 token 合同。blame 指向已有256c14e55a，设计 token 唯一 --ui-line-height-flat:1 且 checker 自身验证其值。以同值 token 替换这一字面值，不改变文字层布局/比例/交互；不放宽 checker。仍须重跑原检查并重新构建，不能把首次失败包装成功。PDF独立画面不属于本轮来源视觉结论。

用当前 canonical 只读 schema/config/recovery/lease/Task/Message/Memory 观察器重新检查348原历史；原精确进程、端口、原始句柄结算及凭据配对全部已闭合后，全 runtime 复制并逐表逐行比较完整内容。保留真实项目/Task/Session/Source 身份；不改变数据库，不重启或改写原用户页面。新隔离 source-collapse-351-history-01，18330/ui，600000ms固定原生窗口；不复制 auth/models、不执行新模型或重新启动 Task。只操作自己的新页面，先留旧画面，然后在全部构建准备好后用独立新窗口做正式复核，时间不足即关闭，不延长原时限。

人工截图必须真实呈现并查看。只读几何用于解释操作，不能作为 DOM 或像素断言。修改前补充根因与合同，修改后构建/类型/文档检查；完整归档原生物理/输出/请求/端口结算并取得原启动实际退出，脱敏留证。同步根/月/目录索引，范围提交、fresh fetch/merge、完整待推送集合复核、正常 push。goal 保持 active，不把完成态历史观察当作原 Research Studio 全帧流式通过。
