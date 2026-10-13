# 396 焦点读位与394联合后态证据

对应[396规格](../../records/2026-10/2026-10-13-spreadsheet-focus-scroll-396.md)与[394规格](../../records/2026-10/2026-10-13-spreadsheet-permission-panel-locale-394.md)。本目录是394/396最终真实后态的唯一归档；394前态与首次失败另见[394证据](../2026-10-13-spreadsheet-permission-panel-locale-394/README.md)。root实际操作tab37并人工查看截图；audit_ui按明确清单归档，并独立看过中间未改值及失败范围粘贴图。没有UI自动化测试。

复用真实Desk budget，所有页面/服务均无凭据、无新模型执行。[最终人工摘要](observations/final-review.json)明确区分成功、失败和剩余边界，不冒充原始浏览器输出。

## 普通视图真实动作

| 路径 | 证据与限定结果 |
| --- | --- |
| Add滚入可见后单次鼠标点击 | [点击前](screenshots/after-before-add-visible.jpg)、[进入Detail](screenshots/after-add-detail.jpg)、[前几何](observations/before-add-geometry.json)、[后几何](observations/after-add-geometry.json)、[AX](observations/after-add-ax.txt)。Chat scrollTop前后均724.6666870117188；隐藏DOCS_NORMAL仍获焦，证明保持真实focus同时抑制祖先滚动。 |
| 真实重叠checker与双向语言 | [英文](screenshots/after-en-overlap.jpg)、[中文](screenshots/after-zh-overlap.jpg)、[英文AX](observations/en-overlap-ax.txt)、[中文AX](observations/zh-overlap-ax.txt)、[反向英文AX](observations/en-reverse-ax.txt)。通过可见范围弹窗产生A1:A2/A2:A3，标题/错误同步，LOCALE-394/396 temporary、范围和选项保持。 |
| 合法范围真正permission Confirm | [合法范围AX](observations/legal-range-ax.txt)、[创建规则英文](screenshots/after-created-rule-en.jpg)、[英文AX](observations/created-rule-en-ax.txt)、[切中文列表](screenshots/after-created-rule-zh.jpg)、[中文AX](observations/created-rule-zh-ax.txt)。真实本地Univer规则已创建并返回列表，第二标题producer通过。 |
| 只删除本次临时规则 | [正向空态AX](observations/temporary-rule-cleaned-ax.txt)确认本次规则已移除；没有把Cancel当成规则提交/返回列表。 |
| 正常单元格编辑和公式 | [实际9/5/14](screenshots/after-normal-paste-9-5-14.jpg)、[编辑后AX](observations/edited-via-paste-ax.txt)。双击B2、选中文本、paste9、Return成功，Total自然重算14。 |
| B20内部reveal与返回 | [初次目标](screenshots/after-internal-navigation-B20.jpg)、[手动Chat滚动后看见目标](screenshots/after-B20-internal-target-visible.jpg)、[AX](observations/internal-navigation-B20-ax.txt)、[前](observations/internal-navigation-before.json)/[后](observations/internal-navigation-after.json)。Name Box B20后Chat scrollTop均285.3333435058594；canvas底部被composer裁住，root另手动滚Chat查看，不把该手动步骤算作自动滚动。随后实际返回B3。 |

## 全屏和保留失败

[干净范围弹窗产生的中文重叠错误](screenshots/after-fullscreen-dialog-overlap-qualified.jpg)及[对应AX](observations/fullscreen-dialog-overlap-qualified-ax.txt)是全屏正式checker证据；全屏实际菜单/Add可用，观察到9/5/14，最后Cancel未保存详情。不能凭全屏截图扩大为跨视图编辑持久化合同。

以下原始失败保留，不能按文件名或出现错误字样追认为成功：

- [after-normal-edited](screenshots/after-normal-edited.jpg)与[after-normal-edit-confirmed](screenshots/after-normal-edit-confirmed.jpg)仍显示7/5/12；直接按键/typeText9没有改值。真正成功是后续明确双击选中后paste的9/5/14及实际CSV。
- [全屏直接粘贴](screenshots/after-fullscreen-range-paste.jpg)、[离焦后](screenshots/after-fullscreen-range-blurred.jpg)及[原始AX](observations/fullscreen-range-ax.txt)含连接/重复的范围文本，没有按预期替换原B3。该实验取消，再用新的干净可见Dialog完成正式重叠输入，不把这两图当作精确两范围证明。
- [键盘Add观察](observations/keyboard-add-observation-ax.txt)：实际Enter仍交还DOCS_NORMAL，A1→A2且List不切换，读位保持约706.66。396只修滚动，键盘激活未通过，独立记录在[397方案](../../records/2026-10/2026-10-13-spreadsheet-button-focus-397.md)。
- 首次Node内联CSV检查因PowerShell引号失败，未完成检查；随后保存[原检查脚本](implementation/final-review.mjs)，对同一实际下载成功核对。该脚本仅是历史工具证据，不应重跑修改旧review时间。

已观察的规则hover浅底浅字留398独立线索；不在396修色或宣称可读性已完成。More Colors无href/取消后body焦点、独立Docs、移动端、多实例、完整IME与所有导航类型均未资格化。

## 真实下载与原始字节

[edited-normal.csv.gz](downloads/edited-normal.csv.gz)解压为实际浏览器下载61字节；[字节检查](observations/csv-byte-review.json)和[最终英文AX](observations/final-en-ax.txt)对应当前已编辑9/5/14。文件带UTF-8字节序标记，四行双引号CSV、三处CRLF，末行无终止换行。gzip防止Git换行规范化；归档重新核对准确内容和源字节，不使用源码hash代替功能正确性。

## 实施、构建与正常结束

[四方法变化清单](implementation/vendor-files.json)、[作用域脚本](implementation/apply-vendor.mjs)、[独立静态复核](implementation/independent-review.json)、[docs-ui补丁快照](implementation/docs-ui.patch.gz)记录唯一隐藏输入focus使用preventScroll:true，公共focus():void、内部导航与其它原生控件保持。没有保存完整vendor runtime。

正常[patch prepare](logs/patch-prepare.log.gz)、[patch-commit](logs/patch-commit.log.gz)、[frozen install](logs/install.log.gz)、[类型检查](logs/typecheck.log.gz)、[构建](logs/build.log.gz)及[文档检查](logs/docs-plan.log.gz)原输出保留；root的构建81426/type86767回执exit0，构建1m1s，已有大chunk提示未冒称消失。最终共享索引与提交检查仍由root负责。

最终scope PID38364、launcher53861实际join exit0；[owner](logs/final/owner.json)、[ready](logs/final/ready.json)、[terminal](logs/final/terminal.json)、[stdout](logs/final/stdout.log.gz)、[stderr](logs/final/stderr.log.gz)记录occurrence `8706e3cf-1df4-415e-99d9-25d4a34c6cc9`，elapsed1028915ms，在原20分钟期限内正常结束。没有杀用户进程、延长期限或模型执行。

[页面关闭记录](observations/page-closed.json)保留英语恢复、临时规则删除和未保存全屏详情取消。请求时间2026-10-13T14:30:39.819Z，事后确认记录14:32:39.348Z，closeToolFulfilled=true；这两个字段不冒充同一个精确物理关闭时刻。root确认自有tab37关闭后按原owner正常停止。

## 文件选择与安全检查

本轮工具截图都是JPEG原始字节；源名`.png`仅后缀不符，归档用`.jpg`且未编辑图像。[允许清单](archive-manifest.json)保留全部14张的源名、字节数、路径和资格化说明；AX/几何/人工review与明确失败同存。所有日志、CSV和patch用gzip保留原字节。

[归档检查](archive-check.json)包含原字节恢复、JPEG格式、有限凭据模式扫描和本地链接核对。未复制构建资产、运行环境、CanonicalDB、auth/models或私有凭据。以上是归档安全与完整性检查，不是UI自动化，不替代root的实际页面和截图复核。
