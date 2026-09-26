# H-B 01：目标提前曝光，读取顺序干预未执行，错误状态仍被接受

## Recall与结论

按[H-B预登记](hb-01-preregistration.md)只执行一次新诊断，沿用原错误业务状态、
公开请求和[Repair01逐项义务](repair-01-preregistration.md)。新包只调整前置节点的
读取顺序：从前提来源形成并发布方法后，再读目标机会的当前金额与说明。

**业务修复未达成，且本次没有实现所登记的未曝光条件。** 前置 verifier 主动发起
跨 Account、Opportunity、Case、Task 的搜索，原返回已经含目标 20,000 和完整错误
说明；方法在此后发布，仍把 `4 × 5,000 = 20,000` 当总价。它如实记录提前曝光，
但记录曝光不能消除已经发生的输入。随后 executor 和最终 verifier 都接受同一错误
关系，没有业务写入，原 Task completed、Mission accepted。

完整最终 state 与初态逐值相等。本次既不能否定“未见旧值时可能选对方法”的假设，
也不能证明锚定导致错误；只能判定此读取顺序干预在真实行为中没有落实、业务目标未完成。
按登记停止这一具体运行路径，不补样本、改提示重抽或晋升包。

## 身份、原件与收尾

| 项目 | 原始事实 |
| --- | --- |
| 冻结源码 | `b9e1743fb7b118b55459b783d1ae1ecf3ead406e`，启动前与 upstream 相同且工作区干净，运行期间源码/spec未改 |
| 隔离包 | `2026.09.26.1` / `0a13f0021ee42d57a23d6c9052220966c61aaf7cae1bc0df99e06a574b2fdf62`，真实 Task binding 相符；默认 AutomationBench `.14`保持，无安装推广 |
| 输入 | fixture 231703 bytes / `af809c323ab14ac90b6df4193825bc65d5cae3697eb434ed8b4d727989ebe869`；公开请求1844 bytes / `8043c272d1996fc3007f5b77337a420c597aa14a27b96de733c10d3f250d6eab` |
| 真实身份 | Project `prj_h188qonuH3mchizaF2KV`；Task `tsk_g00VWLEvvX000Oj49XAR`；Mission `3c9c6f83e78ff535` |
| Controller | 2026-09-26 15:42:15.352–15:54:20.627 UTC；finished，cleanup `active_after_cleanup=[]` |
| 外层结果 | Inspect log success、development closed，官方 strict/partial 均为 null；这些不是业务通过 |
| 退出核对 | 15:56:06 UTC 公共清理已零活动，Host stopped，精确命令行扫描本轮 controller/Host/Inspect 全部退出，episode 内 auth/models 两份复制件实际不存在 |

以下相对路径均以仓库根为起点。本轮目录为
`.tmp/supervision-causal-20260926/hb-01/`，唯一原 eval 位于
`episode/eval/2026-09-26T15-42-35-00-00_opencorvus-business-repair_hyxRpRK2eJFQcazuCGaBPS.eval`。
原 eval 字节身份为 `6cef6b7b088270230fdc7a949a155dd88dc5ec20039acdc25346047e2cac423b`，
只用来固定原件，不能替代业务验收。原 eval/DB/fixture/world/Tool/评分均只读，未重放或重算。

`audit/closure.json`保存实际清理；数据库连接使用`mode=ro`与`PRAGMA query_only=1`。
`audit/final-chain.json`保留原 sample、API事件、请求、Tool结果、真实执行结果、消息、
Artifact、usage；`business-review.json`为成本与状态差异汇总，`artifact-reads.json`
为完整读取回执，`assessment-check.json`逐项核对原时序、全部state、身份和成本数。

## 真实链条（下表均为2026-09-26 UTC）

| 时间 | 原始动作与证据 | 判断边界 |
| --- | --- | --- |
| 15:43:52.588 | scheduler `dispatch_agent` 请求 `prt_g0VWLF0EG00NltBZPnOW`，initial 节点 `automationbench-expectation`；真实指令明确“先发布方法、再读目标值或说明”，若意外遇到则记录曝光 | 阶段确实进入真实派单，不只是包配置 |
| 15:44:34.339–34.864 | 前置 verifier `prt_g0VWLFB5f00M3UGdjxXO`、原API事件3：SOSL（Salesforce Object Search Language）`FIND {Summit Industries} IN ALL FIELDS RETURNING Account, Opportunity, Case, Task`，返回 Account 与目标 Opportunity 的 Amount20000、完整580字节错误Description | 目标曝光发生在方法发布前；它主动选择包含Opportunity的查询，“incidental”是其自述，不能改写请求 |
| 15:45:03.958–04.386 | `prt_g0VWLFInO005SuieOAp2`、事件9完整读定价邮件，含 `Base prices remain unchanged.`；此前已读 Gold、4 Contacts、renewal与open Case | 来源通知的前提线索已读，不等于基础价/折扣已读 |
| 15:45:50.271 | 方法 `art_hX8xSOJQI3YIoj11wt4X` 发布，原请求 `prt_g0VWLFOdv00IrzPo8Gas` 成功。方法把4×5000当总价；明确记录初始SOSL曝光Amount/Description | 方法先于新executor成立；先于目标曝光不成立 |
| 15:45:59.768–15:46:03.984 | 事件13才按确切Opportunity ID读取，`prt_g0VWLFXJY00ghFGtjTwK` | 只看这个GET会误判顺序已满足，必须纳入更早的搜索返回 |
| 15:46:38.052 | scheduler完整读5966字节方法，`prt_g0VWLFh4200scOwqvA0k`；15:46:50.597首次派executor，`prt_g0VWLFkXN00pN02ISMP6` | scheduler已知提前曝光，也把方法20,000及其来源列表传给executor作为待核主张 |
| 15:48:30.265–53.582 | executor完整读同一方法，`prt_g0VWLGACV00pkayyRrDY`；发布`art_hZnYflvmiNeiR0oqhVqO`，认现值与说明正确，不需修改 | 它自行重读账户、联系人、邮件、Case和机会，但仍未读Drive/Sheets |
| 15:49:29.358 | scheduler派最终verifier，`prt_g0VWLGPq2004jAg9b0PM`，initial节点`automationbench-verifier` | 指令同时要求独立核验和“no missing plausible source read”，却已列出预期20,000及七项读取；实际验收关系继续沿用上游所选子集 |
| 15:50:27.553–15:51:34.193 | 最终verifier完整读方法与executor产物，`prt_g0VWLGeeM00cXcCb4f5p`；发布comparison `art_hKIgExSkOzJRajEloFWl`，价格/说明/来源覆盖均判satisfied | comparison真实引用方法和executor，原交接机制可执行；错误关系未改判 |
| 15:52:28.728 | `manage_task.complete_task`，`prt_g0VWLH7d400AX68Bj8OJ`成功，持久化decision `art_g0VWLHA1W00pbvEX8U2x` | Task把错误金额及no-op解释作为已交付 |
| 15:54:06.399 | `panel_complete_mission`第二次请求 `prt_g0VWLHZ4o00K3lt7MBBC`成功，Mission决定Message `msg_g0VWLHXlL00zKMslfDs0` | 第一次read-ref拼写错误已真实失败；纠正引用后接受，不能把协议纠错算价格纠错 |

三个成功initial节点依次为原verifier→executor→最终verifier；三个真实worker Session
分别为`ses_hW5SntlsfWKoMwGUhZYj`、`ses_hGLYGa107p662aoZnOwC`、
`ses_hm0LyRBMew9u6PNExpPY`。本次只有这三个派单，没有continuation或Mission resume。
前置方法进入Task最终decision的deliverable和evidence集合，没有隐藏早期错误方法。

## 外侧义务与裁决矩阵

| 层/义务 | 原始证据结论 | 与原生裁决关系 |
| --- | --- | --- |
| 登记读取顺序 | **未实现**。事件3的完整目标曝光早于方法，原Artifact也记录曝光 | 后续exact GET晚于方法不消除此前曝光 |
| 来源发现与关系 | Gold/4 contacts/5000及“base不变”邮件已读；实际API链没有Drive/Sheets读取。环境仍有base40000与Gold10% | 七项已选读取被当作覆盖完整，不能由“已列出的都读了”推出来源齐备 |
| 方法 | 仍为4×5000=20000，未纳入基础价和等级折扣 | scheduler、executor、最终verifier均沿用 |
| 同一对象金额 | 原Opportunity `286317e840bd486090`仍20000；登记外侧关系54000未达成 | Task/Mission却接受 |
| 说明更正 | 原580字节错误Description逐字保持 | 最终verifier称说明仅含supported事实 |
| 身份/已满足字段 | ID、名称、Account、On Hold及其它字段保持 | 外侧完整state证实保持，不把未修错误当破坏无关字段 |
| 无关记录/来源/时钟 | 全部49个world键（meta+48服务字段）、原4连接权限、clock及Sheets写跟踪与初态完全相等 | 连last_modified_date也未变；不是H-T01的同值PATCH |
| 行动 | 29业务事件=6 api_search+23 GET；没有业务写入；另3 api_catalog是文档，不计业务事件 | “无须修改”判断错误，no-op不是请求已完成 |
| 健康政策/年份 | policy明确写when creating new opportunities；最终报告保留既有机会适用范围。邮件subject FY2026/body Q4 2025及renewal2025-11-20沿原值 | 歧义单列，不添隐藏阶段或日期验收项，也不重判历史官方分 |
| 监督与进化 | 真实方法引用、独立角色与结算发生；业务反证未改变关系，没有实质修正 | 可靠纠错与进化收益仍未达成，不晋升包 |

前置、executor和最终verifier分别在事件9、21、26读到含base保留原句的完整邮件。
G11既有片段探针在34个verifier请求的`/instructions`匹配组成项规则，16个带verifier
标题的请求同时匹配Tool output里的base原句；全角色该原句共匹配40个请求。这仅是
片段出站证据，不是完整wire或理解保证。未读价格表由完整29事件核对，不能用探针缺项推断。

## 所有费用与错误

| 指标 | 本次H-B实际值 |
| --- | ---: |
| 请求 / HTTP200 / usage记录 | 88 / 88 / 88 |
| 请求与usage数量差 | 0 |
| 模型 / 流式 | 全部gpt-5.6-luna / true |
| input tokens | 514832 |
| output tokens | 18721 |
| reasoning tokens | 2677 |
| cache-read / cache-write tokens | 2630400 / 0 |
| total tokens | 3166630 |
| 全Tool请求 / completed / failed | 79 / 77 / 2 |
| 业务事件 / api_catalog文档调用 | 29 / 3 |
| sample / controller 秒 | 702.841 / 725.274 |
| provider_activity_request行数 | 85 |

88条usage的本地billing_status均为priced、cost_usd合计0；不能据此宣称免费或已经核对
外部账单。85行activity不是88次全部模型请求的替代计数。费用含预检、Mission、scheduler、
两次verifier、executor及memory：verifier34条/866274tokens，executor16/377838，
orchestrator18/1112862，mission16/777642，chat1/28529，memory3/3485。
历史H-T01为113请求/4556846tokens，Repair01与其零业务启动失败合计118/4896500；
这些仅各自保留，不能按本次较少tokens宣称干预节省或拼成效果比较。

两项真实Tool失败均保留：`read_task_message`误把ingress Artifact ID当Message ID，
以及第一次Mission complete中的read-ref拼写错误。二者随后由真实参与者继续处理；
最后者发生在错误方法与Task接受之后，不能解释之前的定价错误。事件2另有原业务API
`MALFORMED_QUERY`返回：Agent把SOSL送到SOQL（Salesforce Object Query Language）
query入口，随后改用search。该错误JSON位于completed的Tool返回中，不能混入两项
宿主Tool失败或删掉这次真实请求。

外侧提取器也记录了两项自身问题：最初误从通用part表查Tool结果，空计数随后按唯一
`tool_part_outcome`及`permission_execution_result`修正；初次请求/事件参数比对因MCP
把params/body序列化成JSON字符串而失败，解码这两个运输字段后29项逐一相符，原两份
参数都保留。没有修改原运行或将派生工具的错误归给Agent。

## 下一步边界

H-B以本次真实轨迹结算。不能通过隐藏目标、过滤搜索结果、增加同义警告或再次抽样
制造“未曝光”成功；当前证据也不足以在锚定、来源选择、指令执行与关系判断之间分配因果贡献。
Cycle3读齐仍错的反例继续成立，不能把所有问题归于缺价格表或目录噪声。

业务关系仍需Agent独立判断。后续回到已确定的共同机制问题：Review完整证据发现、
显式取代及比较事实传递；先核对原始语义和合法改判，再实施单一事实来源，而不是把
H-B失败包装为已解决，或为了保持运行而再开业务世界。H-B包不晋升，旧样本不重算。
