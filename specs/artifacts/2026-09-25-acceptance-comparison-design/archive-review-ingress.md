# 固定归档输入：数据成立，原生执行入口尚不成立

## Recall与范围

[H-E结果](he-01-results.md)的两版verifier面对不同executor结果，不能识别纠错收益。
本轮按用户授权只审查同一起点的真实归属与可执行性，不启动模型、世界、作者、候选或
Campaign，不改变旧Task、原评分、Tool结果、源码权限或`.13/.14`包。
源版本为`a550f822db182a36b010a588aa2dc49acaef4d17`，主记录为G15。

结论分为两层：**可以合法固定同一份中性历史材料；不能据此直接运行未改权限的
AutomationBench verifier。** 当前检查否定的是“只上传归档就足够”的具体方案，
不证明所有同起点设计都不可能，也不要求放宽现有归属或能力校验。

## 已生成的具体材料

[archive-review-input.json](archive-review-input.json)为81,724字节，operator整理，包含：

| 字段 | 精确来源 | 当前意义 |
| --- | --- | --- |
| `recorded_operator_request` | B1原Inspect sample input | 引用的历史义务/约束，不是重新执行旧业务的当前指令 |
| `recorded_api_events` | B1原27条官方事件，sequence 1–27完整连续 | 当时真实请求及返回的归档值；不筛选有利材料，不当新Tool调用 |
| `recorded_verifier_claim` | `art_hhq98XNCPfLqTy4xdxng`原作者、类型与payload | 待审的历史验收主张；不是当前Host认可的事实 |
| `provenance` | operator的复制说明与原Task/Mission归档坐标 | 整理者与原参与者区别明确；原ID不能充当新read-ref |

提取源是`.tmp/supervision-causal-20260925/he-01/audit/B1-final-chain.json`；它按原eval与
SQLite只读产生，原本体保留。原input、全部events和原claim分别以完整值相等核对。
包内没有整份world、评分/assertions、其它arm/Cycle内容或operator计算答案。
这不是通过删除原输出中的不利段落“净化”证据：27项原事件完整复制，声明只限制选入的
来源类别。复制JSON值不冒充原数据库序列化字节或新Host签发的生产者身份。

**固定内容不等于补齐知识。** B1没有读到基础价/折扣；该材料至多用于判断原主张是否有
足够依据、哪些前提仍未知。不能要求模型从这里计算54,000，也不能偷偷加入T1价表或
operator发现的source ID来让它答对。若需要验证完整数值修正或来源发现，就是另一项
环境和信息范围设计，必须单独说明。

## 生产入口与权限审计

| 路线 | 实际定义/调用 | 已证边界 |
| --- | --- | --- |
| 新Task的中性输入 | `engine/model.ts::UserUploadInput`、`task-api/index.ts::materializeApiAttachments` | API caller可交bytes/base64或当前project的canonical URL；持久化为`task_input/user-upload`，不根据文件名提升语义 |
| worker看到附件 | `agent/prompt-projection.ts::attachmentPromptSection`、`delegated-worker/context.ts` | 投影filename/MIME/URL的index，未自动把bytes放入模型正文；实际模型完整读取仍未验证 |
| 正式跨Task移交 | `engine/cross-task-artifact-import.ts::requireMissionTaskLineageAuthority`及`resolveCrossTaskArtifactSources` | 当前DB、同Project、同Mission/Session lineage及真实终态/完成decision约束；不能跨已停止runtime复制旧ID充当该权限 |
| 读取旧participant | 原`read_agent_message`与Task Session/dispatch权限 | 归档中出现旧Message/Part ID不会使当前Task获得它；没有伪造新的assistant历史或dispatch settlement |
| `.13/.14`实际worker投影 | `expert-squad/prompt-profile-resolver.ts::resolveWorkerCapability`→`defaultMcpServersForRefs` | 两包均声明`default/mcp/automationbench`；真实配置缺失就拒绝，不用归档JSON替代服务 |

路径相对`packages/opencorvus/src/`。同时读过当前02-data/task-control-plane及原附件、
delegated-worker来源投影、package projection成功合同。未改API或原读路径。

## 实际本地Checker

用新目录`.tmp/supervision-causal-20260925/archive-input-local/`执行原生产函数：

1. 新隔离Project，原`AttachmentStore.write`保存材料，再经原URL解析、完整read及metadata
   reader读回。完整bytes相等，MIME为application/json，长度81,724。
2. 原loader分别读`.13/.14`immutable包，以明确的本地test-driver package binding调用
   `resolveWorkerCapability`，配置中MCP集合为空；不创建Task或伪造其身份。
3. 两者实际返回相同精确错误：
   `Active expert squad projects missing default MCP server default/mcp/automationbench.`
   该结果来自生产resolver，不是手写成功Tool结果或静态字符串搜索。
4. 实际本地DB计数：Project 1、Task/Session/Message/Provider activity/usage均0。
   Instance已dispose，检查进程退出；没有auth/models复制件或新模型费用。

收据`archive-input-local/receipt.json`保存canonical URL和解析结果。内容身份为
`4375156964102c71e4d16a33d5eeb826dfeed8dcd1bfbd891be81801850be215`，只用于本份不可变
输入完整性，不是语义验收分。脚本没有启动HTTP host、MCP或官方world；不把服务层读回
称为完整公共Task ingress、模型看过全文或业务判断通过。

## 当前决定

停止“附件已保存，所以可直接对照原verifier”这一路径。它缺少两项不同的证据：
模型实际如何完整读取中性归档；原声明的真实API能力如何在该试验中合法存在。
不为让检查通过删除包的工具声明、伪装API输出、重启旧world或导入伪Task/Message。
简单改为另一角色或无工具文本问答可以形成不同研究问题，但不能仍声称测了原生
`.13/.14`完整行为或H-E的真实Artifact交接。

这份材料已可人工审查，仍没有可启动的新模型预登记。下一动作必须选择明确的测量目标：
若只检验固定材料下的判断，就公开限定为归档判断并证明其真实输入/工具路径；
若检验业务纠错，就必须另行解决同一业务起点与真实执行权限，不能由只读判断外推。
没有这样的单一可执行设计前，不开更多随机世界、不改提示追分，不把本检查当Host缺陷
继续增加API。整体可靠纠错目标未完成，此局部分支的失败不能包装成进步或总体无解。
