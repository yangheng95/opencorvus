# H-B 01：预期先于目标记录形成的一次业务返工诊断

## Recall与信息增益

用户2026-09-26要求主管直接推进四项未完成目标，其中“可靠业务纠错”要求真实反证改变
独立判断、触发同Task实质修复、再复核正确并保持原已满足义务。已结束的四条轨迹
（Cycle3、H-E B1、Repair01、H-T01）全部在“观察→判断”失真：完整价格关系被
`4×5,000`或`5,000`替代并被后续层沿用。[H-T01](ht-01-results.md)已否定“新executor报告
是错误方法的必要条件”；但它的前置verifier在发布方法前先GET了目标Opportunity，见到
初态的20,000与写着`4 × $5,000 = $20,000`的580字节错误说明。Repair01与Cycle3的
verifier同样先见到目标值。于是“既有目标值/说明的锚定”与“来源选择/解释”一直没有分离。

本次只改变**前置预期节点的读取顺序**：先从确立各前提的业务来源推导并发布方法，
再读取目标记录的当前值与说明。目标记录仍然可见、不删除不隐藏；若节点提前读取，
如实记为暴露。它不补充价格表位置、公式或任何答案。可区分的预测：

- 方法在未见目标值时仍是`4×5,000`或缺base/折扣：锚定不是此次错误的必要条件，
  问题在来源选择或政策解释。
- 方法在未见目标值时推出`(40,000+4×5,000)×90%=54,000`：符合该顺序假设的预测，但
  一个新样本不能识别既有目标值曝光的因果贡献；
  随后观察executor是否据此修改同一记录、最终verifier与Task/Mission是否正确结算——
  这将是首个“独立预期≠现存值→同Task修复→复核”的真实轨迹，但只是一次，不外推。

这不是同义重抽：H-T01没有约束读取顺序，这里的单一改变检验一个记录中明确未分离的
竞争解释。不恢复旧运行，不与旧轨迹拼成率或相减成效应。

## 固定输入（与Repair01/H-T01相同）

| 项目 | 固定来源与边界 |
| --- | --- |
| fixture | `.tmp/supervision-causal-20260925/repair-01-preparation/fixture.json`，231703 bytes，`af809c323ab14ac90b6df4193825bc65d5cae3697eb434ed8b4d727989ebe869` |
| 公开请求 | 同目录`request.txt`，1844 bytes，`8043c272d1996fc3007f5b77337a420c597aa14a27b96de733c10d3f250d6eab`；不含现存金额或公式 |
| 初态/权限/clock | 完整原state、原580字节错误说明、gmail/google_drive/google_sheets/salesforce四服务、`2026-09-25T11:15:25.718221Z`、原Sheets写跟踪 |
| 外侧义务 | 沿用[Repair01预登记](repair-01-preregistration.md)的逐项义务：来源依据、同一对象金额更正、说明更正、身份与已满足字段保持、无关记录保持；健康政策对既有机会的适用性与年份文字歧义单列 |
| 模型可见 | 公开请求、包指令与自行经原API发现的来源；不附本文件、评估表、历史审计、正确公式或来源ID |

## 包、入口与冻结

| 项目 | 本次登记 |
| --- | --- |
| 包 | 隔离设计包`2026.09.26.1` / `0a13f0021ee42d57a23d6c9052220966c61aaf7cae1bc0df99e06a574b2fdf62`，位于`.tmp/supervision-causal-20260926/hb-local-design/staged-squad`；未安装、未推广、非父代 |
| 唯一干预 | 相对H-T01的`.15`（`a231dffd…`）只改scheduler与verifier的预期阶段读取顺序段、README说明、版本号；[补丁](blind-expectation.patch)可在`core.autocrlf=false`下逐字节重现，[检查器](check-blind-expectation.ts)以真实loader/不可变reload验证四文件差异、两worker能力与三节点拓扑不变 |
| 源码 | 本登记与前序修复提交后的准确HEAD写入新freeze；运行中不改源码/spec |
| 目录 | `.tmp/supervision-causal-20260926/hb-01/`，episode在其`episode/`；首次创建，不能重启 |
| 控制器 | 原`run-repair-01.py --run-dir <hb-01>`，冻结`package.source`为上述staged目录、版本与digest；运行后核对真实Task binding |
| Inspect入口 | 原registered `opencorvus_inspect/opencorvus_business_repair`、Mission solver、outer model none、scorer None、一个sample、一个epoch |
| 模型 | 全部内部调用、memory与preflight仅流式`openai/gpt-5.6-luna` |
| 超时/观测 | 原300秒真实无活动、poll2；不自设总时长或请求预算；G11六项出站探针配置不改 |
| 凭据 | 原授权成对auth/models；源只读核对存在、未过期、Luna已投影；新host真实usable/projected/exact-model/streaming预检；不刷新复制件 |
| 收尾 | 公共cleanup→零活动→host正常退出→复制件实际删除，之后才解释业务结果 |

## 判读顺序

1. **干预是否发生**：前置预期节点对目标Opportunity的首次GET（或任何读到其金额/说明的调用）
   是否晚于方法Artifact成功发布。提前读取则记“干预未执行”，只保留观察，不作锚定结论。
2. **方法**：实际读取了哪些业务来源（特别是Drive/Sheets价格与等级折扣）；方法、预期与
   外侧关系54,000是否一致。字段齐全或发布成功不等于方法正确。
3. **行动与复核**：executor是否对同一记录发出更新、返回与读回；最终verifier是否以原始
   来源独立比较；方法之后的改判使用哪些原始依据，区分新增事实与对既有事实的重新推导，
   不把“没有新增业务记录或新引用”自动当成不合法改判。
4. **结算**：Task/Mission真实决定与外侧逐项义务是否一致；一项义务blocked不掩盖其它错误。

## 预先固定的解释与停止

| 实际轨迹 | 允许结论 |
| --- | --- |
| 预期节点在发布方法前读到目标值/说明 | 干预未执行；不改提示再抽 |
| 未见目标值而方法仍错 | 既有目标值曝光不是此次错误的必要条件；来源选择/解释/能力仍未分离 |
| 未见目标值而方法正确，executor修好并被正确结算、其它义务保持 | 一次“独立预期→同Task修复→复核”的真实轨迹；不外推可靠性，不晋升包 |
| 方法正确但executor未修、最终仍错误接受或错误宣称不可完成 | 判断→行动/裁决未闭合 |
| 方法正确、金额修好但破坏已满足义务 | 不判整体成功，差异单列 |
| runtime/输入/包/模型边界失败 | 业务结论null，保留全部费用并收尾，不自动恢复或替补 |

固定一次、无替补。收尾报告用Markdown表记录干预/方法/修正/保持/原生裁决各自成立或未知，
以及请求数、usage缺项、各token类别、业务与全部Tool、sample与controller时长；本地
`cost_usd=0`不当免费。结果不自动进入新作者、第二臂、更多样本或Campaign。
