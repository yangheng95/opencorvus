# 第23批：Work体验搜索与归档恢复

对应[Recall、完整实施前分析、失败和最终资格](../../records/2026-10/2026-10-14-archive-experience-search.md)。Root独立实施并亲看22个未编辑原PNG；没有UI自动化、真实凭据或模型请求。

- [screenshots](screenshots/README.md)：01–03修前六项/Work0/Mission2；04–09只改后台时Archive与真实恢复；10/11旧前端活动查询二次过滤的失败，不能冒充通过；12–16最终新UI六项、Work2→1、Mission2→1中文；17真实活动Work匹配和Ctrl+1；18实际打开原Work；19原Mission带hover tooltip、20移开悬浮后完整原请求；21/22最终英文Archive和活动Work查询。22中原本地命令同时存在，18/20保留原体验、身份和草稿内容。
- [runs](runs/README.md)：before失败准备PID35112；before02正确基线PID73816；after后台修复/旧UI诊断PID89284；after02最终新UI PID51424。端口分别18662/63与18664/65。各成功6项由公开API创建/命名/归档，Mission始终真实draft，未派发。最终3次Work读取与最新6次完整读取证明原active/archive身份、experience、Mission原request/backlog/零Task统计；打开和切语言后再读回0。保留可逐条对照的HTTP回执81条，其中一个是正向的预期400输入错误合同；重复both读取仅最后6个body保留，不累计成更多独立原body。UI请求与首次失败请求另计。
- [checks](checks/README.md)：原红4通过/1失败，最终5通过/24断言；扩展core+test类型、overlay类型、Node build54.82s、docs345/26、架构19与所有正式读取/收尾/隐私0。准备器原exit1、诊断Node原3221226505、首编译器原2及归档器错误假定非零都为1的重现保留；不把外层统一非零显示当子进程退出码。原400来自非法surface；错误单条GET返回文本404并伴Node25断言，未知原body不重建。修后正确准备/输入probe与类型均重跑0。
- [inputs](inputs/README.md)：修前源、初次误捕probe与正确不可变baseline，唯一正式数据/readback checker与独立服务生命周期。后台仅一条experience条件；前端接受服务器顶层结果并保留原Mission展开相关性，本地动作沿原text filter；无新查询、缓存、写入协议或迁移。
- [previous-delivery](previous-delivery/README.md)：B22产品9fc9fb7bb及文档0ee22c4d6正常提交/精确结算，Root normal push0、全部原hook与fresh upstream确认；原失败保持。

所有自有tab25/26/27均关闭。四轮正常settlement/父exit0、双端口0后精确删除各自假auth/models整对；后台完整日志56049/109854/144875/198163字节，stdout/stderr各0，隐私checker全0。四轮participant inferenceRequests与realSolCalls均0，UI/API请求另计。只资格真实桌面中英Work/Mission查询/恢复/重新打开及当前Ctrl+1；未独立操作Mission子Task执行、真实模型、调度或永久删除。详见[原捕获清单](manifest.json)。范围提交与正常push按后续实际回执结算。
