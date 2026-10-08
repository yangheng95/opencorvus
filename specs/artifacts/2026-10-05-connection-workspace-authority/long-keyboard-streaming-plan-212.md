# 212 长转录与流式的 Ctrl Home/End

## Recall

用户授权复制OpenAI认证及实际GPT-6.1 Sol端到端测试，持续自主改进Sources/Rendering/功能，最新只用单agent。前一轮6e57d04d已修共享ctrl modifier漏识别，真实Main1938px和child2926px的Home暂停/End恢复及textarea caret通过，原失败保留；当前HEAD/upstream6e57d04d且工作区干净，上一轮为有进展。更长CtrlEnd动画与本次补丁下流式仍未知，不把210旧代码模型资格替代当前键盘资格。

## 调查范围和边界

重读211 Recall/证据、当前dom-utils按键归属/250ms短暂inputIntent（输入意图）/onScroll/rebase逻辑、210唯一成熟NativeService launcher、完整auth/models pair（凭据及模型目录）staging/preflight/reader/native settlement和已用归档工具。shared controller三调用者当前接口不变；本轮先实际Main长内容与增长，遇到问题再按全共享入口/合同/数据流根因调查、落盘实施方案；不假设250ms正确或错误，不盲目加timeout或焦点旁路。

22:31:37.482Z仅只读确认用户源OpenAI OAuth（Open Authorization，开放授权）类型、当前未过期及完整相邻models含gpt-6.1-sol，没有输出credential内容。这仍不是Provider可用资格；新wrapper须在UI发送前分别usable/projected/实际model/streaming验证。既有授权持续有效；不操作用户源auth或用户正在使用的页面/服务。

全新212 Run/Project/port18132，builtin Base、Code/Chat；当前main-ChaFi5sr正常serve `/ui`，不单独启动Vite、不造UI fixture（夹具）或自动化断言。原Host600000ms绝对期限、累计12请求包括preflight均不延长。单个交互Chat、无协作子agent或模型委托，架构的自动记忆模型请求按真实audit分别保留。

## 真实自然场景

直接独立读取WAI介绍页和MDN无障碍入口两份资料，不新浏览链接/规范、不改文件；给面向初次开发者的详细中文入门实践说明约6000字，保持资料依据和边界，分五部分、具体例子与小表格，直接完整正文。目的是正常真实长内容，不注入Source/报告/消息或缩减失败场景。

首回合结束后测量实际card/Source身份与scrollHeight，focus确认属于Main，再CtrlHome立即/稳定到顶followfalse，旧Source/title/host/展开/完整正文人工复核；CtrlEnd从顶部长距离导航立即/稳定到底followtrue，真实截图与对应geometry，不以孤立DOM（Document Object Model，文档对象模型）值替代视觉。若输出实际较短，保留长度与有限结论，不当长场景通过。

同一个Chat追加一条自然约3000字追问，仍只依据已读资料，无新委托/网页/文件。在第二回合真实增长中立即CtrlHome暂停并观察稳定位置，再CtrlEnd恢复，记录同card输出/reader进展及后续真实增长/尾部跟随；预算内及时结束，不为错过窗口重置任务或延长期限。最后原Source/长正文返回即时像素查看，记录完整终态与未覆盖的Side Chat/其他平台/组合/淘汰/错误矩阵。

所有模型请求流式、实际输入/输出/Source/Session/Message可追溯；无UI tests、静态源码/文字断言、DOM渲染或截图基线。自己页面结束关闭，唯一public shutdown/join原父工具/Host/Target/Job/output/request与精确出生身份/端口/pair闭合，原失败/preflight/期限原样保留。日志用成熟CredentialRedactor（敏感内容屏蔽器）在内存屏蔽源凭据后归档，不归档auth/catalog内容；docs/索引/范围提交、fetch/merge上游/完整待推送集合检查/正常push后单agent继续。

## 实际212失败与下一步

第一回合实际7776可见card字符、height5825：生成中CtrlHome最终top0/followfalse且高度4313→5587仍暂停；实际Source焦点长CtrlEnd从top320到top5190/followtrue通过。第二回合CtrlHome也稳定0/false、height6405，原Source焦点后320/false。后续CtrlEnd采样时模型已经Not running，不能称其在流式中重新跟随通过。

**明确新失败**：第二CtrlEnd原height6405/client635，浏览器目标旧maximum≈5770；最后一条虚拟card挂载后height9159，新maximum8524，但稳定top5769.333496/followfalse，距离真实尾部约2755px。截图仍停在第二正文起点。真实到底按钮在同数据/owner下得到top8523.333008/followtrue，完整末尾可读。212原FailedEnd图片/JSON不重判；旧211只是短历史通过，不能覆盖这个重测量窗口。

Native whole自然0，但原父工具29457退出1/OWNED_PROVIDER_REQUEST_INVALID：final audit9请求，其中1个503/http_error、其余8个200/settled EOF，全部请求streamingtrue/actualgpt-6.1-sol。共享activity.ts将HTTP5xx归类server_5xx，Session processor采用同policy，LLM SDK额外retry默认0；原日志22:33:31.353Z在当前Session发布同activity act_g0VXV4QxR00DKf9j5cYH/attempt1/server_5xx/2135.970ms retry，后成功attempt1与两实际最终stop/completed。未见本次调度/恢复/终态异常，Provider错误重试合同实际走通；503早期audit没有reader context，因此不制造缺失归属或宣称每请求EOF。原严格qualifier失败保持，不通过放宽checker换绿。

自己的27关闭，非本轮23未操作。22:41:39.564Z生产Native exited0、physical/output/request完整，原deadline1791499347501内，pair清理已执行，待独立身份观察归档。下一步单独213分析并修End显式跟随意图：用户请求最新内容应在现有caller信号上先恢复follow，再由当前既有测量/rAF到真实尾部，不能依赖旧estimated geometry及250ms普通输入记忆。嵌套Tool/excerpt滚动区域应保留本地End动作，不可全局抢滚动；三当前消费者/公共callback/合同必须同步更新。没有在212中抢改生产源或改原事实。
