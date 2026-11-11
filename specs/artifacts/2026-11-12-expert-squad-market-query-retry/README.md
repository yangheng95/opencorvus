# 专家团市场推荐读取和原位重试的证据

- 新建多步任务中，已安装目录成功后仍可见[市场等待](01-baseline-en-mission-market-pending.png)。[失败](02-baseline-en-mission-market-failed.png)只显示原传输字符串。改写查询后[恢复市场建议](03-baseline-en-mission-market-recovered.png)。
- 输入区的[已安装结果](04-baseline-en-composer-market-pending.png)可见时，市场可[独立失败](05-baseline-en-composer-market-failed.png)。重新输入后[恢复建议](06-baseline-en-composer-market-recovered.png)。
- [真实基线回执](baseline-market-search-evidence.json)记录两处的真实请求和正式接口校验。
- 英文新建表单显示[市场等待](07-candidate-en-mission-market-pending.png)、[错误和重试](08-candidate-en-mission-market-failed.png)、[原始诊断](09-candidate-en-mission-market-details.png)、[重试中](10-candidate-en-mission-market-retrying.png)和[恢复与搜索焦点](11-candidate-en-mission-market-recovered.png)。
- 输入区的英文[失败](12-candidate-en-composer-market-failed.png)、[重试](13-candidate-en-composer-market-retrying.png)和[恢复](14-candidate-en-composer-market-recovered-focus.png)，以及中文[失败](15-candidate-zh-composer-market-failed.png)、[重试](16-candidate-zh-composer-market-retrying.png)和[恢复](17-candidate-zh-composer-market-recovered-focus.png)，均保持已安装结果。已送达的 Translation 在旧 Audit [送达前](18-candidate-zh-composer-new-query-before-release.png)和[送达后](19-candidate-zh-composer-new-query-after-release.png)均为当前结果。
- 中文新建表单的[失败](20-candidate-zh-mission-market-failed.png)、[重试](21-candidate-zh-mission-market-retrying.png)和[恢复](22-candidate-zh-mission-market-recovered.png)保留原选择。随包专家团实际安装到临时项目后成为[可选项](23-candidate-zh-market-install-project-selection.png)，市场[重新读取可安装建议](24-candidate-zh-market-install-recommendations-refreshed.png)。
- [候选市场查询回执](candidate-market-search-evidence.json)和[临时项目安装读回](candidate-market-install-evidence.json)对应真实接口、四次重试及较晚响应。

桌面截图由本人复核。[根因、影响及方案](../../records/2026-11/2026-11-12-expert-squad-market-query-retry.md)
