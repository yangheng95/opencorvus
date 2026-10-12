# 366 超长行的命中窗口

[Recall与完整分析](../source-match-window-plan-366.md)。搜索结果过去总截行首2000单位，靠后的命中无法从工具/来源片段辨认。现在使用ripgrep报告的原line字节跨度，完整脱敏及位置映射后，从命中前最多40单位取有界窗口，两端保持完整字符；截取结果再次经同一redactor，保证Tool和Source共用安全片段。短行保留原文字，无报告跨度的零宽结果保留有界行首。

## 实际证据

- 01–08 / `live/`：真实Main五类输入及中文Side两条来源；14中的前8张实页图亲自查看。原中文长行打开到第1行，来源Tooltip可见靠后命中、emoji与原文，上限四行。原35110 exit0，254549ms内完整闭合，9 Sol流式EOF。
- 09–14 / `edge/`：最终裁切签名修复后，新Main六类输入实页图。特殊raw_base64被省略为92字符标记，其余正常窗口不变；原98870 exit0，122549ms内完整闭合，5 Sol流式EOF。特殊例未独立覆盖Side，不扩称全部矩阵。
- `checks/runtime-qualification.json` 与 `edge/runtime-qualification.json`：实际SQLite Source、生产ToolOutcome、完整作者输入字节与Provider/HTTP/Native回执。初轮12个Source（含Side继承5），最终6个Source逐值通过。
- `find-api-qualification.json` 与原完整响应：实际SDK公开/find HTTP200，四结果完整规范数据与原字节偏移逐值相等。无SDK协议字段改变。
- `checks/`：改前与中间失败全部保留，最后32聚焦正向测试、最终8/8类型、正式build及renderer检查。原4失败里零宽末尾是错误测试假设，真实rg给空submatches，已改成明确行首合同；裁切二进制边界则有单独实际失败和修复后20/20工具测试。

所有UI证据来自手动操作和亲自查看的截图，JSON仅为只读辅助。没有UI自动化测试、模拟Source/消息或开发子agent；auth/models只按授权成对私有暂存，两个固定600000ms scope都已完整清理，未扩期。旧359首次复制未知仍保留；持续目标active。
