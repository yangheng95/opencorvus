# 专业任务原料物化

`fetch_original.py`只下载明确选择的GDPval任务，分开保存候选公开输入与专家/评价材料。它不是候选工具、模型调用、任务运行器、评价框架或自动选题器。

来源revision为`11e7900cdcac61bc4daf59e65feb238acda98fbf`。下载时逐字保存原row服务响应、固定revision完整parquet、数据卡、原prompt/输入/专家交付/rubric。row服务自身未提供可独立验证的revision，因此另由本地PyArrow解码固定parquet逐字段比较，不把服务当前值直接冒固定版本。原件身份摘要只绑定下载内容，不能证明科学/业务正确。

- 热防护task `46fc494e-a24f-45ce-b099-851d5c181fd4`、row111：见[未采用原因](../../cases/thermal-screening/README.md)。
- 工作量task `ce864f41-8584-49ba-b24f-9c9104b47bf0`、row157：见[完整派生任务原型](../../cases/workload-distribution/README.md)。

原数据卡没有明确SPDX许可；保留来源定位和外部本地原件，不宣称第三方内容获得本仓库许可。公开任务可能已有训练暴露，不当未见heldout。官方推荐的职业专家成对比较不能由本地作者自审代签。
