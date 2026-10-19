# Git 身份读取与原生启动压力

448真实证据，见[方案与Recall](../../records/2026-10/2026-10-20-native-spawn-pressure.md)。

- `before-contract.log`、`before-ancestor-contract.log`、`before-availability-contract.log`：三个实际失败条件，原runner完整结算exit1；包含损坏子.git误认有效父仓库，以及Git缺失时继续猜身份。
- `availability-contracts.log`、`ancestor-contracts.log`、`identity-contracts.log`等：按文件取最新，38 pass、84断言、1 POSIX路径skip，明确正确身份/配置/生命周期/错误合同。`availability-typecheck.log`为交付冻结代码的类型检查，其他日志对应中间阶段。
- `http-error-contract-reviewed.json`：原D盘损坏子目录和独立C盘损坏目录通过真实公开HTTP都返回400/ProjectGitDiscoveryError。早期409记录及其根因更正一起保留，不把错误的初始解释当结论。
- `pressure-samples.json`：10轮各48条实际Git命令、原Process/Job/输出/请求完整结算，原exec27235 joined0；降低并发没有稳定改善，因此保持当前配置策略。这是阶段诊断，不冒充全量验收。
- `results.json`：四次原native服务、最终模型/凭据/目录预检、全canonical恢复、原物理/输出/请求/launcher结算、最终85项目/schema2。最终cold15.800s/restore16.366s仍未达10s/5s；全部并发GET统计中能力与专家团目录等待28.915s/28.977s，20s页面要求也failed。`reviewed-results.json`保留当时仅筛选配置读取的中间判断；其true不代表完整页面通过，最终结果已纠正覆盖缺口。
- `after-cost.json`、`final-cost.json`、`reviewed-cost.json`、`availability-cost.json`保留全部阶段。重叠累计不是墙钟；默认4 runtime cache的正常收敛使立即恢复再次冷读，未调大缓存或清库。
- `availability-home.png`与`availability-chat.png`为交付冻结代码的手动真实页面；另保留reviewed截图。Goal入口、实际OK、模型及Ask可见。没有UI自动化。
- `development-marker-metadata.json`：开发仓库既有Git标记早于本轮，观测后metadata保持；保留根因复现时写入隔离QA库的父Project row，未删除数据或回退工作区。
- 两份`private-pair-retirement*.json`：四次原生服务全结算后退休临时完整auth/models对，源授权metadata保持，归档前扫描实际敏感值。`data-verification-availability.json`是最终85项目的直接只读数据库结果。

当前Windows合同通过，POSIX特殊路径尚未在该平台执行；完整性能未达标，后续继续修复。
