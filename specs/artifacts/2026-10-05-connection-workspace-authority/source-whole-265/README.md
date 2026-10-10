# 265 整文件来源的旧范围高亮

[Recall及实施前分析](../source-whole-plan-265.md)。单agent、真实GPT-6.1 Sol流式普通Base会话，模型自然两次read现有公开read.ts：27/11返回11行且truncated=true，1/1000完整返回262行且truncated=false/10696字符输出。同一实际文件9354 bytes、前后全文/metadata相等；没有改文件、任务、成员或伪来源。

[当前canonical](live-01/canonical-current-conversations.json)的Source分别是prt_g0VXcEVDv00OXqqJpTaZ（27–37）与prt_g0VXcEWAG00895Dyo7v2（文件本身，原payload没有range）；两者同path/provider=opencorvus-read，属于对应成功Tool消息。临时摘要的null是Select-Object对缺字段的输出，不往真实Source补null或1..N。当前credential usable/catalog projected/actualModel gpt-6.1-sol/streaming true和完整pairedModels资格均已验证。

真实问题：[03范围来源](live-01/03-range-open.jpg)高亮27–37；[04整文件旧实现](live-01/04-whole-before-fix.jpg)选中了不带范围的read.ts，仍留下那11行高亮。FilePane保留同资源doc，旧无range分支仅重置identity，没有向唯一StateField发送清除effect；同doc继续保存旧decorations。266核对原闭库文本后纠正之前的锚点归因：模型写的是代码格式read.ts，AX显示的/#由现文件引用renderer生成，不是模型Markdown href。委托入口的实际打开目标仍未验，不替代结构化Source或补造来源。

唯一CodeEditor请求身份现在让无range仍包含path/现revision；无range沿原revealLinesEffect(null)清除band并记该身份，保留cursor/scroll，不跳1/选全文。普通resize按同一身份跳过，既有layout/range管线不变，没有第二状态/renderer/reload/接口或Host工具流程。当前readonly/API authority/epoch/目录/导航owner均保留。

最终main-CmdIWcOX.js/CodeEditor-CaOtXbHb.js，本人人工复核：[05范围](live-01/05-final-range.jpg)保留27–37 band；[06整文件](live-01/06-final-whole.jpg)代码在同一19–37上下文中恢复正常背景，实际readonly=true/editable=false，阅读不强制跳转；[07范围返回](live-01/07-final-range-return.jpg)重新定位27并恢复正确band；[09整文件隐藏重开](live-01/09-whole-reopened.jpg)仍在该内容、整文件正常背景。没有源码文案/DOM（Document Object Model，文档对象模型）断言、组件/screenshot测试，辅助数据只解释真实图片。

原Native77968/出生win32:639272012987920575、Host33660/出生win32:639272012978968686，固定600000毫秒/12累计请求，实际6EOF（End of File，流自然结束），取消0。自己112关闭，sole settlement owner 04:04:55.723准入，public shutdown 04:04:57.555/200，Native04:04:57.848 exited/0，早于固定04:04:57.879约31毫秒；不把这点余量改写为充足的关闭缓冲。原前台20142实际join0、独立物理输出请求/精确出生/18203无监听/完整auth-models副本退休。原源码全文/属性保管equal，完整成功outputs与Source事实脱敏保存。

当前Overlay types0、build1m2s/renderer surface0；只是编译检查，以上实际页面才是视觉验收。其他artifact/语言主题/目录内及大文件/权限错误、实时子Dock/Task/Mission/Tauri宽矩阵仍未验，整体持续goal active。以后应更早立即关闭自己页面后的服务，保留至少一分钟缓冲，不延长固定budget。

最终docs:check345 ops/25 groups、architecture-index18文档均actual0；145公开文本当前授权凭据扫描匹配0。两原checker返回完整exit0且所有运行/保管/归档观察器已结束后，才精确单文件保留Native自身5产物；helper只声明其验证的出生/目录/进程范围，不伪caller完成。9份AX行尾空白规范，原始文本私有raw-publications保留，截图未改。
