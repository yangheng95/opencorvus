# 专家团追加交付案例输入

[方案与Recall](../../records/2026-10/2026-10-24-expert-steering-recovery-cases.md)。inputs是受控合成输入；阶段截图与后端原runner记录见下，不代表三个完整业务案例已通过。完整原件在方案指定的独立私有目录保留。

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

## 聚焦后端原runner证据

- [root-input-runtime-red.log](root-input-runtime-red.log)：旧代码在真实Task追加输入准备间隙提前移动原Message，明确owner断言失败。
- [root-input-runtime-green.log](root-input-runtime-green.log)：修复后四文件23项通过；协议Provider是本地流式夹具，不冒称真实模型端到端。
- [root-input-multi-project.log](root-input-multi-project.log)：同库两个Project按相反顺序提交准备好的原输入，明确Task/Project/原文归属通过。
