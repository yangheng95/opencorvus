# 394 权限面板语言证据

对应[394规格](../../records/2026-10/2026-10-13-spreadsheet-permission-panel-locale-394.md)。本目录只保存394真实前态、首次后态的交互阻塞、五vendor文件范围及实施检查。最终394/396联合后态统一放在[396证据](../2026-10-13-spreadsheet-focus-scroll-396/README.md)，不复制第二份结果。

真实产物为387自然发布的Desk budget；Chat `ses_h0VKkCl7hbz3BKHVW2Xp`、artifact `art_g0VXv65e1004ErsrwSJs`。root使用无凭据18505 `/ui`正常服务并人工看图，未启动模型、未运行UI自动化。audit_ui只读实现复核和按明确清单归档。

## 前态与未通过的首次后态

| 证据 | 限定事实 |
| --- | --- |
| [前态详情](screenshots/before-detail-en.jpg) | 原详情入口可呈现；此单图不证明同实例语言往返。 |
| [普通视图英文重叠](screenshots/before-normal-dialog-overlap-en.jpg)、[实际AX](observations/before-en-normal-overlap-through-dialog-ax.txt) | 经可见Select data range弹窗A1:A2/Add range/A2:A3/弹窗Confirm进入真实checker；不是permission Confirm。 |
| [同实例切中文](screenshots/before-normal-dialog-overlap-zh.jpg)、[实际AX](observations/before-zh-normal-overlap-through-dialog-ax.txt) | 标题Protect Rows and Columns与Range cannot overlap残留英文，而正文更新中文，范围和LOCALE-394 normal保留。 |
| [首次后态普通Add阻塞](screenshots/after-ordinary-focus-blocked.jpg)、[实际AX](observations/after-ordinary-focus-blocked-ax.txt) | 滚入可见的Add未进入详情，焦点回隐藏编辑器、Chat读位跳动。该轮没有通过；不据此推断标题相同导致缓存忽略。 |

原先直接输入/全屏中间尝试未用作上述同实例前态的依据；仅保留目标明确的四图和对应AX。新增focus问题另见[396规格](../../records/2026-10/2026-10-13-spreadsheet-focus-scroll-396.md)，最终普通Add成功后才完成394联合后态。

## 实施与检查

[五vendor清单](implementation/vendor-files.json)、[作用域修改脚本](implementation/apply-vendor.mjs)、[独立静态复核](implementation/independent-review.json)和[补丁快照](implementation/sheets-ui.patch.gz)记录四runtime及一个MainPart声明的精确范围。没有复制完整vendor runtime。快照保留392既有补丁；本批两标题producer改语言键，Detail从当前ranges派生错误，MainPart只回传范围，原checker算法和string/undefined合同保持。

正常[patch-commit](logs/patch-commit.log.gz)、[frozen install](logs/install.log.gz)、[typecheck](logs/typecheck.log.gz)及[构建](logs/build.log.gz)由root工具回执确认exit0，构建日志为1m6s，仍有原有大chunk提示。保留[方案文档检查](logs/docs-plan.log.gz)与[实施后文档检查](logs/docs-plan-after.log.gz)；最终索引/提交检查由root执行。静态检查不代替页面验收。

## 两轮正常物理收尾

| Scope | 原始回执与root报告 |
| --- | --- |
| 394-before PID85496、launcher77488 exit0 | [owner](logs/before/owner.json)、[ready](logs/before/ready.json)、[terminal](logs/before/terminal.json)、[stdout](logs/before/stdout.log.gz)、[stderr](logs/before/stderr.log.gz)。occurrence `5e86f4d8-a72f-4bc6-b96b-88a8c9f2ca95`，elapsed520111ms。 |
| 首次394-after PID83648、launcher8713 exit0 | [owner](logs/failed-after/owner.json)、[ready](logs/failed-after/ready.json)、[terminal](logs/failed-after/terminal.json)、[stdout](logs/failed-after/stdout.log.gz)、[stderr](logs/failed-after/stderr.log.gz)。occurrence `7811a200-aeb7-4aa4-808f-2182ccbe264b`，elapsed784528ms。 |

terminal原文确认原process正常settled、listener停止和runtime handoff释放；launcher exit0来自root实际join回执。没有延长固定期限、杀用户进程或使用模型凭据。最终联合后态的owner只在396目录归档。

## 归档安全与边界

截图原工具返回JPEG字节，scratch虽使用`.png`后缀，本目录按实际格式命名`.jpg`，未重编码或改像素。[允许清单](archive-manifest.json)逐项保留原source路径/文件名、字节数和压缩方式；日志/patch以gzip保留原字节。[归档检查](archive-check.json)记录恢复、有限凭据模式扫描和本地链接检查，这不是UI自动化或功能验收。

没有复制构建资产、完整运行环境、Canonical数据库、auth/models或用户凭据。当前仅资格化桌面权限标题与已触发重叠错误；其它错误类型、Numfmt/DefinedName快照、移动端、独立Docs及完整输入法未通过本批。键盘Add由397独立跟进，规则hover颜色由398单列；最终状态以[396唯一人工摘要](../2026-10-13-spreadsheet-focus-scroll-396/observations/final-review.json)为准。
