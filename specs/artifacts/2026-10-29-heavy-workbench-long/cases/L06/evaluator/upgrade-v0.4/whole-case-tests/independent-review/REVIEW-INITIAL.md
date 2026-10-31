# L06/0.4整题独立初评

当前不允许冻结：两个实际评分边界缺口B01/B02须集中修复。原始业务、完整执行、科学推导及交付本体未发现新的实质阻断。五H内容初评已按原assignment分别封存；没有手写总分。

- B01（M05）：只把导出AR的due_week=1改为JSON true，实际checker仍12M通过。根因为Python字典相等把bool当int；应严格核AR数组、身份和整数字段，再按业务身份无序比较。证据：whole-checker-observations/boolean-mutation.json、boolean-original-AR-due-command.json及当时actual-check_whole.py。
- B02（M02/M06）：初始qa=0却test A这一已知非法lab动作，在partial wire路径仅获blocked。当前只检查operations的physical advance。证据：partial-invalid-laboratory-command.json。该探针是明确标识的合成捕获对象变异，不是实际新坏programme执行；不得冒充E2E。应检查实际可观测lab动作的两正概率结果，物理失败M02、支付失败M06，下游未执行继续blocked。

独立标准库解析原CSV/Fraction并复制SQLite/WAL/SHM只读核算：原执行与新冷重建各3152个阶段、197条真实终结路径，三个输入每条正概率支持与总质量1，逐packet/payload/key/receipt/post-state/成本/现金/AR均闭合。实际最低现金base -13、tight -15、shifted -13；终态最低4/0/1，实际最大raw峰3（cap4）。准确期望成本分别300834939/4000000、11287373277/128000000、90125954529/1280000000。所有明细见whole-raw-SQL-audit.json和independent-logical-stage-values.json。路径数与阶段数不是独立统计样本。

唯一授权source-only重建从实际交付source.zip展开，168.5232507秒自然exit0，重新规划、验Bellman证书、运行全部actor原生路径/两controller73和行序控制并出报告/图。旧programme/plan/答案没有送入该重建规划器。cold-originals.zip和cold-owner-terminal.json保原件。新episode与原部署不同，实际checker仍按逻辑paid-path接受原完整导出；该变化不要求作者episode/key字面一致。此时长只属参考重建，不是候选有效小时。

完整Bellman源审与实际新证书支持这些有限递推根：week/phase/material/quarantine/settled cash/likelihood quotient充分，mandatory销售使未来AR随week固定，所有合法动作和paid test两结果必须有可行续接；terminal先处置再现金>=0。class-known比较仍未知未来lot，不是提前给出整条结果。未另跑第二规划器，未对class-known单独声称完整证书。原/新实际成本已独立SQL核对，不以作者core自比作唯一oracle。

主/弱三张PNG均真实打开，另打开新冷重建的信息图；单位、概率支持范围、现金底线、actual material peak、信息类别/alias区分可读。主五H均pass；弱只有H01和H05fail：实际末段肯定声称首次paid观测确定四标签及所有现实网络/掉电财务保证，不能被正确底表或前文限制冲销。其余三H按实际正确内容保留pass。

四个真实错误programme已有原wire/SQL具名关键失败，未运行依赖保持未评/blocked。另wrong-IID真实完整2768阶段被独立核算，物理、后验和恢复都成立，真成本1194683/12800、1208591527/12800000、4888983507/64000000均超过各原same-info optimum的101/100，确实只暴露质量缺陷；不对该控制额外给五H或总分。证明错误机制可被识别，不证明fresh LLM区分度或小时。

审查非盲，AI agent熟悉此前作者与候选结果，无职业真人或统计成熟资格。没有访问Provider/凭据/L01/用户进程，无Docker/WSL/UI，未改主仓或原run。初始路径定位的rubric.json/source/某些failure.json猜错和工具缺路径原输出保留，均不是业务失败。冻结前仅需上述集中修后原反例及正常对象复核，不应重复native或求解矩阵。
