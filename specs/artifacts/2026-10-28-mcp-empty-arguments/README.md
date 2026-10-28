# 本地MCP空参数保真实页证据

对应[方案与结果](../../records/2026-10/2026-10-28-mcp-empty-arguments.md)。

- [汇总](runtime-review.json)、[完整参数/连接事实](argument-facts-reviewed.json)、[原始输入](actual-arguments-input.txt)。
- [原输入](01-explicit-empty-argument-input-en.jpg)、[真实启动失败](02-real-service-fails-after-empty-argument-loss-en.jpg)：参数在首次解析时丢失，原进程80720正常按无目录合同exit1，原失败保留。
- [完全相同的输入重提](03-same-authored-arguments-resubmitted-en.jpg)、[原服务成功连接](04-same-service-connects-with-empty-argument-en.jpg)、[实际断开](05-disconnect-settles-empty-argument-service-en.jpg)、[中文重连](06-reconnected-saved-empty-argument-zh.jpg)。最后四图为main-B3AIDWl3。
- [三原进程物理核对](mcp-physical-reviewed.json)：原失败1、两个修复后进程0，terminal/output/settled均结清且原occurrence退休。两原服务68897/20633、native与launcher0，shutdown200，沿同一30分钟截止清理后退休两catalog副本；认证未复制，Provider请求0，累计747，最后余量613033ms。
- [所有原行](all-rows-reviewed.json)：98287行精确保留，当前副本98292/98294行、schema9/integrity ok。

7项非UI服务合同测试16断言、普通构建和文档/架构检查通过；没有UI自动化测试。旧配置中已经丢失的作者参数不可猜测恢复，需要重填原参数；本次以真实表单重提同一服务验证恢复，没有手改库或伪造状态。完整原stderr仅留私有目录，公开事实保留原诊断ID和短摘录。
