# 208 Sources 的可见来源身份

## Recall

用户要求持续自主迭代，重点为 Sources 显示，最新只用单agent。[实施前方案](../source-reading-audit-plan-208.md) 记录现象、触发、数据流、旧路径不足、唯一实现/公共合同与全仓调用调查。基线为已推送d63f937c，后台自2f63未变。只改SourceParts.tsx与messages.css的网页来源呈现，未创建模型任务、消息、UI自动化测试或Provider请求。

完整原153历史准入：[清单](../source-reading-audit-startup-208.json)、[90表实际行内容一致](live-01/source-reading-audit-208-01-history-copy.json)、[真实生产HTTP准入](live-01/actual-http-readiness.json)。Run `C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-09/source-reading-audit-208-01`，port18128；researcher仍为ses_hMlVNrRdOLxQf4XhSds7。无凭据的配置提示与隔离范围一致，不是用户auth故障或新的模型验收。

## 真实问题和当前实现

第一Source展开前后都只有标题，完整地址需悬浮/keyboard focus（键盘焦点）才能识别，顶部工具行URL本身也省略。当前网页Source叶子显示完整可换行title，下面显示相同规范URL的host，包括端口；无title/provider猜测。真实链接与Tooltip detail不变，file/document/snippet和分组/数量/排序不变，没有第二metadata或消息事实。

| 真实场景 | 当前证据与结论 |
| --- | --- |
| 改前第一来源 | [浅色展开](live-01/source-expanded-before.jpg)、[完整键盘Tooltip](live-01/source-keyboard-before.jpg)、[Dark](live-01/source-dark-before.jpg)，网址只在浮层 |
| 改后第一来源 | [Dark初始](live-01/source-dark-after-initial.jpg)，长标题下www.w3.org直接可见 |
| 三来源都展开 | [Dark](live-01/source-dark-after-all.jpg)、[浅色](live-01/source-light-after-all.jpg)、[真实观察](live-01/source-dark-after-facts.json)，两个W3C和MDN规范域名、完整标题/原URL |
| 键盘阅读 | [Dark焦点](live-01/source-dark-after-keyboard.jpg)、[浅色完整浮层](live-01/source-light-after-keyboard.jpg)，原链接、完整title/URL/provider可读，阅读follow=false |
| 原链接真实打开 | [目标身份](live-01/source-destination.json)、[真实W3C目标页](live-01/source-destination.jpg)，点击产生自己的tab22；当前聊天仍保留 |
| 折叠及较窄桌面 | [实际截图](live-01/source-collapse-after.jpg)，当前真实分组/来源仍可读，不作为移动端资格 |

全部上述目标区域截图已人工查看，DOM观察不作为UI自动化断言。最后构建49.43s/退出0，overlay类型检查工具51327退出0，实际构建工具63333退出0，renderer public surface1/1通过。[原生产请求日志](live-01/source-reading-audit-208-01-runtime.log) 记录21:33:24.361Z最终 `/ui/assets/main-L1F0igr8.js`200；基线HTTP准入文件保留main-3EEyiWb9，不将其改写成新asset。

## 闭合和未知

原父工具90185退出0、[实际Native joined](live-01/source-reading-audit-208-01-launcher-native-joined.json) 为21:35:51.498Z exited/0，deadline1791495844599内完整physical/output/request清理。[独立闭合](live-01/source-reading-audit-208-01-independent-closure.json) 按精确Host68616/Target54068出生身份，端口/pair均关闭。自己页面21/22已关闭，原153没有重启。

原两个Project44/97项 [lstat元数据观察](source-project-metadata-after-208.json) 保持；这里只观察元数据，不宣称内容完整性。5份本轮FFI（Foreign Function Interface，外部函数接口）调试文件按精确出生时间及工作区边界移至私有目录，[移交记录](generated-native-observer-custody.json)保留。文档检查345ops/25groups通过。

主卡Open点击一次未显Dock的 [原观察](live-01/open-from-card-observation.jpg) 保留；活动栏相同会话可打开。原因未知，后续需真实调查，不能将没有响应误报为Source link失败：实际Source打开了正确独立目标页。多Source同组、file/document、无标题/invalid/带端口URL、长snippet、流式增长未在本轮真实数据验收；完整Rendering/全产品体验目标仍进行中。
