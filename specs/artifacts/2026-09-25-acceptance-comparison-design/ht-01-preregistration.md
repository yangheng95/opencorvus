# H-T 01：新执行者开始前的方法形成与后续业务闭环

G25的[实际结果](ht-01-results.md)已覆盖本登记时点的待运行状态；本文件保留原预测与
停止规则，不以观察结果倒改预登记。

## Recall与信息增益

承接[H-T精确设计](expectation-first-design.md)、[共同机制结论](mechanism-decision.md)
和[Repair01结果](repair-01-results.md)。用户要求继续无人值守推进，但禁止同义提示
重抽、逐案追分和把局部合同当业务根治。本次登记一个新的时间顺序机制诊断，不恢复
旧Repair01，不是H-E第三臂、两包效果比较或进化Campaign。

G21的方法形成前已经收到新executor报告。现有记录不能回答：**同一verifier角色在
本轮executor尚未发生时会形成什么方法，该方法之后如何影响真实行动与最终裁决。**
H-T改变真实责任节点和信息产生顺序，可以观察这个前缀。本次不会假装已隔离所有锚定：
初态仍保留历史错误说明，角色先验和来源选择仍在；节点数/上下文/成本也改变。
若前置方法已错，只支持“本次新executor报告不是该错误的必要条件”，不能直接归因
为模型能力不足。若前置正确、后续错误，则有明确新的失真时点可定位。

不重新运行`.14`作对照。G21/H-E为历史背景，不能与本次相减估计因果收益或总体成功率。
这次只固定一次新Mission occurrence（执行轮次），无替补。干预未发生、失败、未知或
runtime边界都保留；不为得到理想轨迹补跑。

## 原输入不变，评估不进入模型

沿用[Repair01预登记](repair-01-preregistration.md)的同一完整输入及全部逐项外侧义务，
包括新公开repair请求、金额及错误说明修正、已有正确字段/无关事实保持、政策年份和
既有机会适用性歧义单列。此文档不新增业务答案或任意成功条件。

| 项目 | 固定来源与边界 |
| --- | --- |
| kind/id | `operator-derived-business-repair` / `repair-01-existing-opportunity`；这是数据集sample身份，新的项目/Mission/Task/Session身份由真实运行创建 |
| fixture | `.tmp/supervision-causal-20260925/repair-01-preparation/fixture.json`，231703 bytes，`af809c323ab14ac90b6df4193825bc65d5cae3697eb434ed8b4d727989ebe869` |
| 公开输入 | 同目录`request.txt`，1844 bytes，`8043c272d1996fc3007f5b77337a420c597aa14a27b96de733c10d3f250d6eab`；由真实fixture loader取得，完整相同 |
| 来源证明 | 原`source-receipt.json`保留B1原eval逐值核对；不重新制作/修饰fixture，不复制旧participant消息 |
| 初态 | 完整原state、业务ID、全部记录/噪声及原580字节错误说明；旧正确/错误文本均不隐藏 |
| 权限/clock | 原gmail/google_drive/google_sheets/salesforce四服务；`2026-09-25T11:15:25.718221Z`；原Sheets写跟踪 |
| Agent可见 | 公开request、真实包指令及通过原API自行发现的来源；不附本spec、评估表、历史审计或正确公式/来源ID |
| 外侧评估 | 原API事件、前后完整state、实际participant/Artifact/dispatch/native decision；官方strict/partial固定null，不调用create rubric |

既有数据集sample ID不意味着复活旧Task。新的独立运行目录和request ID、项目、Mission、
Task、worker lineage都必须实际新建。前置方法若读到初态旧错误说明，必须按真实曝光
记录；不能用“尚无新executor”冒称所有producer信息都不存在。

## 包、入口与独立冻结

直接使用G23真实loader已材料化的不可变设计包，无需先改全仓默认包来进行这个诊断。
这是operator开发干预，不是生产evolve作者、安装推广或更优父代。

| 项目 | 本次登记 |
| --- | --- |
| 包版本/身份 | `2026.09.25.15` / `a231dffdaed86a638cb8cc0995eab387a67dba8d70330980b37210553fd37b40` |
| 包位置 | `ht-local-design/checker-run-02/runtime/data/expert-squad-package-revisions/v1/<digest>`，G23六文件loader/reload及原能力合同收据固定 |
| 唯一干预 | 原verifier前置方法节点→原executor→原verifier最终节点；manifest/scheduler/verifier/README四文件差异；原executor/selector/core/权限保持 |
| 当前代码 | 本登记提交后准确HEAD写入新freeze；运行中不改源码/spec；默认source包仍`.14`，实际诊断project显式绑定上述`.15` |
| 新目录 | `.tmp/supervision-causal-20260925/ht-01/`；episode仅其`episode/`子目录；首次创建且不能重启 |
| 控制器 | 原单一`run-repair-01.py --run-dir <ht-01>`，不复制脚本/新平台、不重新实现HTTP/cleanup |
| Inspect入口 | 原真实registered `opencorvus_inspect/opencorvus_business_repair` / Mission solver / outer model none / scorer None / one sample / one epoch |
| 模型 | 全部内部调用、memory与preflight仅流式`openai/gpt-5.6-luna` |
| 超时/观测 | 原300秒真实无活动/poll2；无自设总时长或请求预算；五分钟持久化快照 |
| 探针 | 原六项G11审计配置不改；新阶段文案改变意味着旧精确片段可能不匹配，不能据此说模型没收到。阶段判定以真实dispatch/Message/Artifact时序为主 |
| 凭据 | 原授权的成对auth/models；源目录只读核对存在/未过期/Luna投影，新的host真实usable/projected/exact-model/streaming预检；不刷新复制件 |
| 收尾 | 原公共cleanup→零活动→正常host退出→auth/models复制件实际删除，完成后才解释业务结果 |

启动前必须有`ht-01/freeze.json`：准确source SHA、控制器字节身份、原fixture/public
request/source receipt、设计包及本地检查收据、原probe配置、本登记、一次样本、目录和
预检要求。它引用原材料，不能改写旧freeze。预检真实结果写新episode/preflight.json；
pending要求不冒充已通过。只生成登记文档不等于启动，缺失任何必要身份不启动。

## 先判干预发生，再判方法，再判业务

| 观察维度 | 必须核对的真实证据 |
| --- | --- |
| 角色/节点身份 | 实际Task packageRevisionBinding相符；三个初始dispatch分别绑定expectation→verifier、executor→executor、final-verifier→verifier，各节点/Session真实独立 |
| 方法前缀 | 前置方法成功publish及该节点真实结果，时间严格早于新executor的首次dispatch request/Session输入和业务调用；只看Artifact标签或报告自述不足 |
| 原始依据 | 前置方法具体使用了哪些API业务读、哪些尚未读；来源关系和方法正确性独立评估，不能从字段齐全或发布成功推断 |
| 先前曝光 | 前置阶段实际读过哪些初态记录/说明；保留全部曝光，不预设盲审。若新executor已先发生，记录干预未执行 |
| 跨阶段交接 | scheduler真实读前置产物；executor及最终verifier各自在本Session search/完整read得到本Turn read-ref；原引用和任何修订形成真实链 |
| 方法改判 | 对比前后具体前提/方法/预期；改变须有真实原始反证及保留旧方法，不能仅以执行值或较新报告作为正确性 |
| 修复与保持 | 同一业务对象的真实更新请求/返回/后续读回及最终state；原ID/名称/账户/阶段和其它义务按原登记逐项审定 |
| 裁决 | Task/Mission真实决定与上述效果一致；对部分义务blocked不能掩盖其它错误的satisfied |

Host不会替模型发三个dispatch、检查公式或按业务字段强制放行。若模型违反图/不发布
方法/丢交接，保存真实结果，不由operator插入调用补成正确轨迹。前置节点的terminal
success最多证明其本轮工作结算，不代替后续最终verifier或业务验收。

## 预先固定的解释与停止

| 实际轨迹 | 允许结论 |
| --- | --- |
| 没形成合法前置方法，或executor先开始 | 顺序干预未实现；不是方法有效性通过，不调整提示再抽一次 |
| 方法确实在前，但从一开始错误/来源不足 | 新executor报告不是此次错误的必要条件；旧业务文本/来源选择/能力未分离，不能宣称独立预期可靠 |
| 前置正确，后续无新原始反证却按错误结果改判 | 错误进入比较/裁决阶段，保留准确改判链；不能只继续补发现来源的提示 |
| 前置正确，executor首次修好且保持义务 | 支持一次预期辅助的修复交付；监督触发continuation未知，不补样本造机会 |
| 真实差异促使同Task后续更新并再验成功 | 只支持这一次纠错闭环，不能晋升父代/外推收益 |
| 正确差异却未修改或仍错误接受/错误宣称不可完成 | 判断→行动/裁决未解决；对业务结果如实记未达成 |
| 任一原成功义务被破坏 | 不能因金额正确整体判成功，完整差异单列 |
| runtime/输入/包/模型边界失败 | 业务结论null，保留所有费用并收尾；此次不再自动恢复或替补 |

所有原文件只读。收尾后的汇总使用Markdown表格记录：干预实现/方法正确性/实际修正/
保持义务/原生裁决各自成立或未知，以及完整请求/usage缺项/token类别/业务与全部Tool/
sample和controller时长。不得与旧官方分拼接。三节点新增的调用全部计成本；没有取得
外部账单时如实说明，不把cost_usd0当免费。

本登记完成的是一个有界信息增益问题及执行边界；不是可靠业务纠错已解决。结果无论
如何均不自动进入新作者、第二臂、更多样本或Campaign。
