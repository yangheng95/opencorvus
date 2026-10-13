# 用量时间桶键盘详情验收

[Recall、完整根因/影响与迭代方案](../../records/2026-10/2026-10-13-usage-keyboard-details.md)。唯一实际/global/usage响应驱动真实桌面热力图；空真实账本、无凭据和模型请求，不注入假账单或官方响应。

## 真实桌面与人工截图复核

Windows桌面1280×720、中文和英文深色、生产源码listener/recovery的`/ui`、私有Node前端构建。全部下列合格截图已实际呈现并由主agent人工查看；没有UI自动化测试或DOM/像素断言。

| 阶段/实际交互 | 证据与结果 |
| --- | --- |
| 基线Today鼠标03:00 | [真实0与03:00提示](mouse-before.png)；[整体布局](today-before.png) |
| 基线刷新后Tab | [焦点跳过所有24桶到官方对账](keyboard-before.png)、[状态](keyboard-before.txt) |
| 初版Tab进入首桶 | [首桶完整区间与焦点](tab-settled-intermediate.png)，解决原不可达，但尚未解决Escape与快速刷新 |
| 初版Escape失败 | [popup仍在](escape-intermediate.png)、[状态](escape-intermediate.txt) |
| 次版快速Return→Tab失败 | [BODY焦点](fast-refresh-final.png)、[状态](fast-refresh-final.txt)，已加载状态的通过不足以覆盖此路径 |
| 最终快速刷新Tab | [年图首桶](rapid-refresh-complete.png)、[当前真实状态](rapid-refresh-complete.txt)；同一键盘Return→立即Tab实际停在同一个UL/listbox载体，见[keyboard-rapid-complete](keyboard-rapid-complete.txt)，再以前向键进入当前数据。未落BODY |
| 最终中文日桶 | [03:00–04:00 GMT+8／0 Token、可见焦点](day-zh-complete-settled.png)、[实际状态](day-zh-complete.txt) |
| 最终英文日桶 | [01:00 AM–02:00 AM GMT+8／0 Token](day-en-complete-settled.png)，正文、时刻、轴与日期按英文显示 |
| 最终年度方向 | [Jan1→Right Jan8→Down Jan9](year-cross-week-complete.png)、[状态](year-cross-week-complete.txt)；[末桶Dec31→Jan1与尾部边缘](year-end-complete.png) |
| 最终月/周 | [Oct31→Nov1](month-complete.png)、[状态](month-complete.txt)；[Oct18→Oct19](week-complete.png)、[状态](week-complete.txt)，集合载体保持，数据与检查项退休 |
| 最终Escape | [提示关闭且03:00桶焦点保留](escape-complete-settled.png)、[状态](escape-complete.txt) |
| 最终单个Tab入口 | [Tab到对账、Shift+Tab回03:00](tab-complete.txt)，不引入365个Tab停靠点 |
| 当前项点击 | [实际LI/option仍aria-selected=true](current-selection-complete.json)，验证外部唯一state的非空策略 |

鼠标与键盘同桶03:00区间在第二版实际复核，同一最终Tooltip实现保留；最终版本另有完整中文/英文图与方向复核。早期快速连续工具调用的截图有尚未绘制到最新AX状态的帧；这里只引用另一次实际呈现并人工查看的settled截图，不拿AX文本代替像素。未捕获空year的loading帧或错误帧，未实测其他时区/非零账本在页面的渲染、屏幕阅读器、浅色、移动端或外部被动刷新删除当前LI后的焦点；不能把源码/类型证明扩称这些视觉场景。时区边界的真实数据归属由上批正向合同和HTTP证据证明，本批不重造统计窗口。

## 数据、构建与工具

[usage-stats正向数据回归](usage-contracts.log)：30测试/238断言、0失败、真实runner exit0。生产统计/账本和API字段未修改；它不代替上述实页验收。命令为Bun1.4.0运行`packages/opencorvus/script/run-tests.ts test/usage/usage-stats.test.ts`。

[初版类型失败](types-after.log)揭示renderItem普通node被误当accessor；修正后原类型检查重跑，最后[state版本类型](types-complete.log)实际exit0。最终Node私有[构建](build-complete-summary.log)exit0，最终格式、国际化和文档检查在本spec补记。一次Prettier路径失误已在根目录重跑，源码未变；没有跳过检查。

最终三个UI文件Prettier与范围git diff --check通过；[i18n](i18n-complete.log)两语言2178键、[docs checker](docs-complete.log)348操作/26组均实际exit0。键数与API操作数包含并行任务已交付的目录/接口，本批没有新增翻译键或服务端API。

## 自有服务物理退出

四scope各有独立空运行目录与私有UI：before原exec78045、intermediate46614、after39609、complete29366均实际exit0，全部先关自有tab再由生产runtime.stop释放listener。对应各阶段`*-ready.json`与`*-terminal.json`保留；[物理复核](physical-closure.json)四个原PID均退出、18573无listener，未关闭任何用户进程或窗口。

没有版本变更、Release、tag、官方管理凭据或GPT-6.1 Sol调用。本批为UI修复；官方partial成本/负余额/空事实状态三个候选仍未获得真实官方及页面验收。
