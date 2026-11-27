# 真实工作簿浏览证据

方案、完整根因/影响与逐项结果见[当前记录](../../records/2026-11/2026-11-28-workbook-browser.md)。新增当前工作表“按内容调整列宽”按钮，调用原库公开能力；原文件和发表数据保持。

- [真实任务](request.txt)、[原公开发表](run112-api-artifact.json)、[实际自然工具证据](tool-evidence.json)、[104原单元格](expected-cells.json)。工具记录仅保存真实输入/结果及必要身份，不含凭据、模型加密推理或运行配置。
- [112原文件/发表核对](workbook-facts-run112.json)、[113候选核对](workbook-facts-run113.json)、[四真实下载核对](download-facts.json)、[运行/流式/原句柄结清](runtime-facts.json)。事实与checker由真实文件、公开接口、自然工具和本人操作取得，非UI自动化。
- [原件及下载原字节](source-and-download-originals.zip)：181字节sales.csv、6793字节原XLSX、两已核对发表JSON文件副本、三只读CSV（308/102/1249字节）及编辑汇总1049字节。JSON为验证后的文件副本，不能冒称HTTP传输格式原字节；ZIP暂存对象逐项与具体来源比较。解包后可按[下载checker](check-downloads.py)的同目录输入运行；[工作簿checker](check-workbook.py)另依赖记录所列私有运行收据/原项目/工具Part及隔离openpyxl目录，不是独立产品端到端入口。
- [只读CSV下载身份和时间](downloads.json)、[编辑汇总下载身份](edited-downloads.json)；原23文件/2377行与两Task保护见facts与reference-facts两轮记录。原文件配置不归档。

5张before、13张after原生JPEG本人全部查看。主要稳定证据：

- [初始两列裁剪](before-notes-settled.jpg)、[原生双击可以适配](before-readonly-column-fit.jpg)，后者只调整B列，A列仍裁剪，证明原库能力而非产品数据丢失。
- [新按钮适配两列](after-notes-fitted-inline.jpg)、[展开顶部](after-expanded-notes-top.jpg)、[滚动到底完整第28行](after-expanded-notes-bottom.jpg)。
- [Enter汇总](after-summary-keyboard-enter.jpg)、[Space订单](after-orders-keyboard-space.jpg)、[英文深色稳定说明](after-english-dark-notes-settled.jpg)。
- [原可编辑表稳定适配](after-editable-summary-settled.jpg)、[原生C2选区](after-editable-c2-settled.jpg)、[人工输入/公式重算](after-editable-recalculated.jpg)、[中文恢复保留编辑/37.60](after-restored-chinese-edits.jpg)。长说明列宽大于视窗时保留原横向滚动，非强制压缩。

`before-notes-clipped`、`before-expanded-notes`、`after-english-dark-fit`、`after-editable-summary-fitted`、`after-editable-selected-c2`为切表/展开/输入后中间帧，不能冒充稳定结果。没有以截图基线、像素、DOM或源码文案断言验收。
