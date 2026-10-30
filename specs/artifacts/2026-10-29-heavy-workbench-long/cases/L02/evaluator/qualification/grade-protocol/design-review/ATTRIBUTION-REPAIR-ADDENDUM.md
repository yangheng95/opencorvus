# 主方归因修复：时间顺序追加

初读源码与 `source-reviewed/` 保留原观察；在初步意见发回后，主方执行了真实受控故障并修改当前唯一 Executor/pipeline。不是本审查者重跑。此后我只读原 `l02-grader-state-qualification-20261030` 的 before/repaired 源、注入脚本、probe、只读 SQLite、原 terminal ZIP 及 create/start/rm 原回执；本目录 `parent-attribution-observation/` 保留该次观察。初计划静态 P1-02 中的未知异常归因问题不再描述为“当前仍未修复”。

- red 原件：真实 native exit0、实际 output value7；host RuntimeError 被旧代码写为 failed/candidate_output_invalid。根因是 host validator 注入，不能当候选输出坏。旧源码、旧失败与 cleanup 均保留。
- 修后原件：相同类 host RuntimeError 返回 facility_validator_failed、candidate=false、phase=terminal、native exit0；修 validator 后原 CID `7cd5195c81bbb34fc5e3b1a996456e4103259a6118f739413300509011a969bb` 直接验收至 verified。原命令仅一次 create/start/rm，原对象未重启。当前明确候选输出解析及已知协议错误才带 candidate=True；未知 host 异常不再猜候选错误。

这是主方新运行事实的独立只读核对，**不是完整 partial reader 或 grader 已资格**。初完整计划关于失败 terminal 的统一身份读取、依赖、review、锚点仍待实施。

新 reader 必须处理这个真实旧样本：native exit0 本身并不能推翻候选失败（exit0 也能交坏输出）；反之，ledger 写着 failed/candidate_output_invalid 也不能压过已证实的 host 注入来源。须核原执行/validator 版本、原终态与 typed 失败证据。已确认 host 误归因的旧 red run 应标设施无效/原判定需调查，保其原 phase/错误，不自动改写旧 failed、不给候选0，也不把换 validator 后的另一验收事实冒称旧判定当时正确。若原因尚不能辨明则设施待查，不猜。修后 run 的 terminal→同 CID 再验收是在原候选 source/input/output 不变的前提下修评估器，不是候选重提或再执行。

当前公开执行稿“未执行的依赖单元保持未评”还需在实现前与叶级 blocked_candidate 做明确消歧：原 native 生命周期仍为未执行，不能伪造 failed；只有公开必交叶的真实候选依赖已缺交时，评估状态才可 blocked_candidate 并列根因。未调度的独立单元依然 unassessed，不能借该澄清全组置0。这应先同步唯一公开合同及 anchors，不能在候选后新增隐含零分规则。

此追加先尝试定位主报告末段时发生一次 apply_patch 上下文匹配错误，未修改原文件；改为独立 addendum，原计划时间顺序仍保留。这是审查文档编辑工具问题，不是产品或候选运行失败。
