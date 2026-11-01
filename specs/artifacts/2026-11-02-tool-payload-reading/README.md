# 工具结构化内容阅读（881）

本人后台项目CLI开发服务38579/38580的真实交互，13张原始JPEG均已实际呈现并人工查看。数据来自880-after完整合格隔离副本，不操作用户18571或窗口。

- [01-before-single-count-en.jpg](01-before-single-count-en.jpg)：主记录展开artifact_read输入；实际1 fields/1 items及0 items。
- [02-before-narrow-fields-en.jpg](02-before-narrow-fields-en.jpg)：原base-tester展开artifact_publish输入；artifact_type被拆为两行；原6字段/15来源。
- [03-after-single-count-en.jpg](03-after-single-count-en.jpg)：相同读取输入展开；1 field/1 item正确，0 items保留。
- [04-after-narrow-fields-en.jpg](04-after-narrow-fields-en.jpg)：相同成员参数展开；字段名和值分行，artifact_type单行。
- [05-after-wide-fields-en.jpg](05-after-wide-fields-en.jpg)：真实拖宽本人侧栏至允许上限；payload420px仍属窄区域，保持单列；不作为宽双列通过。
- [06-after-nested-sources-en.jpg](06-after-nested-sources-en.jpg)：展开15项来源数组；原15项可展开，前项进入实际视口。
- [07-after-raw-input-en.jpg](07-after-raw-input-en.jpg)：切换为原始内容；完整JSON及原始字段/引用可读。
- [08-after-copy-paste-en.jpg](08-after-copy-paste-en.jpg)：真实复制输入并Ctrl+V粘贴到未提交草稿；8113字符、6字段、15来源引用；随后清空，未发送。
- [09-after-nested-tail-en.jpg](09-after-nested-tail-en.jpg)：返回可读视图后实际阅读数组14尾项；原数组展开状态保留，末项和后续长payload_json可达。
- [10-after-wide-main-en.jpg](10-after-wide-main-en.jpg)：关闭右栏后实际阅读搜索结果；payload747px，complete/true左右对照；0/1/4计数正确。
- [11-after-wide-main-zh.jpg](11-after-wide-main-zh.jpg)：切换当前界面语言并返回；中文0项/1项/4个字段及原字段身份保留。
- [12-after-narrow-fields-zh.jpg](12-after-narrow-fields-zh.jpg)：中文成员输入实际收起再展开；6个字段/15项、完整artifact_type；嵌套展开状态保留。
- [13-after-source-preview-zh.jpg](13-after-source-preview-zh.jpg)：点击成员test_counter.py来源；应用内文件面板显示原15行源码，没有编辑/执行。

[操作记录](actions.csv)、[完整非敏感资格](verification.json)、[根因及方案](../../records/2026-11/2026-11-02-tool-payload-reading.md)。

窄区域以原字段名在上、值在下排列，宽区域保留对照；单复数复用已有tc。真实数据与原ID不改写，原生复制粘贴8113字符保持6字段/15来源，草稿已清空、未发送。两阶段0模型请求、累计1260；原句柄6517/57074 exit0，public shutdown200，出生身份物理/输出/请求结清，四份配对认证/模型副本退休。完整资格258673→258675→258677行，schema9/92表、旧业务行、100项目业务文件/Git、229附件、来源DB及原认证/完整模型目录保留，零文件系统豁免。

边界：05侧栏拖宽后仍低于本组件40em阈值，真正宽区域对照见10。实际覆盖空数组、单字段对象、单元素数组、6字段及15项；零字段对象、实时流式输入与所有其他调用面没有逐一实页测试。不新增/运行UI自动化、DOM/文案/组件/快照/像素断言；本轮无模型执行、schema或调度改动，也无版本发布。
