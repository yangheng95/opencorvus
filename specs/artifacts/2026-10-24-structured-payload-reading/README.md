# 结构化工具输出阅读位置

556，单agent，真实Task的既有read_agent_message结果，Source CLI /ui、1280×720实图逐张人工查看。[非秘密运行与观察证据](evidence.json)。没有新增或运行UI自动化测试。

| 实图 | 资格 |
| --- | --- |
| [01](01-json-tree-main.png)、[02](02-raw-main.png) | 原真实JSON树与原文格式。 |
| [03](03-bounded-raw-reading.png)→[04](04-bounded-raw-narrow.png)→[05](05-bounded-raw-wide-return.png) | 前态：宽745/窄463仍top720，实际原字符1671/1173，跳离原段落。 |
| [06](06-fixed-wide.png)→[07](07-fixed-narrow.png)→[08](08-fixed-wide-return.png) | 修复后同一原字符1671仍可见，top720→975→722，顶边偏移-9/-10.5/-11px。 |
| [09](09-readable-format.png)、[10](10-raw-format-return.png) | 切换可读格式再回原文，top722/原字符1671保持。 |
| [11](11-user-new-reading.png)→[12](12-user-new-narrow.png)→[13](13-user-new-wide-return.png) | 实际滚轮接管到原字符3841，再次改宽仍保持，top1442→2164→1443。 |
| [14](14-full-output.png)、[15](15-bounded-return.png) | 全文展开移交外层；收起恢复原预览top1443/字符3841。 |
| [16](16-json-messages-expanded.png)、[17](17-json-nested-reading.png) | 嵌套数组/字段控件实际展开和滚动，不声称完整深层正文可读格式已验证。 |
| [18](18-copy-original-output.png) | 按钮出现Copied图标，但独立读取器仍返回上一批已知361字符停止详情；复制内容验收未通过。 |

最终资产main-DapVWEPi.js。两格式读位留在同一现有conversation-ui内存记录，共用既有字符测量/解析算法；原Observer持续观察有界输出尺寸，原一帧控制器恢复，真实滚动可接管。没有数据库、API或版本变更。

两服务公开shutdown200，原exec5777/40481及native/launcher均0，physical/output/request与精确出生完整闭合；收尾余量843307/875704ms。0模型、未复制auth、两catalog副本退休，源catalog完整内容/mtime保持。两个源均90表169304原行、所有字段时间/源文件/canonical保持，两个目标原行零差异、schema3实际对象相同、integrity ok、provider_activity_request421→421。主视图模型提示来自此无认证隔离边界，不能解释为用户App热认证失败。

复制内容问题已有新的已知旧值证据，根因仍未知，将继续独立排查；此处不以Copied图标代替内容证明，也不把当前阅读修复扩展为所有Sources/Rendering问题已解决。
