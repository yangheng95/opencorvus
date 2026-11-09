# 多步任务技能局部问题证据

对应[Recall、实施前分析与真实验收](../../records/2026-11/2026-11-09-mission-skill-catalog-issue-details.md)。截图为本人复核的真实开发桌面 1280×720 原图。

- 前态：[01 中文页面的混合语言诊断](01-before-zh-three-raw-issues.jpg)、[02 搜索的可用结果在诊断下方](02-before-zh-healthy-search-below-issues.jpg)、[03 正常详情也被目录诊断占用](03-before-unrelated-issues-in-healthy-detail.jpg)。
- 后态：[04 英文分类及原路径](04-after-en-typed-catalog-warning.jpg)、[05 英文展开原诊断](05-after-en-expanded-original-diagnostics.jpg)、[06 中文分类和真实搜索](06-after-zh-typed-warning-and-search.jpg)、[07 中文展开原诊断](07-after-zh-original-diagnostics.jpg)、[08 正常技能详情](08-after-clean-healthy-skill-detail.jpg)、[09 键盘返回原技能](09-after-back-restores-exact-row-with-issues.jpg)。
- 修正：[10 仅退役已修正问题并出现新技能](10-after-repair-refresh-retires-only-fixed-issue.jpg)、[11 新技能仍指向实际文件](11-after-repaired-skill-exact-source.jpg)。
- [前态接口](before-tcp.json)、[后态接口](after-tcp.json)、[文件修正后接口](repaired-tcp.json)、[前态启动](before-startup.json)、[后态启动](after-startup.json)、[自有项目原始文件](seed.json)、[持久化核对](owned-final-check.json)、[真实接口检查器](check-project-tcp.mjs)、[临时文件修正脚本](repair-local-skill.py)、[数据核对脚本](audit-owned-data.py)。
