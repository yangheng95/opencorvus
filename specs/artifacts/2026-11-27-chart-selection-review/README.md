# 原生图表尺寸与框选保持证据

- 关联[根因、影响与实施规格](../../records/2026-11/2026-11-27-chart-selection-review.md)。真实来源为同一独立项目sales.csv，5笔/35.60；由GPT-6.1 Sol流式读取并发布chart@1，原始金额/订单/区域和备注保持。
- 修改前真实框选A001/A002得到30.30/2，关闭作品窗口触发尺寸变化后恢复全量，稳定截图已人工查看。原生SVG的clip1/2/3/4身份保持，编译规格根height=290且两个子图共享height信号，宿主原来覆盖该信号。
- 第二条根因：语言/主题重建把未使用的空平移delta与anchor信号重新发出，panLinear收到undefined并中断原生渲染。`native-state-outputs.json`显示选择数据和3030整数分/2笔已正确转移，`native-state-errors.json`保留同刻原生错误，`found-language-rebuild-inconsistent.png`是实际失败画面。最终实现递归跳过与新View初始值相同的信号，数据照常一次转移；临时诊断已删除。

| 实际桌面证据 | 人工复核结果 |
| --- | --- |
| `accepted-all-orders.png` / `accepted-doubleclick-all.png` | 5个订单、全量区域28.25/3与7.35/2，双击恢复 |
| `accepted-first-brush.png` / `accepted-english-selected.png` | A001/A002框选30.30/2；未做平移时中英文切换保持 |
| `accepted-dark-selected.png` | 深色主题切换后原生选区及30.30/2保持；部分作者文字对比度不足另列下一批，不宣称视觉全通过 |
| `accepted-translated-brush.png` / `accepted-pan-roundtrip.png` | 实际拖动选区得到A002/20.20/1，主题和语言返回后保持且仍可操作 |
| `accepted-refund-selected.png` / `accepted-zero-selected.png` | A003/-2.05/1与A004/0.00/1，未丢退款或零金额计数 |
| `accepted-dashboard-all.png` / `accepted-dashboard-refund.png` / `accepted-dashboard-cleared.png` | 共享Dashboard默认图和声明65高度汇总正常；筛选华东退款1/-2.05；清除回5/35.60 |

- `selected-orders.svg`是原生菜单真实下载的`visualization (3).svg`，27110字节，859×437，XML包含30.30/2笔；不是从页面脚本合成的导出。`sales.csv`逐字节来自受保护181字节源文件；此前的下载保留。
- `api-artifact-run49.json`和`api-publication-run49.json`均为真实只读API；`facts-run49.json`为源数据Decimal、正式发布、持久化与保护检查结果，21文件/1917旧行保持。`check-facts.py`为本批真实数据checker源码，执行需要仓外私有原始副本及run49收据，未提供含加密推理的完整数据库副本。
- `verification.json`记录14次精确gpt-6.1-sol流式HTTP200响应全部settled/eof；run45–49均正常停止、配对凭据及完整目录副本退役。最终类型检查、51.55秒构建和renderer（渲染器）公开面检查通过。浏览器错误记录仅作补充，不能代替15张实际截图的人工复核；没有新增或运行UI自动化测试。
- 私有凭据、模型目录、加密推理及数据库完整副本仅留仓外，不提交。未扩大到移动端、发布、版本升级或原生Office认证界面。
