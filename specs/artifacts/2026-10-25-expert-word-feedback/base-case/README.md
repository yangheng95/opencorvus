# 全新Base文档修订用例

本用例的Task是`tsk_g00VYzV4d60044VaYioJ`，Project是`prj_hz4MUTMNoi0ikRKumyKx`，专用端口19146。它是独立项目和数据库，以先前真实交付的MD、Word及原生成器为只读输入，不复制原营销Task的轮次或重置其360次上限。

- [真实请求](request.txt)限定分页修订、完整正文保留、实际渲染、逐页视觉检查、独立复核和正式交付。
- [本地运行时说明](runtime.md)与[真实离线预检](dependency-preflight.json)记录先把原字节renderer放入项目再渲染原件，已得到五页；[原始预检日志](dependency-preflight.log)保留实际命令结果。
- [实际模型预检](preflight-ready.json)分别确认Provider凭据可用、模型目录投影和实际gpt-6.1-sol流式请求；[正式Task创建](creation.json)保留202及真实Task身份。
- [启动工具修正](startup-correction.json)记录验收器误用市场包安装Base。该启动零模型请求，原生结算/退出1/四份authority退休在`rejected-startup-01/`保留；实际重试使用原生内嵌Base声明，未修改产品包或凭据接口。

Task已完成，92/360次实际gpt-6.1-sol流式请求。[完整验收结果](verification.json)确认正式资源与当前文件完整字节相同、MD与原件相同、阅读版全文相同；[正文独立解析](word-content-verification.json)确认81块、37段、7表和44表格行。[正式交付Word](delivery/growth-plan.docx)与[规范Markdown](delivery/growth-plan.md)是实际资源原件的副本，不是外部agent重写；[生成器差异](generator.patch)保留实际作者修复。

[完整正式读取](delivery-verification/)包含原Completion Decision、snapshot manifest、所有分块资源和真实document记录。[独立审阅报告](delivery-verification/art_h0sL9638oX8lpK7UfWZs.json)明确接受分页修订；[五份独立图片回执](independent-image-read-receipts.json)来自真实artifact_read outcome，核对五张完整PNG及原Message/Session媒体附件。[导出器修正](export-checker-correction.json)保留原本地read假设错误，未合成审阅行为。

[原始工具事实](tool-facts/)包含正式GET messagePart取得的完整命令/补丁/错误以及关闭后只读SQLite取得的三个实际artifact_read outcome。首次缺失历史CSV和文本read不支持DOCX的错误均保留，未将最后成功记录替换为全部过程无错。

[本次重新渲染五页](word-pages/)及[主agent逐页观察](outer-visual-observation.json)证明预算表头与首条数据同页、阶段表跨页正确重复表头、全文可读；[真实渲染回执](final-render.json)和[日志](final-render.log)保留实际运行，最终正式Word与渲染源完整字节一致。图像和派生PDF属于内部QA，未进入正式两文件交付。

[Provider原始请求摘要](provider.json)、[原生完整结算](native-host-settled.json)、[原launcher退出0](launcher-child-exit.json)、[HTTP关闭](shutdown.json)、[四份临时authority退休](retirement.json)和[导出秘密扫描](export-scan.json)共同确认本用例完成且收束。原营销Task追加失败仍在上级`original-task/`保留，本用例不改写该结论。
