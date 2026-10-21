# Goal调度的执行需求探测

对应[方案、根因与结果](../../records/2026-10/2026-10-21-goal-reconciliation-admission.md)。2026-10-21，单agent。共享只读plan在独立Project identity中决定是否需要交付，释放identity后才初始化运行能力；执行时重新读取与校验。预算耗尽但已接收待答复的原输入仍可恢复。

- [真实60秒前后对照](before-after-observation.json)：before60个Scheduler tick/60次Goal项目失败，after60个tick/0次Goal失败；after全观察141个tick。[原12次错误时间线](before-observation.json)保留，完整原日志不提交。
- [实际运行检查](runtime-observation.json)、[同CLI生产候选与八个旧Goal](project-plan.json)、[六项HTTP合同](real-read-check.json)。after窗口另有5次配置校验开始，真实runtime400仍存在；没有把此数归因全部请求或声称所有初始化停止。
- [首轮测试输入错误及其他四文件结果](focused-tests-input-001.log)、[修正后19项](focused-tests-recheck.log)、[真实全局Scheduler进程恢复](scheduler-runtime-check.log)：最终五文件41项/260断言通过；本地可控Provider原直接驱动一次、[新全局首次](scheduler-runtime-check-initial.log)及观察器修正后重跑各一次，每次两次stream=true、共6次；后两次保留原Message/continuation/1轮与实际第二回复。[后端类型](typecheck.log)及[文档](docs-check.log)通过。该本地合同不是实际Sol质量验收。
- [全量数据](data-preservation-observation.json)：90表131156原行、字段/时间/rowid/主键，schema3/integrity、原bytes/mtime及完整canonical相等；差异0，Provider activity321→321。
- [原5032物理结算](physical-terminal.json)：public shutdown200、原handle exit0、native原出生、physical/output/request/launcher均结算。自有浏览器页已关闭。
- prepare/serve/launch/shutdown/settle/check-reads/check-runtime/compare/preserve/归档脚本可审查。完整历史服务没有模型输入；没有原全库行JSON、DB、auth/models副本或原始运行历史归档。[实际凭据值安全扫描](secret-scan.json)不输出凭据，也不代替模型活动证据。

两张实际1280×720内置浏览器截图均人工查看，未运行UI自动化；[文件保存时间](screenshots.json)不代表绘制时间：

1. [原预算Goal可读](01-original-budget-goal-readable.png)：37,196/100,000 tokens、1/1轮、原回复与模型不可用提示。
2. [同Goal详情](02-original-goal-details.png)：原目标/预算/用量完整，仅查看，没有保存、恢复或完成操作。

本批真实全局恢复为Chat；Task/Mission使用原执行路径，有正向候选/预算/身份/取消/归档合同和代码审计，没有新增真实崩溃或Sol请求。默认布局/命名和原配置性能指标未据此完成，长期Goal继续。
