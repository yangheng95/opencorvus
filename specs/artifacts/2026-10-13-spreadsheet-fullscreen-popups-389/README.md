# 389 电子表格全屏弹层与关闭生命周期证据

对应[389规格](../../records/2026-10/2026-10-13-spreadsheet-fullscreen-popups-389.md)。真实页面交互与全部final图片人工复核由主 agent完成；audit_ui按明确清单归档，并独立查看关键失败、对话框输入/拖动、干净zoom、中文菜单、编辑数值及重挂载截图。没有UI自动化、截图基线或像素断言。

数据复用387自然发布的Desk budget：Chat `ses_h0VKkCl7hbz3BKHVW2Xp`，artifact `art_g0VXv65e1004ErsrwSJs`。389三个scope均为无凭据、无模型执行的独立18505 `/ui` 页面复核。原始数据为Notebook7、Pen5、Total12；最终同一实例编辑到9/5/14并实际下载。

## 关键前态与中间失败

| 证据 | 证明的实际行为 |
| --- | --- |
| [全屏工作表菜单不可见](screenshots/before-fullscreen-sheet-menu.png)、[节点归属](observations/before-fullscreen-sheet-menu.json) | 已打开菜单在body旁系，矩形在视口内。 |
| [全屏缩放菜单不可见](screenshots/before-fullscreen-zoom.png)、[Radix节点](observations/before-fullscreen-zoom.json) | 第二条Portal路径也落到body，不能只修主菜单。 |
| [第一次Enter可见](screenshots/before-color-first-enter-visible.png)、[第二次Enter隐藏](screenshots/before-color-second-enter-hidden.png)、[两次读值](observations/before-color-first-enter.json)、[第二次读值](observations/before-color-second-enter.json) | 非零几何相同，但重复激活把ready重置为hidden/none。 |
| [第一轮关闭残留](screenshots/after-fullscreen-zoom-menu.png)、[第一轮报告](observations/attempt1-review.json) | 主菜单关闭后色盘仍留在画面，和新zoom菜单同时存在；第一轮未通过。 |
| [第一轮菜单父链](observations/attempt1-fullscreen-menus.json)、[Dialog](observations/attempt1-fullscreen-dialog.json)、[布局/Popover](observations/attempt1-fullscreen-popover-grid.json) | display:contents宿主已进入fullscreen，但仍需修逻辑子树关闭和事件归属。 |

## 最终实际可用路径

[最终人工复核摘要](observations/final-review.json)标明操作、限定范围和物理退出信息；它是人工归纳，不冒充原始浏览器输出。

| 路径 | 截图/观察 |
| --- | --- |
| 全屏首次及重复Enter | [首次](screenshots/final-fullscreen-first-enter.png)、[重复](screenshots/final-fullscreen-repeat-enter.png) |
| Dialog实际输入336699→RGB51/102/153；拖动hue到8d3399并内部wheel | [输入](screenshots/final-fullscreen-dialog-input.png)、[拖动/滚动后](screenshots/final-fullscreen-dialog-pointer-wheel.png) |
| Dialog一次Escape回主菜单，再关闭父菜单后打开干净zoom | [Dialog结束保留主菜单](screenshots/final-dialog-escape-to-menu.png)、[父菜单结束后的zoom](screenshots/final-fullscreen-zoom-after-menu-close.png) |
| 真实颜色命令和撤销 | [应用颜色](screenshots/final-color-applied.png)、[原始style读值](observations/final-color-command.json)。工作表标签获得焦点时Ctrl+Z没有恢复；canvas获得焦点后Ctrl+Z恢复原style，这一操作边界不省略。 |
| 当前工作簿编辑及公式 | [B2=9、Total14](screenshots/final-edited-workbook.png)、[中文下同一编辑实例](screenshots/final-fullscreen-chinese-edited-menu.png) |
| 全屏中文Popover与Tooltip | [Popover](screenshots/final-fullscreen-chinese-popover.png)、[Tooltip](screenshots/final-fullscreen-chinese-tooltip.png)、[两行grid及固定定位矩形](observations/final-fullscreen-geometry.json) |
| 普通视图中文重复Enter、输入996633取消、外部zoom关闭旧菜单 | [重复Enter](screenshots/final-normal-chinese-repeat-enter.png)、[Dialog输入](screenshots/final-normal-chinese-dialog-input.png)、[外部zoom](screenshots/final-normal-zoom-external-close.png) |
| 普通视图滚动后的中文Tooltip | [截图](screenshots/final-normal-chinese-tooltip.png)、[滚动位置与viewport读值](observations/final-normal-tooltip.json) |
| 切换Chat后重新挂载的菜单 | [新实例菜单可用](screenshots/final-remounted-menu.png)。此时已回到发布值7/12和A1，不能当作未导出编辑跨Chat持久化的证据。 |

## 原始下载、构建与运行收尾

[浏览器实际下载CSV](downloads/final-edited-workbook.csv.gz)采用gzip保存，解压仍为原始61字节：UTF-8字节序标记，四行带引号CSV，行间CRLF，最后一行没有结尾换行。其内容是Item/Quantity、Notebook/9、Pen/5、Total/14。[实际导出检查](observations/final-export-check.json)保留精确字符串；[归档完整性检查](archive-check.json)证明压缩后可恢复同一份文件，不用源码摘要替代功能正确性。

[最终构建日志](logs/build-final.log.gz)记录50.95秒完成；[类型检查日志](logs/typecheck.log.gz)保留原输出，exit0由主 agent运行回执确认；[第一轮构建日志](logs/build-attempt1.log.gz)保留调查过程。Bun patch-commit及frozen-install成功来自主 agent工具回执；这里没有虚构一份独立终端日志。

| Scope | 物理收尾证据 |
| --- | --- |
| 前态tab25，PID84800，launcher16197 exit0 | [owner](logs/before/owner.json)、[ready/occurrence](logs/before/ready.json)、[terminal](logs/before/terminal.json)、[stdout](logs/before/stdout.log.gz)、[stderr](logs/before/stderr.log.gz) |
| 第一轮tab26，PID84648，launcher78924 exit0 | [owner](logs/attempt1/owner.json)、[ready](logs/attempt1/ready.json)、[terminal](logs/attempt1/terminal.json)、[stdout](logs/attempt1/stdout.log.gz)、[stderr](logs/attempt1/stderr.log.gz)。页面于10:43:46.661Z关闭，elapsed596202ms。 |
| 最终tab28，PID84148，launcher92626 exit0 | [owner](logs/final/owner.json)、[ready](logs/final/ready.json)、[terminal](logs/final/terminal.json)、[stdout](logs/final/stdout.log.gz)、[stderr](logs/final/stderr.log.gz)。页面于11:10:24.388Z关闭，occurrence为`c67b73cf-06e3-4ded-8a98-86955ef81782`，elapsed800601ms。 |

三个scope均由原owner的stop-requested正常结束，未杀进程。语言en→zh→en已恢复。时间为2026-10-13 UTC，不能混同本地显示时区。

## 准确边界与归档筛选

- 本次证明菜单、语言及全屏切换期间同一个已编辑实例保留9/14，CSV已导出。随后切到另一Chat再回来会重建工作簿并回到发布值7/12/A1；菜单在新实例可用。该观察单列后续UX调查，尚未完成持久化/未保存提示合同分析，不据此宣告期望行为或本轮已修复。
- `Sheet tabs`、`Close sidebar`、`Notifications alt+T`仍为英文可访问名称；More Colors仍是无href的a，取消后观察到body焦点。它们列后续，未声称本轮修复或判定为新增回归。
- 静态同合同覆盖不等于所有库组件逐一视觉通过；移动端、并发多实例、RectPopup默认id、不可达Gallery/HoverCard/DraggableList均不在本轮完整视觉范围。
- 排除失败拖移的before-normal-color-hover、加载中的final-other-chat以及第一轮未显示目标的after-normal-statistic-tooltip；也未泛拷贝其它Chat截图、构建资源、vendor、工具脚本、数据库、auth/models文件或运行环境。
- [清单](archive-manifest.json)记录每个原始来源和压缩方式；[归档检查](archive-check.json)记录链接、精确字节恢复及有限凭据模式扫描。扫描是归档安全检查，不是UI行为验收。
