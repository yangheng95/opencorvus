# Sources网页导航与浅色阅读证据

[Recall、根因和实施前方案](../../records/2026-10/2026-10-14-source-navigation.md)。单agent使用独立正式开发服务 `/ui/`、真实405历史和原始截图；没有UI（User Interface，用户界面）自动化测试。

## 结果

实际打开网页来源得到正确MDN新标签；返回后来源与摘录保持展开。浅色主区和380像素侧聊内，英文长标题、站点、复制与中英文摘录控件均可读。来源正文保留发布者原文。

调查复现了命令执行后的焦点丢失：从来源按钮打开面板，鼠标选择主题/语言后BODY聚焦，而Escape正确返回。根因为业务close中的即时恢复被组合框选择尾部的输入回焦覆盖。修复把唯一恢复移到既有Dialog关闭生命周期，尊重新焦点及仍有效的原目标。

|原图|资格和限制|
|---|---|
|[01](01-dark-expanded.jpg)、[03](03-returned-sources.jpg)|主区来源/摘录保持展开；返回前后原滚动读数1347.333与1386.666，未宣称像素不变。|
|[02](02-source-target.jpg)|由真实Source点击创建的新标签16，完整MDN sort标题与原链接目标；随后只关闭这个新标签。|
|[04](04-light-expanded.jpg)、[05](05-light-side-sources.jpg)、[07](07-light-side-chinese.jpg)|浅色主区、窄侧栏英中显示和实际复制反馈。|
|[06](06-excerpt-keyboard.jpg)|聚焦摘录后End读取内容末尾；进一步Home时主区和外侧栏保持当前位置，见滚动原观察。|
|[08](08-source-copy-pasted.jpg)|原首败：反馈已复制后实际粘贴得到旧406 README位置，不能用Toast宣布通过。|
|[09](09-source-copy-confirmed.jpg)|再次真实复制/专用clipboard读取和Ctrl+V均为准确sort URL；草稿清空，未发送。|
|[10](10-pointer-command-focus.jpg)|修前真实鼠标选择暗色命令后BODY焦点。|
|[11](11-fixed-pointer-focus.jpg)|修后鼠标选择亮色命令，焦点回到同一侧聊复制按钮。|
|[12](12-fixed-keyboard-focus.jpg)|键盘Enter切英语后同一来源按钮保留焦点、语言正确。|
|[13](13-fixed-excerpt-return.jpg)|来源摘录→命令面板→Escape，真实蓝色焦点框回到原region。|
|[14](14-settings-focus-owner.jpg)、[15](15-new-chat-focus-owner.jpg)|Settings的搜索INPUT、新对话TEXTAREA分别获得焦点，原来源不回抢。没有发送新消息。|
|[16](16-distinct-source-copy.jpg)|剪贴板原sort URL经另一来源复制变为append URL，专用读取和真实粘贴一致，随后清空未发送草稿。|

[focus-before-fix.json](focus-before-fix.json)、[focus-after-fix.json](focus-after-fix.json)是上述人工动作后的只读焦点观察；[scroll-observations.json](scroll-observations.json)保留实际数值。首次End包含原本未完整可见的区域被聚焦并滚入视口，不能将其外层变化归为独立End缺陷。部分即时可访问性树仍显示关闭过渡中的输入，最终DOM（Document Object Model，文档对象模型）与截图才资格完成。没有像素差异或DOM断言。

## 原数据和运行结算

[data-facts.json](data-facts.json)和[checked-facts.json](checked-facts.json)来自正式SQLite只读查询与真实Provider审计：[checker原结果](check-facts.log.gz)为passed。原主Session与侧聊各9条消息、7个Source、5个completed Tool；精确身份、原URL/path、消息/工具事实与405保留的真实原件相等，来源副本仍只计作副本。两次[原Side Chat GET](actual-side-chats.json)、[修后GET](actual-side-chats-after.json)均200且为同一原侧聊。

两轮各2条gpt-6.1-sol实际流，总4条HTTP（Hypertext Transfer Protocol，超文本传输协议）200/EOF（End of File，流正常结束），均为启动预检。`native-before/`与`native-after/`保存usable/projected/actual-model预检、原provider最终reader、公共shutdown、Native物理/输出/请求结算及auth+models副本退休。原32933、29447工具句柄实际join exit0；Tab15/16/17全部关闭，用户进程/页面和用户数据库未被操作。

## 检查和交付

[typecheck.log.gz](typecheck.log.gz)原50716为0，[ui-build-after.log.gz](ui-build-after.log.gz)原23510为0（93秒）；修前构建原75278也为0（53.35秒）。[docs-check.log.gz](docs-check.log.gz)、[i18n-check.log.gz](i18n-check.log.gz)原命令均0。这是纯交互焦点修改，没有后台合同变化或UI测试。`tools/`保留实际诊断启动/退休、只读事实和归档脚本原字节gzip。

[上一批推送失败](previous-push-receipt.log.gz)及[实际退出](previous-push-receipt-exit.json)承接409原46585的共享权限声明不一致，不能冒称409已推送。本批提交/推送以后续实际回执为准。

首次复制旧值的根因仍未知，后续成功结果不能排除工具桥接/系统剪贴板外部写入或时序；没有据此修改产品剪贴板或加入隐蔽重写。原Research Studio长成员流式、桌面内嵌WebView、跨连接重连仍未由本轮资格覆盖。整体持续goal保持active。
