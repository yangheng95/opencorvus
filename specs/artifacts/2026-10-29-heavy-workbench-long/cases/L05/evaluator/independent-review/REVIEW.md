# L05 mini 独立冷复跑与协议审查

当前明确的 synthetic USD、合作接收方、loopback HTTP/两个 SQLite 库的 mini 范围内，未发现尚存 P0/P1 实质阻断。可认可这个局部协议与已测错误契约的可达性。**mini 仍未冻结；不批准完整 L05，不是候选成绩，不证明小时级任务、职业专家校准或十题已完成。** 本审查是一层独立 AI agent 审查，无再次委托。

实施前计划报告独立保存在 `D:/opencorvus-benchmark-runs/l05-protocol-review-20261030/PLAN-REVIEW.md` 与 `plan-assessment.json`。初始两个 P1 均先反馈、主方先明确再实现：静态验证→已成功身份幂等/冲突→新身份动态冲正；未知 ACK 必须来自真实首次 HTTP POST 提交后的响应丢失。当前源码与实际证据解决了这两项，不靠改标题推断解决。

## 对象与真实执行

本目录中的 `source-a/` 只复制主方首次归档的 `executed-source-a` 三源，没有复制旧数据库、旧输出或旧结果。使用主机标准库 Python 3.14，未运行模型、Provider、solver、GPU、Docker 或 UI，也未查看 L06 活动候选。所有故障终止都由源码持有的本次 Popen 对象操作，阶段握手含 PID；未按名称或扫描的主机 PID 杀进程。

| 实际证据 | 范围及结果 | 原件 |
| --- | --- | --- |
| 唯一一次 source-only 冷复跑 | harness PID58244，exit0；完整6.194199秒，内部资格5.7548515秒；40项通过 | `cold-command.json`、`cold-stdout.txt`、`cold-stderr.txt`、`cold-a/` |
| 另写独立只读 SQL 核验 | 24项通过，逐身份/载荷/金额/receipt，不只对总数 | `independent_sql.py`、`independent-SQL-audit.json` |
| 两种故意错误控制真实执行 | harness PID43276，exit0，5.116847秒；同实际接收方与 checker 明确拒绝 | `counterexamples.command.json`、`counterexamples-independent/` |
| 五个 checker 真 CLI 探针 | 同额异身份、缺项加额外项、重复实际身份、交换真实收据、expected重复均给具名错误 | `checker-probes/`、`checker-probe-assessment.json` |
| 单个新增自有服务边界 | ready PID98584与 Popen 一致，正常exit0，1.2143088秒；14项通过 | `http_boundaries.py`、`http-boundaries/` |

这些数量分属重叠的执行/观察层，不能相加当成独立科学样本量。所有本轮自有实验已终态；不需要继续轮询或重复原40。完整命令/起止时间在相应 command/launch JSON；新增 HTTP 的 argv/终态在 receipt.json。

## 独立观察到的持久事实

冷跑 `business.sqlite` 的三项精确是 A/E1+100、A/R1−30、B/E1+200，canonical payload 与 accepted-events 一致。远端核心三项金额与不可变载荷一致；每个本地 outbox receipt_id 指向同一个远端联合身份的原收据。A 总70、B 总200只是附加核算。远端另有 T/P、T/R、X/P、X/一个冲正，共7项；T/X是明确分离的协议探针，不混入核心成功名单。

A/E1实际 requests 顺序为 GET unknown → 首次 POST applied、dropped=1 → GET found → 重启后 found/replayed；所有后续收据保持初次服务分配值。drop_once consumed=1；同DB服务重新启动没有再次武装。首次传输未知时，本地已持久 accepted 且 outbox receipt为空。之后握手 worker PID7784 处于 after_remote_receipt_before_local_commit，被自己的 Popen 句柄真实终止（returncode1）；原本地 pending仍在，再启动确认成功。三次主冷跑服务正常退出。另实例独立数据库允许相同A/E1+101而原实例仍100，证明本次业务命名空间隔离；不延伸为用户认证安全。

静态验证、existing-key和动态校验次序可在 `source-a/l05_effects.py:106` 的 apply 审读：BEGIN IMMEDIATE 包围 existing 查找、同键决定、新 reversal parent/累计检查、effects/receipt/request/drop消费共同提交；真正 socket 关闭在 commit 返回后（该文件183行）。两个库没有共同事务。worker在 `source-a/l05_worker.py:29` 本地账/outbox同事务接收，在52行 drain 对账，69行握手与74行持久确认隔开。

新增真实 HTTP 验证：X/P+100，两不同−60并发只有一项成功，另一项 overage；取实际被拒身份改−40后是首次201，说明拒绝没有占键。原成功−60身份改−40为409冲突且原收据；余额已经0后原−60重放仍200/replayed和原收据。已知成功键带bool金额仍先422/amount_minor。其他租户U/P不能满足T/R的parent，T自己的P到达后同T/R身份首次成功。所有请求/实际SQL/任意winner保存，不规定线程获胜者。

## 错误鉴别与检查器范围

独立运行两种明确故意错误控制，不把其源码当候选或fallback：

- global_event_id以单event_id作主键，实际本地与远端只有A/E1与A/R1；同checker返回B/E1 local_entry_missing、remote_effect_missing。独立只读SQL再次确认B确实缺失。
- early_sent先把三个本地outbox写为sent-before-request，在真实HTTP前握手；只终止该Popen PID95692。重启返回already_sent，真实GET 404/unknown，远端effects表为空；同checker返回三个remote_effect_missing。独立SQL确认这不是仅改报告状态。

checker按 expected 声明的完整A/B租户分区检查 entries/effects/outbox 的联合身份并集；先检查真实重复身份，再逐身份检查载荷和收据（`counterexample-source/check_l05_state.py:25`、30、46）。同总额两笔改成101/−31仍被拒；把B/E1搬成B/E2既报缺失也报额外项；弱schema实插第二条B身份报entries_duplicate_identity；交换两个真实A收据报receipt_binding_mismatch；expected重复为run_invalid。五个探针都执行真实CLI，原输入/修改后的独立DB/命令/错误JSON保存于各probe目录。没有发现这些已执行通路的业务绕过。

这不是完整L05 grader：expected是评估侧可信accepted事件，worker.ingest是这个输入范围内的微型见证，不据此宣称其为通用未受信业务入口；本轮没有要求它修复任意脏库。checker忽略T/X是声明的A/B分区设计，不能据此说它验了所有未知租户。设施错误与业务失败均CLI exit2，但JSON分别run_invalid/business_mismatch；本轮没有完整评分协议要求二者具有不同退出码。不能仅看退出码混成候选0分。

## 当前公开协议最终核对

最后重新读取并存为 `PROTOCOL-final-reviewed.md`。它仍题为“未冻结”，明示合成USD、局部资格、完整任务/版本语义未交付、不计数小时。中途追加的两项解释与当前执行相符：requests只持久通过静态schema的业务POST及合法GET，422/路由证据在实际HTTP采集中；GET对账或原键POST重试都合法。requests中服务决定不能被解释为客户端读到ACK，也不替代两个库/真实socket事实。

`final-source-identity.json`直接逐字节核对六个已审执行源与当前文件；这是审查对象身份记录，不用摘要代替功能正确性。三原冷跑源在控制审查时也再次比较为相同，未更换服务或worker。协议说明的文字补充不改变已执行业务合同。

## 认可范围和未知

可认可：此合作接收方协议可由标准库、真实HTTP和独立持久库完成；本次观察覆盖首次commit失ACK、远端已知但本地确认前worker中断、服务重启、真实并发、联合租户身份、拒绝重试、全额重放及两种错误控制。当前mini没有尚存实质阻断。

尚未资格：换key重投等其余错误实现、完整修订/多币种/脏库保数据演进/监测恢复链、完整L05题面和rubric及受测系统执行。一次本机进程中断不等于断电、故障无限持续可收敛、或生产安全认证；5秒资格不等于数小时有效工作。独立复跑证明了本地功能事实，不是统计稳定性、职业真人校准、成熟benchmark或十题完成。未来完整现场的建设预案不在此次认可内。

未修改主仓源码/文档、未提交Git；主方负责核对和范围归档。原计划问题和此前所有原件保留。本次最终机读结论见 `stage-assessment.json`。
