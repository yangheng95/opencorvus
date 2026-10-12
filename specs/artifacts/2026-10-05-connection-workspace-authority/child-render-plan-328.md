# 328 真实子会话来源与 Rendering 复查

## Recall

用户持续要求深度体验、Sources显示和子会话Rendering闪烁修复；最新只允许单agent开发，覆盖旧goal的Astra并行措辞。327是progress：两项Dock修复与真实Side证据已正常推送`2c0c20cdda96312e5343fbb15d9843eaf839033f`，当前工作区干净，全部327资源退出。普通Side不能替代原子成员视图，本轮回到真实SubagentConversationPanel。

开发、调查、代码和页面复核均由root单独承担。沿用322已实际采用的产品验收方式：被测应用内只派一个只读base-researcher，以产生真实子会话；这不是开发子agent委托，不启动collaboration agent或多研究员。仍使用已授权的OpenAI凭据与完整models配对，实际模型必须为gpt-6.1-sol流式。

已读327/322 Recall与真实结果、SubagentConversationPanel完整资源/实时合并/生命周期、CardParts的Message/Source分组、TextPart/text-part-model、Markdown worker与请求合并缓存、Source持久化及调用点、当前架构。全仓检索createStreamingTextPartModel/SubagentConversationPanel/CitationAwareBodyParts在overlay test/script没有专用UI测试。模型和UI只使用同一真实消息数据，不注入文本、Source或重放事件。

## 当前分析与未知

当前renderer保留已接收HTML，只有pending且尚无HTML时显示Rendering；终态正文有有界完成缓存。子面板按真实targetKey保留owner，真实live投影与HTTP补全在同一合并路径。因Source插入或Message membership变化导致Index分组迁移仍属于待证候选；不能凭函数结构直接宣布根因。322已见子侧栏来源展开和后文生成，未见重复Rendering，但不是全时段证明；新一轮必须绑定当前构建和实际子会话时序。

UI范围包括真实派发、子会话选择、来源分组展开、文件准确行号、网页标题/中文fragment、正文流式期间读位与面板关闭重开。无已确认新bug，因此不先加缓存、隐藏占位符或改变分组。当前不改接口、配置、队列、调度或Provider策略。若发现并发/恢复/队列/终态异常，立即按AGENTS横向审计全部生产入口、Task/Mission/Session轮次和隔离边界后决定修复。

## 实际范围

fresh正常开发`/ui`18299，沿用327最新已完成构建，不无改动重建或单启Vite。Task资格使用成熟launch-305包装器：原生进程、auth/models配对预检，累计20请求，真实Task openedAt起900000ms和180秒真实活动观察；不续租或延长。真实CLI task create是生产入口，随后所有UI验收进入该Task页面。保留原request-id以恢复未知创建结果，不重复Task。

隔离项目新增普通授权输入source-review.md，三行RENDER328明确是“待验证场景”，不是产品测得事实。请求一个研究员：正常可见开场→search_code命中→第1–4节约1800字→真实MDN参数章节→第5–8节约1800字→真实中文维基API→第9–12节约1800字和简短引用。负责人读取该研究员原有可见正文及工具事实后收尾，不重写整篇、不额外分派或写文件。自然消息与来源相互穿插，不能将产物藏进工具payload或以短简单回复替代。

root通过真实页面打开唯一研究员，在内容继续增长时上翻读Sources、展开剩余来源、查看多阶段截图并关闭重开；截图必须人工查看，只有观察帧有资格。可订阅真实Task事件记录Source与text时间和规范存储对照；它只证明数据链路，不是UI自动化或逐帧结论。禁止UI自动化测试、DOM断言、像素断言、浏览器fixture、注入状态或临时替换renderer。

若复现问题，先追加触发、根因、所有调用/契约/测试/交付影响和风险，再修改唯一实现并重新真实验收；无问题不制造补丁。结束后Task/Provider终态、原CLI与事件观察器handle、Native/Host物理/output/request、页面、18299与复制配对必须分别收敛，归档完整脱敏事实。同步根/月/目录索引、docs检查，范围提交、fetch/merge、待推送集合核对并正常push。总体goal保持active。

## 本轮结果与 Recall 更新

真实 Task 234259ms 完成，12 次实际 Sol 流式请求均结束；研究员 499/2054/2381/2910 字符四段正文与真实事件/规范存储核对。root 进入子会话时最后一段已接近完成，实际展开来源时正文已结束，因此本轮没有完成“展开来源时后文持续增长”的时段验收。不能把 Task 仍 Running 当成研究员仍在生成，不能用后台事件替代缺失的 UI 观察。

已实际观察文件 2/3/4 行紧凑来源、展开、打开并高亮第 4 行、返回和关闭重开后的展开与读位、MDN 标题/中文章节及真实目标跳转、长查询中文显示。11 张截图逐张人工复核，观察帧没有重复 Rendering；没有新确认缺陷、没有生产代码改动。完整[证据与边界](child-render-328/README.md)。

自有页面 105/106 已关闭，观察器 77602 和原启动器 30796 actual exit0，Native/Host/端口/输出/请求与复制 auth/models 成对清理。后端核对脚本误读 dispatch 字段后按实际协议修正并原验收重跑通过；不影响生产代码。文档检查后范围提交并正常 push，goal active。下一轮提前进入真实子会话再观察，禁止把当前未覆盖时段写成通过。
