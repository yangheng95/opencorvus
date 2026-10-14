# 生产集合委派证据

对应[实施前方案及结果](../../records/2026-10/2026-10-14-scheduler-frontier-grants.md)。后端合同通过，完整双成员视觉验收未完成；最新用户要求只使用单agent后，停止自有产品测试，没有再创建成员或复验scope。

- [执行概要](execution-summary.json)：首轮5条、复验23条真实流；122个生产包的投影及模板/Skill合同与真实scheduler工具工厂共12项188断言。两个初始assistant相差2毫秒；后续原root自行恢复的两位正文source-reader重叠34.355秒。
- [真实持久事实](persisted-facts-summary.json)：集合成员lineage、4条独立read来源、Provider过载错误和真实取消事件；完整只读数据库捕获在first/retry的facts压缩附件中。
- first目录保留初次过载失败原图、真实Provider审计、公开shutdown和正常exit0。retry保留重试过载、原Task自动续跑及取消；[停止原图](retry/02-stopped-by-user.jpg)显示Cancelled，未取得两侧同时流中切换截图，不能宣称完整UI验收通过。
- 复验服务在原600秒Native上限退出exit1；原handle18034已join5110d1。physicalCompletion、outputDrainComplete、requestCleanupComplete和配对退休均有实际收尾记录；本次没有完成公开shutdown，不将deadline退出写成正常退出。
- first/retry的execution附件保留正式checker、生成器、启动/停止及只读事实捕获脚本和日志，首轮失败投影日志也保留。凭据内容经现有CredentialRedactor处理，不归档凭据文件。

未完成：双成员流中Sources/阅读位置视觉复验、多项目/Mission真实矩阵、417中root取消时的activation fence UnknownError。现有worker正常取消不是root错误已修复的证据。
