# 专家团目录诊断披露与续页证据

对应[Recall、实施前根因及验收](../../records/2026-11/2026-11-09-expert-squad-diagnostic-disclosure.md)。截图为本人复核的真实开发桌面 1280×720 原图。

- 前态：[01 首屏被诊断占满](01-before-diagnostics-push-valid-catalog-below-fold.jpg)、[02 普通续页按钮](02-before-generic-diagnostic-continuation.jpg)、[03 终页成功但焦点丢失](03-before-terminal-continuation-loses-keyboard-focus.jpg)。
- 英文：[04 折叠后首屏可用目录](04-after-en-collapsed-summary-keeps-catalog-visible.jpg)、[05 专用诊断续页](05-after-en-specific-diagnostics-continuation.jpg)、[06 首条新增诊断焦点](06-after-terminal-page-focuses-first-new-diagnostic.jpg)、[07 键盘打开原错误](07-after-first-new-diagnostic-expands-from-keyboard.jpg)、[08 正常 Dynamic 详情](08-after-normal-dynamic-detail-while-diagnostics-were-open.jpg)、[09 返回保留已展开终页与原行](09-after-return-preserves-expanded-page-and-exact-row.jpg)、[10 主动收起回首屏](10-after-close-restores-catalog-first-screen.jpg)。
- 中文：[11 诊断计数和正常目录](11-after-zh-count-and-healthy-list.jpg)、[12 终页聚焦并展开真实错误](12-after-zh-terminal-focus-opens-original-diagnostic.jpg)。
- [前态读接口](before-tcp.json)、[后态读接口](after-tcp.json)、[前态安装](before-installations.json)、[后态安装](after-installations.json)、[前态启动](before-startup.json)、[后态启动](after-startup.json)、[原始项目数据](seed.json)、[持久化核对](owned-final-check.json)、[安装准备器](install-owned-payloads.mjs)、[实际接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
