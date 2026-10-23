# 剪贴板读取初始化边界

557，单agent，真实Source CLI /ui，内置浏览器逐步人工操作、截图逐张查看。[非秘密完整观察](evidence.json)。未新增或运行UI自动化测试，生产代码零改动。

| 实图 | 实际资格 |
| --- | --- |
| [01](01-completion-observed.png) | 明确观察到Copy Output · Copied后，首次专用read/实际paste仍是旧361字符；排除仅仅过早采样。 |
| [02](02-output-pasted.png) | 同页已知键盘对照后，产品Output真实粘贴51840字符，与原结果逐字相同。 |
| [03](03-native-target-shift.png) | 首次原生AX控件在hydration期间变化；没有Copied，不算内容验收。 |
| [04](04-native-input-action.png) | 稳定原生AX复制Input出现Copied，但首次read/paste仍是旧51840字符；不只一种点击方式。 |
| [05](05-reader-initialized-paste.png) | 新页先初始化reader，再首次产品Copy Output，实际粘贴与完整原51840字符相同。 |
| [06](06-input-pasted.png) | 另一新页首次read旧值；仅重做产品复制、无键盘或专用clipboard写入，read变成原574字符，实际粘贴逐字相同。 |
| [07](07-draft-cleared.png) | 未发送草稿最终清空，保留真实原历史。 |

已明确的触发边界是每个新tab的调试clipboard reader首次调用。第196页read在产品动作前发生，首次产品复制直接通过；第197页首次read发生在已确认Copied之后仍返回旧值，只有这次read作为中间步骤、再复制即得到正确内容。观察不支持修改产品单一writer，也不等于已经读取外部工具内部实现；旧43字符因未保留而不作追溯定性。后续人工验收在产品动作前初始化当前tab的reader，并继续观察完成和实际粘贴，不用任意sleep或第二writer。

四个自有页194—197均关闭，草稿全部清空且未发送。19159公开shutdown200，原exec28757/native/launcher0，physical/output/request及精确出生闭合，余量586332ms；0模型、未复制auth、唯一catalog副本退休，源catalog内容mtime保持。源90表169304行所有字段时间/字节mtime/canonical保持，目标原行零差异，schema3实际对象/integrity保持，provider_activity_request421→421。

三个同源页并存时短暂出现Connecting和输入disabled，直接后端health200，关闭两张已完成自有页后原页Online恢复，没有刷新或重启。该关联现象需下一批独立连接审计，当前不猜定HTTP连接配额根因。冻结UI main-DapVWEPi.js；当前Goal改动及旧素材清理由其他任务拥有，均未纳入此资格。
