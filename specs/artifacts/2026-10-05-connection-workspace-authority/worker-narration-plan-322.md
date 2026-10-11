# 322 已结算执行轮次的可见正文读取

## Recall

用户持续要求自主修复功能与Sources/Rendering问题，最新约束单agent开发。321已推送9d244cb0f50b86bb84db98dbcee7cf5a5d93291b，开始git status干净；前轮为progress：真实Task、失败读取、重复生成和页面证据已落盘。本轮修复该实际缺口，goal保持active，不执行旧目标的多个Astra开发agent措辞。

321的同一Researcher首轮有相同parentID的三个assistant Message：420字开场、2988字第1–6节、3507字第7–12节。read_agent_message仅投影selected final正文，causal inventory只含Tool Parts，evidence_reads仅有input/output/failure。负责人因此无法读取早段正文，最终要求同一执行者再输出7097字符；这有实际输入/错误/工具结果及实现证据，不以模型自述为根因。

已读完整read-agent-message、worker-final-authority、Panel failed-Task调用点、真实321记录、当前04-extensions/task-control-plane/07-panel、worker终态及引用测试、证据预算测试、其他六处代码/测试调用与历史记录。全仓搜索readAgentMessages、现有两个causal_tool输出字段和TestHooks；消费者为同一共享reader、Panel代理、聚焦后端测试及实际检查脚本，没有第二个正文事实源。历史110/273属于显示与身份修复，不解决正文读取能力。相关路径无UI自动化测试，UI不新增测试。

## 权限与影响分析

终态校验本身正确：来源必须由本Task真实物理终态事件指向final，并通过Project/Session/dispatch/descriptor/accepted input与agent身份验证。较早消息不能直接冒充dispatch_result。现有worker因果范围使用同Session、同parentID和不晚于final的持久化顺序；continuation的新输入拥有不同parentID。dispatch_origin只包含派发Provider step之前已经完成的根Tool事实，其时间边界不扩大为根正文。

该缺口横向影响所有Task负责人和worker审阅者读取分段可见交付；SDK（Software Development Kit，软件开发工具包）与通用Tool入口、失败Task的Panel代理共享同一实现。321续轮是负责人明确dispatch的结果，不是重复调度、重启恢复或终态收敛异常。本轮不改变调度器、Task/Mission/Session生命周期、模型流程或工作流策略。原来只改显示/提示或要求所有内容重写到final不能解决真实数据不可读的问题。

## 唯一实现方案

将现有因果Tool目录扩展为一个统一Part目录，收录Tool和该已结算worker自身的可见text；reasoning与其他Part不进入。正文必须与selected final拥有同agent，compaction等其他actor的文本不借此成为该worker的正文。既有最终report messages结构与显式选中报告引用保持，不把早段文字拼进final或合成新Message。

顶层输出替换为causal_part_reference_index（part_count）和causal_part_message_inventory（part_facts），每个事实含part_type；移除旧causal_tool目录字段和旧名字，不留别名/双源。每个source仍16 Parts一页，紧凑索引仍40000字符上限，沿原Message/Part游标分页。Tool字段保留原元数据；text记录实际Part身份、受同一Provider秘密脱敏的短预览、字符数与截断标志。文本身份和引用顺序来自真实MessageStore，不从自然语言猜取。

evidence_reads增加field=text，复用同一个精确因果Part映射和evidenceOutputChunk；offset/limit、默认8000、单次aggregate30000字符、最多8项与next_offset不变。完整text通过原规范Part读取并脱敏，不能复制到独立缓存或借文件后备路径获取。来源description明确：早段Message ID用于evidence_reads，sources仍使用已结算final来源。错误保持明确的来源/字段契约。

公开调用和测试同步到统一字段；不为了旧断言保留旧目录。现有两个以success=false为独立断言的相关用例改为直接验证具体错误形状。API（Application Programming Interface，应用程序接口）没有新路由或存储迁移；若当前SDK/文档生成检查要求更新则同步生成。风险主要为新目录分页把text计入16项，调用方必须沿返回游标而非假定每页16个Tool；所有相关消费者一并核对。

## 验收

先加入真实后端存储/物理终态事实的正向用例，验证同输入早段正文（含分页chunk）和最终正文、另一次输入/其他actor/推理Part的明确目录投影、pending/no_final来源错误、正常/协调交接/错误/中止终态。保留跨Task/Project、根dispatch_origin边界、Tool输入输出、分块、分页与预算检查。先跑失败，再实现。mock或fixture只证明局部契约，实际模型验收独立完成。

使用fresh正常开发/ui18292、当前前端320构建及新后端。授权auth+完整models配对，预检usable/projected/实际gpt-6.1-sol流式，累计20请求、Task openedAt起900000ms、180秒活动观察及独立Native边界。复用321的分段分析请求和输入内容，通过真实Task入口只安排产品内同一名只读Researcher；本开发工作不委托。检验负责人是否通过真实text chunks取得前段正文后收尾，检查实际dispatch/lifecycle/请求而非自述，不能把减少字数等更容易场景当通过。

同时补321未完成的实际子侧栏操作：进入后立即用真实summary控件展开文件Sources并停留，在后续正文持续生成时截图人工观察；再查看网页来源、终态与重开。没有UI自动化、DOM断言、截图比较或注入事件。全部原执行器actual join、Task/Provider终态、页面及精确Native/Host/端口/配对清理后归档脱敏证据。根/月/目录及当前架构同步，聚焦测试/类型/文档检查，范围提交、fetch/merge、完整待推送集合检查和正常push；未达成项如实保留，goal active。

## 首轮检查反馈
34 pass/2 fail：新增早段正文、四种物理终态、其他轮次错误和串并行派发用例通过。现存 selected-dispatch-report-quotes 与 panel-failed-task-dispatch-evidence 的 fixture 只记录 dispatch settlement，没有 WorkerTurnDescriptor/accepted input 与 agent.execution.lifecycle，不能满足现有共享 reader 权限合同；前者返回 undefined，后者先触发默认5秒 test timeout。修复这两处后端夹具以建立真实数据层终态，不放宽生产权限；两处重复已证实，提取唯一 fixture helper。聚焦原验收显式30秒测试预算，并保留原失败日志。这里未发现实际运行调度异常。

## 完成后的Recall

实现和[真实验收证据](worker-narration-322/README.md)已完成。36聚焦后端测试/597断言通过，类型、文档和架构索引检查通过。失败夹具修正过程包含错误地事后补已冻结user控制Part、旧assistant Session种类和一次相对路径工作目录失误；它们均已修复并重跑原验收，日志保留。初始before-narration两次夹具搭建错误不算产品红测，before-narration-ready才是正确终态下无法读正文的红测。

真实Task一次派发，487/3037字符早段正文由新field=text精确读取，10次真实GPT-6.1 Sol流式请求正常结束；从321的重复请求收敛为当前完整读取后完成。UI通过真实Sources展开后继续生成的人工截图、文件准确第4行及返回展开状态核验。未通过首次点击保留，未宣称全帧零闪烁。本轮没有UI代码修改，未部署或发布版本；旧来源目录已唯一替换，没有fallback/旧字段兼容路径。

全部原始运行与检查handle已join，页面/Native/Host/端口/复制权限配对完成清理。后续只完成范围提交、正常fetch/merge/push与远端核对；持续goal保持active，下一批从新的可验证问题开始，不重复本轮已过验收。
