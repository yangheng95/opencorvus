# 多页表格数值与原始清单证据

关联[Recall、完整根因及验收](../../records/2026-11/2026-11-27-table-precision.md)。本人完成真实开发页面原生交互和12张截图人工复核，没有新增或运行UI（User Interface，用户界面）自动化、DOM（Document Object Model，文档对象模型）/组件断言、快照或像素检查。凭据、模型目录、完整数据库及加密推理没有归档。

## 修改前现象

- [首行49.368而非原49.3681640625](before-rounded-values.png)、[真实第二页51–53](before-page-two.png)。
- [首次第二页搜索后空表2/1](before-first-page-filter-empty.png)、[新页面重复仍然空页](before-page-filter-empty.png)，统计却是1/53。后续独立观察继续存在，排除仅短暂旧帧。
- [手动上一页恢复真实匹配行](before-manual-previous-restores-match.png)，原值可搜索，显示仍舍入；两项缺陷独立。

## 最终真实交互

- [行内完整小数与列宽](accepted-exact-values.png)、[正常第二页保持三条原记录](accepted-page-two.png)。
- [第二页精确搜索后正确回1/1并显示原值](accepted-page-two-exact-search.png)。
- [清除后全53行/数值升序](accepted-numeric-ascending.png)、[升序第二页最大三条](accepted-sorted-page-two.png)、[第二页切降序回1/2](accepted-descending-reset.png)。
- [深色英语保持查询/降序/完整数值/1÷1页](accepted-exact-dark-en.png)，作者列名和路径保留原文，下载范围说明接入当前语言。

## 真实来源、模型执行和下载

- [53行真实源码元数据来源](inventory-origin.json)、[源数据](source-inventory.json)、[原4049字节CSV（Comma-Separated Values，逗号分隔值）](source-files.csv)。字节数来自指定不可变Git提交中的真实文件对象；大小精确除1024，不虚构业务数据，不以可变源码摘要作为功能门槛。
- [真实发布payload（载荷）](published-table.json)、[read/publish正式工具部分](tool-parts-run62.json)、[模型终态](task-status.json)、[正式产物API（Application Programming Interface，应用程序接口）](api-artifact-run63.json)。session `ses_hy64GcYIySY4OaXfKbNq`，artifact `art_g0Vc9rD9900G8mQhzR1c`；均来自真实Sol请求。
- 查询仅匹配1行时原生菜单下载的4511字节完整CSV仍有53行原序及全部原值，符合当前下载合同。[标准ZIP中的原生文件](native-download.zip)同时保留浏览器下载4511字节与源输入4049字节；[可读下载CSV文本](downloaded-inventory.csv)和[可读来源文本](source-files.csv)便于审查。Git会规范文本换行，不能把这一差异当功能失败。[实际下载身份](native-downloads.json)记录路径/大小/时刻及两个ZIP成员，未替换实际下载或后处理产品导出。
- [修改前数据checker（检查器）](facts-run62.json)、[最终checker](facts-run63.json)逐字段/Decimal精确数值、原序和下载核对，23保护文件/2070旧持久行、样本HEAD与SQLite完整性均通过；界面排序只以实际交互/人工截图验收，没有自动读取DOM判分。
- [类型](typecheck.log)、构建53.90秒/renderer公开表面、文档353操作/26组/架构20文档通过。[汇总及原句柄退出](verification.json)：run62/63共8次精确GPT-6.1 Sol流式200，全部读取结算/EOF（End Of File，流结束），服务排空退出、配对副本退役、自有标签关闭。

## 边界

CSV检查器复用同一个Table组件，已审计但本批手动验收的是table@1真实产物。不能恢复转为JSON数值之前已丢失的精度或词法尾零。分页是呈现本地游标，没有Task/Mission/Session执行调度异常；未扩展Office、移动端或用户外部编辑器。首次展开后若实际回到行内，按当前可见状态重新展开取证，未以点击尝试声称窗口状态。
