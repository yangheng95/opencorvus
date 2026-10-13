# 391 可编辑表格本地编辑说明证据

对应[391规格](../../records/2026-10/2026-10-13-spreadsheet-local-edit-guidance-391.md)。主 agent在独立tab29实际操作，并人工查看全部八张截图；audit_ui只读复核四文件实现、再次查看这八张图并归档。没有UI自动化测试、截图基线或像素断言。

沿用387自然发布的Desk budget：Chat `ses_h0VKkCl7hbz3BKHVW2Xp`、artifact `art_g0VXv65e1004ErsrwSJs`。本391使用当前私有构建和原owner管理的无凭据18505 `/ui` scope，无新增模型执行；没有把389旧图或旧下载算作391后态。

## 八张实际截图

| 证据 | 实际观察 |
| --- | --- |
| [普通英文编辑态](screenshots/normal-english-edited.png) | 提示自然换成两行，当前表格Notebook9。 |
| [普通中文编辑态](screenshots/normal-chinese-edited.png) | 提示一行，当前Notebook9、Pen5、Total14，语言切换仍保留当前编辑实例。 |
| [全屏英文初态](screenshots/fullscreen-english-initial.png) | 编辑前已经呈现说明，原发布7/12、A1选区；公式栏、网格和底栏完整。 |
| [全屏英文编辑态](screenshots/fullscreen-english-edited.png) | Notebook9、Total14，说明与原网格在同一个局部workspace中。 |
| [全屏中文编辑态](screenshots/fullscreen-chinese-edited.png) | 同一编辑实例保持9/14，提示跟随中文。 |
| [中文More Colors Dialog](screenshots/fullscreen-chinese-dialog.png) | 实际输入336699得到RGB51/102/153，之后取消；不把图片当作确认颜色写入。 |
| [普通视图滚动到底栏](screenshots/normal-chinese-footer.png) | 工作表标签、缩放等footer可见且布局没有被说明挤走。 |
| [切Chat后重新挂载](screenshots/remounted-chinese-published.png) | 切到Reply OK再返回，恢复A1/Notebook7/Total12，说明仍显示；没有声称跨Chat保存编辑。 |

[fullscreen-geometry.json](observations/fullscreen-geometry.json)的原始读值：viewport2560×1440、header64px、body/workspace1376px；说明矩形高30.666667938232425px（computed30.6667px），host矩形高1345.3333740234375px（computed1345.33px）、flex为1 1 0%、min-height0。不能将这些实测数简写为32/1344。

## 两份独立真实下载

| 原始产物 | 操作及数据 |
| --- | --- |
| [edited.csv.gz](downloads/edited.csv.gz)、[原始下载检查](observations/download-check.json) | 实际点击下载获得Downloads中的`Desk budget - 清单 (2).csv`；61字节，Notebook9/Pen5/Total14。 |
| [published-keyboard.csv.gz](downloads/published-keyboard.csv.gz)、[原始检查](observations/published-download-check.json) | 重新挂载后原生点击Download、Down、Return，经实际浏览器下载事件取得`Desk budget - 清单 (3).csv`；61字节，Notebook7/Pen5/Total12。 |

两份都带UTF-8字节序标记，四行双引号字段、三处CRLF，末行无结尾换行。gzip保留源字节，防止Git换行规范化；归档时同时核对scratch副本与这两个真实Downloads文件。[archive-check.json](archive-check.json)记录精确恢复结果，不使用源码摘要冒充功能正确性。

一次更早混用Playwright定位接口Enter打开菜单与原生Return的尝试没有取得文件，不能追认为成功，也不能在未调查时直接定性产品故障。只有上述随后取得真实文件的鼠标和原生键盘路径计入成功。快速按两次Escape后曾仍看到菜单，之后再按一次才关闭；不写无条件“两键关闭”。

## 检查、收尾与边界

[人工摘要](observations/review-summary.json)明确区分操作、数据、未覆盖范围和运行回执，它不是浏览器原始输出。[构建日志](logs/build.log.gz)记录1m1s，主 agent的session20477 exit0；[类型日志](logs/typecheck.log.gz)来自session34086 exit0；[方案阶段文档检查](logs/docs-plan.log.gz)记录docs:check ok（348 ops、26 groups）。最终共享索引和提交前检查仍由主 agent负责。

[页面关闭](observations/page-closed.json)记录tab29于2026-10-13T11:34:43.205Z关闭、英语en-US偏好恢复；原owner PID84388、occurrence `655041dc-6e4b-4c44-9c3f-55ff412a43ef` 经stop-requested正常退出，launcher23515 join exit0，terminal elapsed370031ms。保留[owner](logs/owner.json)、[ready](logs/ready.json)、[terminal](logs/terminal.json)、[stdout](logs/stdout.log.gz)、[stderr](logs/stderr.log.gz)。主 agent又只读确认PID与18505 listener已关闭，没有杀用户进程。

当前只证明可编辑桌面样本的说明、语言/全屏布局、同实例编辑及真实下载路径。readonly样本、显式折叠、虚拟列表卸载、移动端、多实例、重连及刷新/重启恢复未实页覆盖，不能宣称全部验收指标都已满足。静态说明不增加自动保存、跨Chat编辑缓存、modified标记或离开拦截，也不承诺CSV保存公式/格式。

[允许清单](archive-manifest.json)仅含这八图、两CSV、必要JSON及日志/owner；没有复制源码差异备份、工具脚本、运行环境、构建资产、数据库或凭据。[归档检查](archive-check.json)包含有限凭据模式扫描、本地链接检查和gzip原始字节恢复；这些是证据安全与完整性检查，不代替真实页面验收。
