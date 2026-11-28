# 嵌套工具输入与工作簿证据

对应[调查与实施规格](../../records/2026-11/2026-11-28-nested-office-input-review.md)。本批修正共享嵌套联合物化和必需常量误选，真实原生Excel交付与新公式簿复验通过；不改变公开或持久schema。

- `validation-facts.json`：修改前2通过/2失败，最终37后台案例83断言、类型检查和20次精确Sol流。
- `run157-*-public-messages.json`、`execution-facts.json`：两个真实Work对话及完整公开工具结果，最终stop。证据投影省略不透明Provider推理和内联二进制，不更改产品消息。
- `run157-*-artifacts.json`、`office-download-facts.json`、`formula-data-facts.json`：实际API载荷、原生下载与独立Decimal核对，6/17.65和编辑后6/18.65。
- `historical-payload-read-facts.json`、`facts-run157.json`、`reference-facts-run157.json`：62旧载荷含5电子表格、23文件/3091旧行、2完成Task/23任务行/59字节CSV和8业务输入保护。
- `stream-facts-run157.json`、`runtime-cleanup-facts.json`：20次200/EOF及原46918句柄退出0、成对副本和自有端口/页面退役。
- 11张JPG是原生页面原图，均本人实际查看；其中07/08为完整原生Office两页，11–17为公式表初始/列宽调整/编辑/重算/下载菜单。01为多步任务入口核对，03为真实任务启动，06为放大预览。它们没有截图基线或像素断言。
- `original-bytes.zip`保留24份原始字节：自然业务提示、8业务输入、原资源、实际XLSX/PDF/两份CSV下载和人工交互观察。原字节不受Git换行转换；不归档凭据、模型目录、完整数据库或私有项目配置。

边界：真实Office请求显式zh-CN；默认locale:null另由真实生产schema正向用例证明。字面值XLSX没有公式重算；应用内公式编辑只保留当前视图，CSV保存当前值。首次长表头需现有内容列宽按钮，本批留作下一批界面改进证据。详见`archive-facts.json`。
