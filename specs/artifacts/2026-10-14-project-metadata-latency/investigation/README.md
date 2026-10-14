# 真实慢扫描复现与共享范围

[完整原件清单](manifest.json)包括五个有限Git根、25条原Git/Native阶段、80个真实开发服务内部请求的原ready/settled、原HTTP客户端输入输出、当前Node构建、原服务日志/结算、工具和五张直接可看的原JPEG；本目录证明复现，产品修复尚未实施。

control/healthy/self/ancestor的status分别153/266/386/278ms；combined44462ms、1759892B stdout、11361条untracked。实际TCP对照path/vcs均200且vcs约770ms；combined客户端15004ms TimeoutError，独立完整读取62838ms后200、22722条untracked。初始化正常新增的项目元数据文件使公开读取与初始纯Git输入不同，不能混为同一输出。后台12次vcs均最终200，其中5次约45–64秒；后台200不改写客户端超时。

- [01对照英文](ui/01-control-runtime-en.jpg)：实际正确分支与4个未跟踪项。
- [02首次超时](ui/02-combined-timeout-first-en.jpg)、[03英文](ui/03-combined-timeout-en.jpg)：真实Git状态不可用。02请求截图时原意为Loading，但捕获时已经超时，归档前仅改准确文件名，像素未修改。
- [04中文](ui/04-combined-timeout-zh.jpg)：中文摘要与原技术诊断。
- [05切回对照](ui/05-control-restored-zh.jpg)：正确control分支/4个未跟踪项恢复。

五图均由Root在自有IAB4 Tab6实际交互、显示并人工查看，无UI自动化。错误原文在当前容器内分为三行，具体布局原因尚未分析，不包装为布局已合格。最终页面关闭，普通shutdown200、原38943工具/Native/parent0，原80内请求全部settled且active_processes0，原整个Job物理/输出/request fulfilled；05是对照恢复，combined没有恢复资格。

原NDJSON（Newline-Delimited JSON，按行分隔的JSON）错误级别为0，仍有真实页面失败；日志洁净不能替代UI或功能。内部Native markers不提供每个Git退出码/正文，局部25阶段才保原code/stdout及三joins。旧163秒实例的精确inner身份、Task/Mission/Capsule运行、跨scope与全恢复矩阵仍未资格。没有凭据/模型目录副本或新模型消息；数据库、运行home、Git根及私有bin/UI不在归档。
