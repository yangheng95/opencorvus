# 审阅阅读空间证据

对应[调查与验收记录](../../records/2026-11/2026-11-01-review-content-space.md)。截图均来自单agent实际交互的独立后台CLI开发页面，逐张人工复核；不保存凭据、数据库或私人诊断日志。实际结果随验证补充，不预填通过。

| 原图 | 人工复核内容 |
| --- | --- |
| 01-before-single.jpg | 原单文件固定40%高度与空白 |
| 02-before-single-expanded.jpg | 原第二次真实比较、正文可见高度 |
| 03-before-three-files.jpg | 搜索进入已完成真实Task，三文件原布局 |
| 04-before-three-narrow.jpg | 窄区列表达到上限，原独立滚动 |
| 05-intermediate-list-collapsed.jpg | 仅改轨道导致列表0px，保留失败证据 |
| 06-final-single.jpg | 最终单文件和原组标题完整可见 |
| 07-final-single-expanded.jpg | 同字号同宽度下，正文获得原空白空间 |
| 08-final-three-files.jpg | 三文件按真实内容占高 |
| 09-final-three-narrow.jpg | 上界仍为40%，与原窄区分配相同 |
| 10-final-last-file-selected.jpg | 列表实际滚至底部6px，选中原报告比较 |
| 11-final-filtered-one-file.jpg | 筛选一个文件后收敛高度，报告正文获得空间 |
| 12-final-status-filter.jpg | 清除搜索后按修改状态选择原invoice比较 |
| 13-final-wide-split.jpg | 宽718px时恢复原左右分栏 |
| 14-final-zh-three-files.jpg | 中文三文件与差异面板 |
| 15-final-current-file.jpg | 从真实Task打开当前invoice.py，普通Dock |
| 16-final-zh-single-expanded.jpg | 中文单文件和原第二次62行修改 |

[layout-observations.json](layout-observations.json) 保存对应实页的只读几何观测；没有UI断言或像素比较。06/07与01/02均为12px、内部宽368px：文件区229.438→166.188px，正文257.188→320.438px，释放约63.25px。09的窄区上界、列表113/119px和原04一致；10实际选中最后文件且scrollTop=6。筛选与中文观测单列，不冒作同语言前后收益。

[verification.json](verification.json) 保存三次正式CLI闭合及结构/数据保留事实。实际使用已保存的真实指南与发票Task，模型请求均0，原native均0、shutdown200、三对共6份认证/目录副本退休，旧项目/Git/附件完整。只改CSS布局，未改消息/数据/接口/模型，不新增或运行UI自动化；80行以上虚拟列表、移动端和原生宿主窗口不在本轮实页证据内。
