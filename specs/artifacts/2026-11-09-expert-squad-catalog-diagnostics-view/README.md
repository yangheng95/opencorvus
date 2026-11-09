# 专家团目录与详情诊断的真实桌面证据

对应[Recall、实施前根因及验收](../../records/2026-11/2026-11-09-expert-squad-catalog-diagnostics-view.md)。截图为本人复核的真实开发桌面 1280×720 原图。

- 前态：[01 中文原始错误在主界面](01-before-zh-catalog-mixes-raw-diagnostics.jpg)、[02 无关 Dynamic 详情带目录诊断](02-before-unrelated-diagnostics-in-dynamic-detail.jpg)、[03 当前遮蔽反馈重复](03-before-shadowed-detail-has-duplicate-catalog-feedback.jpg)。
- 验收环境：[04 隔离服务先冻结了上批资源](04-intermediate-server-captured-prior-bundle.jpg)，重新启动并确认新资源后验收。
- 英文：[05 本地化摘要和原目录](05-after-en-typed-list-diagnostic.jpg)、[06 键盘展开原始错误](06-after-en-expands-original-package-error.jpg)、[07 无关 Dynamic 正常详情](07-after-en-unrelated-dynamic-detail.jpg)、[08 返回原行并保留诊断](08-after-en-return-keeps-catalog-diagnostics.jpg)。
- 中文：[09 中文目录与原始错误](09-after-zh-list-keeps-path-and-original-error.jpg)、[10 全局安装自身的遮蔽提示](10-after-zh-shadowed-installation-keeps-own-feedback.jpg)、[11 返回保留筛选和目录诊断](11-after-zh-return-preserves-filter-and-diagnostics.jpg)、[12 项目包原详情](12-after-zh-project-detail-keeps-normal-selection.jpg)。
- [前态真实读接口](before-tcp.json)、[后态真实读接口](after-tcp.json)、[前态安装回执](before-installations.json)、[后态安装回执](after-installations.json)、[前态启动](before-startup.json)、[初次后态启动](after-startup.json)、[最终后态启动](after-final-startup.json)、[原项目数据](seed.json)、[持久化核对](owned-final-check.json)、[安装准备器](install-owned-payloads.mjs)、[接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
