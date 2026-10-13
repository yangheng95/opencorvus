# 长行读取的完整字符边界证据

依据 [Recall与方案](../../records/2026-10/2026-10-13-text-unicode-boundary-380.md)。两名只读agent分别调查UI和功能，主agent复核根因、实施、真实桌面验收及提交。未创建或运行UI自动化测试。

## 功能与真实运行

- 改前正式runner：18项中12pass/6fail；改后18项及来源范围2项共20pass/74断言。最终使用Bun1.4.0真实隔离runner重跑，exit0；字符串和真实文件流、普通Read、Skill及MissionSkill完整工具输出均覆盖。
- 后端类型检查exit0。文档与架构检查见同目录日志。没有UI源码改动；真实页面使用377正式私有产物，当前后端代码执行本轮Read。
- 两个真实模型轮次各一次read、一个真实Source。独立 [数据检查器](check-live.mjs) 核对完整持久化output/preview、实际模型输入参数、Source及原文件全文，而非只验证模型自述。结果见 [runtime-check.json](runtime-check.json)。
- 最终scope原launcher11757、shutdown18857、类型96050均exit0；实际243281ms，5次gpt-6.1-sol流式HTTP200/EOF，固定600000ms/12请求内。完整Host/Native/output/request与配对凭据清理闭合。

## 人工视觉复核

| 实际截图 | 观察 |
| --- | --- |
| [原轮工具边界](03-tool-boundaries.png) | 1440×900桌面上横向滚动工具输出，第一行a后接截断提示，第二行保留🙂。 |
| [最终来源文件](04-final-source.png) | 点击真实Source打开同一物理文本，工作台原文加载成功。 |
| [最终原文件尾部](05-final-source-tail.png) | 编辑器Ctrl+End进入完整第二行emoji和tail、第三行；没有编辑或保存。 |
| [最终工具边界](06-final-tool-boundaries.png) | 1280×720桌面实看两种边界；第二行完整emoji与截断提示清晰。 |

截图均逐张人工查看。其余调查截图也保留在完整证据压缩包中，不把初始设置页观察当成代理修复验收。

## 原中断与范围限制

第一scope在模型完成、工具截图成功后丢失原exec/Host/Target，原文件Source当时只到Loading。原正常退出、原输出排空和原文件视觉未达成；因果来源未知。共享生产orphan recovery实际inspected1/removed1后才清理该scope配对副本，属于恢复后custody清理。原回执与最后观察保留，最终新scope通过不覆盖这一失败。旧不可达浏览器页面读取遭URL策略拒绝，未绕过；最终自有正常页面已关闭。

本轮未验收Tauri原生窗口、其它操作系统或真实模型调用两种Skill family，不把后端工具测试外推为这些端到端结果。原始非法Unicode、字形组合簇、文件编码判别不是本次截断合同。没有版本升级、Release或部署。

[完整脱敏运行证据](evidence.zip) 保存两个scope的规范数据、完整服务日志、功能测试前后输出、前期无凭据服务收尾、生产恢复身份回执与最终正常关闭事实；不包含auth/models内容或私有原始监督请求文件。
