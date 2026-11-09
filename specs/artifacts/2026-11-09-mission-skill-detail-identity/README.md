# Mission Skill 详情身份：真实桌面证据

对应[调查与方案](../../records/2026-11/2026-11-09-mission-skill-detail-identity.md)。隔离开发服务读取自有 Git 项目及实际内置目录。透传代理只延迟指定目录的真实设置响应，不改写状态、响应内容或请求；本人逐张查看桌面原图，没有界面自动化测试。

| 前态截图 | 复核所见 |
| --- | --- |
| 01 | 英文查询 `built-in general` 后进入同名内置技能，焦点落在正确标题。 |
| 02 | 切换简体中文后，只显示列表无匹配，详情和返回入口一同消失。 |
| 03 | 刷新等待时，打开仍在已接受目录中的 `inspection-demo`。 |
| 04 | 15 秒延迟触及请求时限；真实加载失败仍显示原详情。这张图不是成功替换的证据。 |
| 05 | 5.5 秒延迟内成功读到只有 `general` 的目录，原详情被静默替换为 `general`。 |

| 候选截图 | 复核所见 |
| --- | --- |
| [06](after-06-general-en.jpg) / [07](after-07-general-zh-language-changed.jpg) | 中英文都显示精确的 `general`、对应调用和返回入口。 |
| [08](after-08-filtered-return-search-focus.jpg) / [09](after-09-cleared-search-zh.jpg) | 返回保留英文查询，焦点落在现有中文搜索；清除后恢复两个真实条目。 |
| [10](after-10-pending-focus-on-copy.jpg) | 刷新期间打开真实项目技能，焦点进入原复制按钮。 |
| [11](after-11-missing-zh-focus-on-heading.jpg) / [12](after-12-missing-en.jpg) | 成功刷新移除条目后，中英文失效提示保留原名与返回，移除的操作焦点回到标题。 |
| [13](after-13-return-to-search-after-removal.jpg) | 返回保留 `inspection-demo` 查询并聚焦搜索框。 |
| [14](after-14-restored-row.jpg) / [15](after-15-restored-detail.jpg) / [16](after-16-restored-row-focus.jpg) | 恢复文件后，原行、原路径及原调用重新可见，返回定位到同一行。 |

[前态代理记录](before-proxy.jsonl)和[候选代理记录](after-proxy.jsonl)包含真实成功响应及恢复；[前态](before-direct.json)和[候选](after-direct.json)各包含 3 项直接接口/运行时 schema 校验。[数据复核](owned-final-check.json)记录原文件与无执行数据。
