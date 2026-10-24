# 专家团追加交付与更正案例证据

[方案与Recall](../../records/2026-10/2026-10-24-expert-steering-recovery-cases.md)。inputs是受控合成输入；三组原任务已完成实际业务交付及全文核验，中间原生处置超时仍未解决，不能称整体验收通过。完整运行目录和SQLite在方案指定的独立私有目录保留；此目录归档正式读取的完整产物、实际文件和精简原始回执，不包含凭据。

- `inputs/marketing-growth/`：三渠道可复算台账及原预算；执行中更正由正式Task消息提交。
- `inputs/seo-geo/`：本地页面清单与明确观测边界。
- `inputs/sales-strategy/`：合成聚合客户事实与访谈摘录。

## 真实页面证据

- [01-marketing-runtime-fault.png](01-marketing-runtime-fault.png)：MG-02原故障，尚未完成交付。
- [02-marketing-steering-active.png](02-marketing-steering-active.png)：MG-03编排器真实接受1200更正并继续；不是最终完成证据。
- [03-seo-native-recovery.png](03-seo-native-recovery.png)：SEO原编排器明确保留工具超时并安排原交付负责人接续。
- [04-seo-pdf-preview-fault.png](04-seo-pdf-preview-fault.png)：实际最终文件卡片的未加载navigation解引用错误。
- [05-sales-revised-completed.png](05-sales-revised-completed.png)：销售第二epoch完成，原路径正文修订仍在。
- [06-pdf-first-open-fixed.png](06-pdf-first-open-fixed.png)、[07-pdf-page-two-zoom-fixed.png](07-pdf-page-two-zoom-fixed.png)：首处修复后的文件入口真实首开/翻页/缩放；当时尚未证明inline入口。
- [08-pdf-delivery-initial-size-fault.png](08-pdf-delivery-initial-size-fault.png)：首处修复后继续发现inline自动高度与首宽互等，不能把这一轮称为完成。
- [09-pdf-delivery-final.png](09-pdf-delivery-final.png)、[10-pdf-delivery-table-final.png](10-pdf-delivery-table-final.png)、[11-pdf-file-entry-final.png](11-pdf-file-entry-final.png)：两处修复后原交付卡片和文件入口的实际页面；无凭据、零模型、原890行参与者/产物数据不改。
- [12-marketing-final-completed.png](12-marketing-final-completed.png)：MG-03原任务Completed及实际两个文件交付。DOCX在当前产品按真实二进制文件下载，Word分页另用真实LibreOffice渲染核验。

## 真实完整交付与结算

| 原案例 | 正式读取及实际结果 | 当前限制 |
| --- | --- | --- |
| [marketing-growth](deliveries/marketing-growth/verification.json) | 310/360次，epoch1完成；八个完整业务产物；15834字节Markdown与不可变资源、真实document全文相同；10552字节DOCX与发布资源相同 | 两次native处置超时仍保留；[Word独立核验](deliveries/marketing-growth/word-verification.json)逐块比对81块/44表格行；分页表头不足 |
| [seo-geo](deliveries/seo-geo/verification.json) | 245/360次，原epoch1完成；七个完整业务产物；15566字节Markdown与373815字节六页PDF均等于各自实际资源，PDF六页人工查看 | 原writer处置失败后同Session接续，原故障未清除；PDF产品预览两处共享缺陷已修 |
| [sales-strategy](deliveries/sales-strategy/verification.json) | 279/360次，完成后正式追加更正并完成epoch2；九个实际业务产物保留新旧文档；18778字节当前Markdown与资源、真实document全文相同 | 本轮没有额外覆盖整机重启；不以其通过排除其他案例共享异常 |

每个delivery目录包含正式artifact-read得到的完整JSON envelope、immutable资源和真实interactive-artifact原记录；`run-facts.json`保留真实Task、每次实际gpt-6.1-sol流式请求与原reader结算；`shutdown.json`、`native-host-settled.json`、`launcher-child-exit.json`及`retirement.json`保留原进程正常结束、四份authority副本退休与源保持事实。`preparation.json`明确源提交及固定预算；原运行源码另有他任务差异时见私有source.patch，不冒称纯净提交。

[word-pages/](word-pages/)的五页PNG均由原DOCX经官方LibreOffice实际渲染，主agent逐页查看。[word-render.log](word-render.log)是修复本地缺失工具链后重跑原render_docx.py的直接转换输出。所有正文、中文、数字和单元格可读；第二页末孤立预算表头及后续跨页未重复表头仍是排版不足，没有修改原输出掩盖。

## 未闭环原生异常与局部诊断

- [native-original-failures.json](native-original-failures.json)：MG-03原692个native request、667次严格处置中的两个实际超时，保留原request/target/helper/birth/active-zero及原Promise分段。原诊断有未单独量化的同步历史扫描开销，这些数值不能定位某个文件系统调用。
- [native-package-timing.log](native-package-timing.log)：两个Project串行/并行136次真实冻结publisher introspection及低开销原I/O计时；原runner1项2合同通过，25ms采样最大lag365ms，没有复现原超时。
- [native-package-no-sampling.log](native-package-no-sampling.log)：去掉周期采样/落盘后同136次也通过。两轮均为无凭据原生局部实机诊断，不是LLM业务端到端，也不足以宣布原超时已修复。
- [native-package-idle.log](native-package-idle.log)：再加六段10秒空闲输入后同136次通过。
- [checker/README.md](checker/README.md)：当前唯一可重复入口、原官方runner命令及证据资格；[native-package-published-final.log](native-package-published-final.log)记录最终源码原runner结果，[native-package-published-observations.json](native-package-published-observations.json)保留该轮136个原Handle与原I/O完整计时。

## 聚焦后端原runner证据

- [root-input-runtime-red.log](root-input-runtime-red.log)：旧代码在真实Task追加输入准备间隙提前移动原Message，明确owner断言失败。
- [root-input-runtime-green.log](root-input-runtime-green.log)：修复后四文件23项通过；协议Provider是本地流式夹具，不冒称真实模型端到端。
- [root-input-multi-project.log](root-input-multi-project.log)：同库两个Project按相反顺序提交准备好的原输入，明确Task/Project/原文归属通过。
