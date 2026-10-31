# Codex与OpenCorvus：实际对照结果

用户要的是模型对照结果。以下直接从已终态原grade和原私有执行事实读取，没有重跑、重新评分或改旧分。此前继续作者研究/检查器工作没有交付新的有效模型比较，不能用这些工作代替结果。

| 同版任务 | fresh Codex原成绩 | OpenCorvus原成绩 | 实际业务差异 |
| --- | --- | --- | --- |
| L02/0.2 | 100；study_complete/quality_success/good | 100；study_complete/quality_success/good | 未建立重型区分度；不能由总分宣布系统并列强 |
| L06/0.3 | 100；17项全pass、全部critical通过 | 100；17项全pass、全部critical通过 | Codex期望成本48,431.125；OC49,262.25，Codex低831.125，即相对OC低1.68714% |
| L06/0.4 | 100；17项全pass、全部critical通过 | 100；17项全pass、全部critical通过 | 三输入的精确期望成本均相同，见下表 |

L06/0.3的满分掩盖了真实经济成本差异。原线仅要求成本不超过60,044，两个不同质量的正确计划都越过了它；旧成绩保留，不据此改分。这里的成本差异只属于这个固定任务/运行，不作总体模型能力因果排名。

| L06/0.4输入 | 两系统相同的原实际精确成本 |
| --- | --- |
| base | 300834939/4000000 |
| cash-tight | 11287373277/128000000 |
| shifted-prior | 90125954529/1280000000 |

L06/0.4确实两边达到相同成本，题目有限模型太易精确解决、验收与评分存在天花板；不能靠把作者研究做复杂或继续机械升版称对照成功。

## 原始证据

- L02：[Codex/OC原public、自然交付与评分说明](cases/L02/README.md)。原最终grade的精确外部路径逐一保在[读取结果JSON](CODEX-COMPARISON-RESULTS.json)，原workspace/Git/失败/执行/独评和评分已封存。
- L06/0.3：[Codex原grade](cases/L06/evaluator/pilot-codex-v03-native-20261031/final-assessment/final-grade.json)、[OC原grade](cases/L06/evaluator/pilot-opencorvus-v03-native-20261031/final-assessment/final-grade.json)。实际成本来自各原private-run/logical-and-journal-assessment.json，不是重算期望或自报。
- L06/0.4：[Codex原grade](cases/L06/evaluator/pilot-codex-v04-native-20261031/evaluation/final-grade.json)、[OC原grade](cases/L06/evaluator/pilot-opencorvus-v04-native-20261031/evaluation/final-grade.json)。精确成本来自各原assessment/actual-facts.json。

## 能比较什么，尚未交付什么

同一轮给了同冻结public并用同grader、源交付实跑及单层内容独评；这些分数是原工程合同验收结果。Codex底层实际模型、完整usage和精确活动归因没有暴露，OC实际gpt-6.1-sol已核，所以同模型、同资源、费用/速度因果排名均不成立。

当前没有新的有效重型Codex对照结论。L01仍是原作者矩阵，不是Codex对照；其余题的作者参考/正确错误控制也不能冒充fresh Codex成绩。十题有效模型比较和候选有效小时目标没有完成。

后续以完整可评任务的实际Codex/OpenCorvus交付、原始质量数值和失败差异为主线；必要的任务/评分修复只用于使该对照有效，不再以新增作者方法、检查器、曲线或文件数替代模型结果。现有已起工作原件保留，停止追加无关作者求解；L01原有效训练不取消/重启。
