# L08 whole-case independent review

结论：现有实质阻断已修复，可冻结为 **L08/0.2.0-dev 开发 pilot 合同**。只允许结案 metadata/README 状态；原始材料、业务语义、20叶/100分、critical、90分比较规则和已执行对象不变。它是完整可执行开发题；本审查不认证有效数小时、职业专家或统计成熟，也不认证十题完成。

原参考五项 H01–H05 均 pass，独立评级见 `review.json`，绑定主 `main-run`。真实弱报告的 H02 fail，其余按已交的真实内容 pass，见 `review-weak.json`。未手写总分，主方应通过真实 checker 合并。

## 集中问题与修复

**B01（已闭合）：部分缺交导致全机器叶误扣。** 我只从正确成品副本删除 `cash-ledger.csv`，原 checker 把真实 native0、正确 manifest/history/paid/plans/execution 等 M01–M14 全部判 fail。原程序/输入和原反例完整保留在 `case-initial` / `partial-cash-export`。修后以各输出及其真实依赖逐叶评估；对同一原副本实际 checker CLI 重验，仅 M14 fail、M01–13/M15 pass；完整原成品15机器叶均 pass。两条 CLI exit4 是未附人工 review 的正常未评状态，不能说业务失败。证据：`case-final/evaluator/check_l08.py`、`partial-repair/*-command.json` / `reviewer-repair-assessment.json`。主方其他缺交/顺序/原错误程序的既有复验原件已核读，未重开 native。未发现第二项实质阻断。

## 原始资料与数学独立核算

`independent_audit.py` 仅用标准库重新读取原 scope/quotes/history/payments/calendar/events/treasury/release CSV/JSON，不导入作者 core 作业务 oracle。逐任务期限/不可拆模式/依赖/所有人和设备逐日占用、每日日现金、总预算、完整执行账、原付款和发布身份均重算；覆盖主方已完成的 base、报价和新 scope 三输入，而非只比较作者自报 pass。结果在 `independent-business-audit.json`，实际命令在 `independent-business-command.json`。

历史七付款合计13600（六历史任务12100加P07订金1500），初始20600减已付得checkpoint7000。H04坏交付7000不退款；A08 reserved后续1500，cancel在12付剩余1500并另有内部start100，不把旧付款回滚为融资。R02.end+1的15000只在真实有限 manifest 验收后收取，day16固定4000在当日费用前计入；overhead100按12..finish−1计入成本。

|基例情景|最低完工|实际总成本|最低日现金|F01|
|---|---:|---:|---:|---|
|base|33|36650|1500|保留|
|supplier_delay|36|36950|2550|保留|
|certification_hold|37|36150|1550|不保留|
|trainer_loss|38|36450|2600|不保留|

独立证明是合法成本下界剪枝与忽略共同占用的乐观关键链/个人日历放松，随后以真实全部资源与现金可行见证闭合；没有把 solver OPTIMAL 当证明。供应 earliest24→A08 end26→A09 end28→A14 end30→C00 end31→CERT end35→HANDOFF end36。认证 release32使其到37；Di slot36缺席使其到38。基例放松链与可行见证相合到33。最低固定成本33550，F01 cheapest1000；37日含F01最低37050、38日最低37150，均超过37000。33/36日保留F01有实物可行见证。报价+100和新任务+300使 supplier 情景的 F01 实际转为不保留，是可定位机制而非依参考甘特图判对。

独立发布解析得 North12/South7；S07/08同最高版冲突、S09非整数、S11空身份、S10未来、撤回beta=0均有原source定位。旧 native0不构成验收；独立 component 与 programme 输出均实质一致。原始资料明确原创虚构，不伪称真实项目数据。

## 实际执行与交付

核对主方三个输入的原 inspect/native/mounts/ZIP成员：同一两源，readonly program/raw、新 results、networknone、1CPU、实际native0。直接原对象字节身份用于绑定来源，不用于替代功能正确性，详 `immutable-object-and-native-audit.json`。

本审查只做了一次全新基例 source-only programme（内部实际child component），native0：运行3.8630978秒，含封存清理4.1679秒；CID `474cca68cf2c6339b017e56fdae8b0dba6fb0a95539eaef3e607b89c44489747`。`cold-base/programme/originals.zip` 先封存，再只清理该自有CID。输出与已独立核算的原业务对象相同。未重三输入矩阵/错误 programme，未用 Provider/GPU/UI 或接触活跃 L02。

已真正打开主甘特图和现金PNG。四情景标题/任务/模拟日轴、due33虚线与scope/cost标签可读；现金图有 end-of-day cost-unit轴、零线和对应四情景legend，内容与全账相符。没有用参考行顺序/模式之外私有ID/求解轨迹限制别的合法排程；资源和source_ids集合顺序自由。

报告把请求延期与未批准明确区分，修复仅为有限 manifest，不能认证全平台；现金收取是条件性模型而非现实保证。源表、实际账和报告共同给出供应/认证/培训触发的数值后果及procurement/Ada/Cy/Di/客户批准责任，数据冲突归tenant steward并要求重新验收。完整机器表/公式被当作论证，不要求重复抄数字。

真实弱 programme 的末段写明“所有延期已批准、整个平台通过全部质量与安全关、保证按期回款”。这是实际native写出的错误强声明，直接违背原events、有限验收和条件现金，H02 fail；前面的正确表格/措辞不能冲销。其他有据数学、金额、风险owner、图和复建没有因目录名一并判错。错误 programme/cached 控制的原native和具名失败也已核读；这些是开发鉴别，不是独立新候选/统计样本。

## 边界与原件

本审查是熟悉参考设计的非盲 AI-agent 评审，未作职业真人认证。原 day28 建造遗漏链条及冻结前改素材的历史、首checker tuple-key序列化错误、原部分缺交误判均保留；不将工具/建造错误改写成候选成绩。最初两次读取 correspondence 扩展名猜错，后实际读取`.eml`，不据失败读操作判断材料缺交。

允许更快算法/其他语言/正确等价行序；当前秒级参考复跑只证明可解与复建，不证明任务会占用几个小时。实际 fresh 系统表现、有效工作时长和更广多质量/专业校准属于后续实证，不能借本次批准宣称已完成。


最终公开必交一致性追加：冻结前M14改为critical=true（权重4，仍20叶/100分/90规则）。公开原本已要求完整现金/排程CSV，允许缺交96分仍good会与必交约束矛盾；认可本次调整，不能据critical数量宣称变难。用明确标注的纯聚合人工pass夹具对原缺CSV副本真实CLI验证：96、good=false、business_success=false、critical_failed=[M14]、exit2。该夹具不是该副本的实际内容评审/候选成绩。四份实际源码与case-final原字节同一，只有rubric一字段变化；新rubric及原命令在critical-export-final。初稿/旧13CLI按当时M14非critical身份保留，不回写。结案应固定当前包括M14的critical规则。
