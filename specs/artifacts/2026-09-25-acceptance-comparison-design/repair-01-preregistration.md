# Repair 01：固定既有错误业务状态的一次诊断

## Recall与测量问题

依据[固定状态设计](fixed-state-repair-design.md)及[主记录G18](../../records/2026-09/2026-09-25-supervision-causal-iteration.md)，
本次只问：原生Mission/Task链能否从一个自然产生且归属明确的错误记录出发，读到足够
来源，改变判断并实际修正，再验证和结算，同时保持已经满足的业务义务。

这是operator派生开发输入，**不是原官方create案例、H-E第三臂、原verifier同输入对照
或进化收益评估**。当前请求公开要求返工，已有记录与来源均在初态；任务信息和权限
范围与原创建请求不同。保持executor→verifier原工作流；executor第一次就修好，属于
修复交付，监督触发内部返工仍未知。不可为制造后者补跑。

本文件、准备脚本和运行入口在首个模型请求前提交。真正冻结源SHA以
`.tmp/supervision-causal-20260925/repair-01/freeze.json`为准；控制器核对它、数据身份和
真实预检后才能创建业务Mission。此文档本身不等于已启动或已通过。

## 固定输入与作者

[prepare-repair-input.py](prepare-repair-input.py)只读B1原eval，核对单sample身份、原
snapshot/input/全部27事件与已存链完全相等，并检查原eval在读取前后字节身份一致。
该脚本只复制材料，没有构造活动世界、API调用或评分；只允许新建准备目录，重复执行
应作为占用错误处理，不能覆盖旧输入。

| 项目 | 本轮固定值 |
| --- | --- |
| 原运行 | `he-01/B1`，原source `fe233643`，原包`.13`，旧分不变 |
| 原eval | `he-01/B1/eval/2026-09-25T11-15-25-00-00_opencorvus-automationbench_4k3Y4JaPifCJbzXzisk2g8.eval` |
| 原eval字节身份 | `373c00b3732e478dc02d7bdfb57a48c296df10903e8d0c5130b5d8462cb789c9` |
| 准备目录 | `.tmp/supervision-causal-20260925/repair-01-preparation/` |
| 输入 | `fixture.json`，231,703 bytes，`af809c323ab14ac90b6df4193825bc65d5cae3697eb434ed8b4d727989ebe869` |
| 新身份 | `kind=operator-derived-business-repair`，`id=repair-01-existing-opportunity`，作者operator |
| 状态内容 | 原world全部48服务字段/全部记录/噪声，原Sheets跟踪空列表；没有原assertions、scores或participant历史 |
| 实际连接权限 | 原`gmail/google_drive/google_sheets/salesforce`四项，直接恢复，不重新从48字段推定 |
| 业务时钟 | 原`2026-09-25T11:15:25.718221Z`，公开request显示同一时刻 |
| 既有错误对象 | 原Opportunity `286317e840bd486090`，20,000/On Hold，原580字节description含旧错误解释；完整保留 |
| 公开请求 | G16返工正文；保留原SYSTEM文字作为公开任务约束，明确当前返工替换旧create动作；完整1844字节在`request.txt` |

以上完整world和本文件只留在环境/评估侧，Task仅收到公开request，并通过原API读取
业务资料。旧record ID是新模拟世界里的业务关联键，旧Task/Message/Tool/Artifact ID
没有在新Host中的生产者权限。原record中的来源ID/解释保持真实历史文本，不额外在
请求或工具描述提供它们，也不删除这些曝光来伪称独立/盲审。

真实`load_development_fixture`已验证完整state序列化；构造真实Inspect Task时取得
正确sample/request、Mission配置和`scorer=None`。这是入口构造检查，不是已经运行
模型或活动MCP会话。`source-receipt.json`及`entry-construction.json`保留具体结果。

## 系统、包和运行边界

| 项目 | 冻结要求 |
| --- | --- |
| 次数 | 一个新Mission/独立世界，仅一次，无替补、无第二臂/作者/Campaign |
| 包 | 真实不可变`2026.09.25.14`，digest `b4c645f4a90c002e83842c46d56afbb1563ee24f7a9cb215f2488a1d9d379f93` |
| 包材料化 | 新准备目录的package-runtime；原loader读取H-E不可变`.14`后reload，全部六文件相等，原双worker权限/流程保持；`package-freeze.json` |
| Source | 提交后写入freeze的准确Git SHA；两次阶段核对HEAD/冻结路径，运行中不改源码或spec |
| Inspect入口 | `opencorvus_inspect/opencorvus_business_repair`，原Mission solver，outer model none，单sample/单epoch，max-samples1 |
| 模型 | 所有内部角色、压缩和预检只用流式`openai/gpt-5.6-luna` |
| 时间策略 | 原真实无活动300秒/poll2，无新增请求数或总时长预算；业务clock和wall-time分开 |
| 目录 | `.tmp/supervision-causal-20260925/repair-01/episode`；原host helper只创建新目录 |
| 控制器 | [run-repair-01.py](run-repair-01.py)，独占创建controller.json；五分钟只读快照 |
| 凭据 | 原授权的成对auth/models；只读前置核对两者存在、OAuth当时未过期、目录含Luna。每个新Host仍需真实usable/projected/exact model/streaming预检；不刷新副本 |
| 输入观察 | 沿G11原六探针，同一只读配置及redactor；只存位置/角色/输入身份，不加到模型输入，不新增探针 |
| 结果 | 原`.eval`、当前API events/state、原生Mission/Task结果、Provider审计和用量；官方strict/partial固定null，开发业务结论待外侧复核 |

注册入口只组成原loader/setup/solver，不调用Provider，也不自行评分或规定模型工具
步骤。原纯配置校验迁到`sample_settings`，官方入口共用唯一实现。控制器沿原
launch_host/精确预检/公开本轮cleanup/stop_host；不复用官方`score_summary`，因为它
绑定原case身份和官方评分。运行结束的`finished`只表示观测/收尾完成，不表示业务成功。

完整检查还需验证实际运行里的Task package_revision_binding与冻结`.14`相符；入口
构造时的manifest版本不是该实际绑定。端口由真实host收据绑定，准备时的loopback
端口1仅作无网络配置校验，不能拿它当已启动Host。

## 预先固定的外侧验收

不使用原官方create rubric。以下是本次请求的评估义务，不投影给模型，不参与Host
工具授权或路由。保留逐项满足/违反/未知及原引用；没有新自动judge模型。

| 义务 | 评估侧预期/证据 | 不能替代它的现象 |
| --- | --- | --- |
| 原对象修正 | 同一Opportunity的真实更新请求、实际API返回、后续同对象GET及最终state | 新建一个正确对象却留下原错误对象，或只发布正确报告 |
| 适用来源关系 | 实际读到正确账户Gold/4个所属Contacts、价表base40000/Gold10%、更新每Contact5000及renewal条件/health policy | 字段存在、来源列表、原错误description或producer自称 |
| 正确业务金额 | 上述原来源支持(40000+4×5000)×90%=54000；原对应record最终字段相符 | API返回`{}`、HTTP200、方法Artifact发布成功 |
| 已满足义务 | 原ID/名称/Account/On Hold成立，目标机会集合及无关记录/来源保持 | 单独金额正确 |
| 解释更正 | 当前description中的计算与实际来源及结果一致，旧错误说明在初态/事件归档保留 | 只改数字却继续将旧错误公式声明为当前依据 |
| 未指定字段 | 全量列出变化；CloseDate/owner/probability/lead_source等原请求未指定字段按证据与理由审定 | 添隐藏固定值，或未经审查把任何变化都当允许 |
| 真正监督返工 | 错误仍在时verifier给具体反证→scheduler真实continuation→原executor更新→再次独立复核 | executor首次就修好，或只是更多报告/角色 |
| 真实裁决 | 原Task/Mission决定和最终业务证据一致；所有差异/未知保留 | completed/accepted本身 |

上游更新自动产生last_modified_date，按API来源记录为执行元数据，不伪造为业务clock，
也不要求与原值相等。其它更改不得以这一例外一概放过。定价邮件标题/正文年份边界
沿G16保持原字节；若出现新的适用性争议，单列原文和解释，不拿隐藏rubric消除争议。

## 竞争解释与停止

| 观察 | 本次允许的结论/后续 |
| --- | --- |
| 入口/模型/包/初态不符或runtime错误 | 测量边界失败，业务结论null；先保存收据并公共收尾，不补样本 |
| 原来源未被读取或空查询被当不存在 | 来源发现/判断边界仍有问题；定位真实API证据，不把环境中有资料算模型看过 |
| 读齐来源仍保留错误关系/误accept | 表示/判断问题仍未解决；不以新方法引用/终态通过掩饰 |
| 发现正确差异却未真实修改 | 判断→行动边界；不能只改verifier同义提示 |
| 首次executor修正且复核/保持义务成立 | 仅支持这一次固定旧错误的修复交付，监督返工未被检验 |
| 监督触发同Task修复并再验/裁决成立 | 支持这一次纠错链，不支持总体可靠性或进化收益 |

任何结果保留原输入/输出/所有成本，不补跑择优。方法或金额正确但其它成功义务损坏，
不得整体判成功。不能用本次开发分数与B1/T1官方分相减，也不自动晋升`.14`父代。

## 收尾与报告

原公共cleanup只处理这个episode路径下所属Mission/Task，核对零活动；随后原stop_host
正常停止并核对实际进程退出、成对复制件删除。若收尾未达成，控制器记runtime boundary，
人工核对精确进程身份后处理本轮残留，不按旧PID批量停止或重启。

完整报告使用Markdown表格：上述业务义务、原生终态/外侧结论矩阵、全部请求/usage缺项/
input-output-reasoning-cache tokens、业务/全Tool、时长。预检/压缩成本都计入；本地
cost_usd0不是免费。单次观察不能提供有效随机因果量，未满足部分必须明确保留。
