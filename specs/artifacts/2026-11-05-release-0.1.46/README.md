# 0.1.46 发布证据

对应[方案](../../records/2026-11/2026-11-05-release-0.1.46.md)。**已完整公开交付**：正式42019654335、产品f88，23成功/6设计跳过；准确配对官网42022785904八成功。11:31:31Z→12:00:10Z，1719秒/28分39秒，原60分钟时钟内一次完成。

- [本地准备](preparation.json)：版号/双语日志、原6项后端/15项版本日志、冻结安装/审计和生成固定点。
- [既有CI调查](ci-investigation.json)：真实Mac两失败、共享消费/结算合同审计及Windows不能重现的诚实边界，后续三平台定向复核通过，历史具体内因未知边界保留。
- [已交付实图复核](source-visual-review.json)：六张原真实页面图已实际查看；不是本轮公开包实页证明。
- [真实缓存库存](caches-before.json)：Intel条目仍存在，不把缓存当本版构建成功。

- [准备官网](preparation-website.json)/[实际资格](website-readiness.json)：同源八任务成功，331秒；正式发布的准确配对官网仍需独立确认。

- [Intel原生预检](intel-preflight.json)/[实际资格](intel-readiness.json)：精确f88、真实首次启动/重启与安装包成功；不移交debug产物到正式发布。

- [完整发布结果](release-result.json)、[原生终态](native-run.json)、[配对官网终态](website-run.json)：固定产品f88，控制workflow后续ccba与产品来源分开记录，准确父run/来源由原resolver日志验证。
- [正式Intel资格](intel-proof.json)：当前缓存命中、真实原生6分18秒及首次启动/重启、安装包校验；debug产物没有进入正式包。
- [公开回读](public-readback.json)：GitHub latest46、29资源、实际SHA256SUMS与28对象身份、5平台stable=immutable、18下载与唯一生成器一致；body精确来自冻结根双语日志。
- [实际公开包](published-cli-asset.json)、[真实运行](published-ui-runtime.json)、[正常关闭](published-ui-shutdown.json)、[独立物理清退](published-ui-physical-retirement.json)：145148318字节真实Windows基线包、exe46，原五分钟预算内结算并清退两进程/一监听和临时root。
- [人工实页记录](manual-review.json)：实际包中英文日志、首页示例确认/保留原草稿、官网双语全文和46下载入口共九张图，均实际查看；没有UI自动化或真实模型新请求。
- [另行CI资格](regular-ci-observation.json)：原f88全量CI三平台unit取消、汇总guard失败事实保留。后续用户授权的[定向准入](targeted-ci-admission.json)/[实际结果](targeted-ci-result.json)42050923716固定同源，8任务成功/1设计跳过；各平台两文件6项56断言通过。[Linux](targeted-linux.log)、[macOS](targeted-macos.log)、[Windows](targeted-windows.log)含真实输入、runner START/DONE、正向case和断言。该补充验证不等于全量套件通过。
- [历史保全](cleanup.json)、[前库存](release-inventory-before.json)/[后库存](release-inventory-after.json)：原21对象身份/日期/标志保持，新版后22对象，82历史日志保留；本轮没有失败候选需要清退。

## 真实页面

英文设置：[顶部](01-published-settings-en.png)、[完整限制](02-published-settings-en-limits.png)。中文设置：[顶部](03-published-settings-zh.png)、[完整限制](04-published-settings-zh-limits.png)。首页：[实际示例确认](05-published-home-confirm.png)、[保留未发送草稿](06-published-home-draft-preserved.png)。官网：[中文全文](07-published-web-zh.png)、[英文全文](08-published-web-en.png)、[46下载入口](09-published-download.png)。

原helper的notes-only标签不扩大为全产品资格：本次另查看一个自有空实例的首页取消路径，仍在同一五分钟期限内、没有发送消息/启动目标或复制凭据。未验证全部模型/历史/并发组合，macOS仍临时签名/未Apple公证。
