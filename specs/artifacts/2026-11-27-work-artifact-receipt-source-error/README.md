# 工作文件收据来源错误真实证据

对应[规格与 Recall](../../records/2026-11/2026-11-27-work-artifact-receipt-source-error.md)。不收录凭据或未脱敏旧历史。

- 本人真实页面交互并逐张看过：[中文摘要](error-zh.png)、[中文完整诊断](error-zh-details.png)、[英文摘要](error-en.png)、[英文完整诊断](error-en-details.png)。原始工具失败自然保留，短摘要/提示/详情控件随当前语言切换；用户/模型原文保持。
- [真实交付/下载/历史检查](run26-delivery-check.json)、[正式产物](run26-delivered-artifact.json)、[自然失败及恢复工具结果](run26-actual-tool-parts.json)、[只读检查器](check-delivery26.py)。真正最终收据来源错误与结构化身份完整，随后用真正校验收据成功交付；17文件/884旧行/16259字节原件保留，实际浏览器下载原字节相同。
- [原生修复前失败](native-red.log)、[原生修复后通过](native-green.log)、[后端类型](backend-types.log)、[正常构建及公开界面检查](overlay-build.log)。1个完整原生用例6正向断言，不含UI自动化；构建警告原样保留。
- [实际请求审计](run26-model-request-audit.json)、[运行总结](runtime-summary.json)、[运行时](run26-runtime.json)、[原句柄退出](run26-process.json)、[实际指定的最终收据](final-receipt-input.json)、[真正的历史校验收据](prior-validation.json)。6次精确流式Sol结清，原句柄退出0，自有端口关闭、成对副本退役。

历史普通Error保留其真实旧事实，不以英文关键字重分类；PowerPoint原生编辑数据仍受首次账户向导阻挡，未操作认证或许可界面。
