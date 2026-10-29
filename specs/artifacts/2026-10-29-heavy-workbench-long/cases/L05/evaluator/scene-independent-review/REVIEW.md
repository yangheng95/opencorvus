# L05事故原现场到逐来源前向补偿：独立顺序资格审查

**修后可认可当前author-schema顺序建设性资格，无剩余实质阻断。** 两个真实checker缺口已被独立复现、保留并修复。此处不批准完整L05、候选grader、rubric或冻结；并发在途HTTP、真实中断、schema自由、完整职业交付和小时级均未达成。没有读取/操作L06候选、Task或容器，没有Provider、solver、GPU、UI或再次委托。

已重读L05 Recall末节、既有完整预案stage-assessment和public/SCENE-CONTRACT.draft.md，审了scene_app/check_scene/run_scene及唯一effects服务/worker request复用。source-initial取自主方实际source-cold-a，与当时主仓相同；source-repaired另存修后源码，旧源码/失败探针没有覆盖。所有审查文件仅在本外部目录。

## 一次独立source-only冷复跑

只复制五份执行源码和原始input的五文件：两个原SQLite、initial-authority、future-events和legacy-delivery。没有重新生成现场、复制旧修复输出或把主方答案DB当作执行成品。唯一调用为：

`C:/Python314/python.exe -X utf8 -B source-initial/evaluator/scene-source/run_scene.py --input inputs --output newest-deferred --policy newest --style deferred --control correct`

实际PID88528，2026-10-29T22:37:23.438374Z至22:37:25.060144Z，exit0；完整1.6217269秒、内部1.4028424秒。原五input字节执行前后均相同，接收方正常退出。命令与原stdout/stderr见cold-command.json和newest-deferred。此组合把主方oldest＋deferred、newest＋incremental的两因素部分解耦；不是用多跑相同参考凑样本。

三份正确图分别有14、19、17条posting，均通过独立逐来源检查和同一checker；不要求ID、posting数、资金parent或中间轨迹一致。它们仍是同一作者的三种策略配置，不是三个独立候选实现，也不是统计校准。

## 独立账目与事实核验

独立审查脚本未导入app.fold或checker.business_target，按原journal的最高revision集合另算业务贡献，再逐行查SQLite与真实服务effects。158项观察分布于重复的身份/字段/资金父项，**不作为158个独立科学样本**。原件见independent_audit.py和independent-SQL-audit.json。

| 状态 | A | B | 含义 |
| --- | ---: | ---: | --- |
| 原事故远端实际净额 | 1100 | 570 | 原真实effects，不是期望数 |
| 原accepted权威事实的正确修复目标 | 1015 | 710 | A/X同最高版冲突0、A/Z40、B/X200、B/Y取消0及opening/调整 |
| 后续真实输入后的最终目标 | 1130 | 510 | A/X最高5版110、A/Z50、B/X/Y取消、A调整总−30、B调整+10 |

因此“初始A1015/B710”只能称原权威事实的修复目标，不能称原远端余额。原远端A1100/B570与期望不一致正是事故的一部分；总额对也不代替逐来源正确。

原本地journal七项与initial-authority逐字段一致；future-events六项独立形成seq8..13。评估侧发出的新调整−5与note在run_scene中明确，审查用这些已发payload、原input与实际ACK顺序构建独立expected-authority，**不从修复后local DB推导期望**。随后同时比较本地事实、runner生成authority与该期望，避免同一错库定义自己的答案。本轮可信范围仍是明确合成的评估侧注入，不冒称现实审批资料完整。

三正确结果均为control epoch2/active1；原NUL注释`核对原收据\u0000保留原文`全文及Unicode保留，新增B note也在。原postings除原receipt为空可补真实receipt外，seq、wire、source、boundary、epoch逐字段未改；原已知远端effect与receipt全对象不变。原A/X真实请求顺序GET unknown→首次POST applied+dropped，原本地receipt仍NULL、远端已有原effect；A/Z是accepted而未投递。冷复跑最终用原key恢复，不删收据或另造旧身份。

另以纯只读SQL逐业务明确核验三正确结果的最终projection revision/status/amount，均与独立最高版集合相同；见independent-projection-audit.json，未导入app或checker，也未重跑HTTP。

各opening、business和adjustment净贡献与独立目标一致；每负reversal引用同租户正post、全部父余量非负。实际存在逻辑source与资金parent不同的合法动作，独立列于funding_links；批准负调整可以消耗opening/其他正来源，不会因此误判opening事实被篡改。不同策略选择不同parent与拆分均被接受。

## 三个真实错误控制的独立SQL复核

只读主方已完成的三个错误DB/HTTP原件，不重新执行控制，见wrong-controls-independent-SQL.json：

- conflict-first实际把A/X投影为最高版首先到达的120，初阶段远端A1135/B710；独立目标A1015/B710，checker具名错误，非关键词判断。
- ACK换key实际通过HTTP新增了另一个A+100，远端出现没有本地登记的effect，初阶段A1115/B710。旧key后来恢复也不能抹去这个额外真实效果。
- 恢复备份的远端最终仍A1130/B510，账户汇总看起来正确，但本地journal退回七条，q8..q13、后续调整/note/来源与收据链丢失，被具体判错。这证明当前checker在此控制中不是只核总额。

## 两个实质checker缺口及修后证据

**SCENE-CHECK-01：本地wire不完整仍判成功。** 审查仅在自己的正确输出副本中删一个新posting payload的kind与reverses，原checker仍exit0/business_success，因为它仅逐候选现有字段比对远端。本地无法重投完整wire，违反公开稳定intent合同。原DB/CLI/假通过结果完整保存在checker-probes/partial_wire_payload。

主方横查同语义deliver_one后，producer与checker都复用唯一public effects.decode，检查全部静态wire和本地联合身份；业务目标仍独立SQL。修后同一坏DB真实CLI得到exit2/business_mismatch、posting_wire_invalid(field=fields)。单个新增自有接收方PID6968中，合法完整wire实际confirmed；缺字段consumer精确ValueError `local_posting_wire_invalid:fields`，另本地联合身份错位精确`local_posting_identity_mismatch`。接收方正常exit0，无新完整场景冷跑。

**SCENE-CHECK-02：非法epoch/接受切片仍判成功。** 另一正确输出副本只把新posting的boundary_seq/epoch设−1，原checker仍success，证据在checker-probes/invalid_boundary_epoch。修后同一坏库exit2/business_mismatch、posting_epoch_boundary_invalid。

新增检查只认可本顺序场景的控制终态、原/最终两代与切片范围，以及business source在该边界至少已有accepted事实；暂停修复时仍epoch1且boundary=原切片是合法的，不能强迫所有新post都是epoch2。checker明确输出epoch_evidence_scope，**不是审批时刻、具体修订delta的全因果认证，也不是并发epoch栅栏已证明**。

修后只做必要的五个checker CLI（两原坏库＋三既有正确图）和上述微型消费者验证，全通过，见repair-assessment.json、repair-checks。正确14/19/17条图继续成功，修复没有要求参考数量/ID/ACK顺序。原两个假通过结果保留；修后源码另存，不把历史改成一直正确。

## 仍未完成与下一边界

当前checker明确依赖作者SQLite表与字段，原始journal/approval/note的事实比对也使用该schema；它不能冒充支持任意候选内部schema的正式grader。未来应先公开完整旧代码/原材料权威性和独立逻辑导出ABI，再以等价逻辑视图验不同实现，不因私有参考字段/存储排列强制候选照抄。

当前原现场由旧错误路径真实执行HTTP产生，但还是合成作者现场。源代码里的legacy_fixture仅制造历史输入，不能作为将来候选的生产fallback；也不要把私有脚本中的错误分类/答案映射直接给候选当任务根因。业务折叠、批准调整域与资金parent语义现在闭合，材料投放和真实候选可用性尚未冻结。

顺序settle_all可以沿完整旧intent原key取得收据，再分配正段/负段；它尚未实测修复事务中断、旧HTTP晚commit、多写者、接管后新接受或故障停止收敛。有效tag范围不证明“外发前确已持久登记”的所有时序；未知ACK现场在原snapshot真实存在，不等于当前切换期间的所有在途故障已覆盖。监测窗口、职业报告/交接、完整rubric/多质量校准均未提供。

可继续以此修后顺序参考和独立范围checker建设下一闭环；当前没有尚存实质阻断。**完整L05、冻结、小时、成熟benchmark和十题完成仍不认可。** 最终机器结论见stage-assessment.json；源身份记录见final-source-identity.json，不作为功能摘要门槛。未改主仓或提交，归档/范围提交由主方负责。
