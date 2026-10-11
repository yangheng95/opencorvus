# 324 来源纯文本的实体与结构

2026-10-12，单agent。[实施前Recall](../source-text-plan-324.md)。本轮替换后端webfetch的纯文本提取器，没有前端修改、合成消息或UI自动化。

## 已修复

一个编译好的html-to-text转换器替代原HTMLRewriter与全局skipContent标记。字符实体只解码一次，块/列表/br有明确边界，pre保留缩进，内联文本保留词缀；忽略元素按子树处理，后续普通尾文本正常保留。head标题不再重复进正文，原Source metadata继续保留发布者标题。链接保留文本，图片不引入资源URL，没有新网络请求或脚本执行。

核心package精确引入html-to-text10.0.1与开发类型9.0.4，bun.lock仅增加对应依赖。已检查库公开配置/本地实现，原5MiB响应字节上限低于库默认16Mi输入字符上限，最终输出仍由原UTF-8字节预算处理；未添加新的静默截断策略。Node/Bun实际类型与运行验证通过，未宣称完成新的安装包发布。

## 真数据与页面

[规范结果核对](actual-text-contract.json)从[完整真实消息与工具结果](live-01/canonical-current-conversations.json)读取，不以模型回复当作oracle。普通Work Chat `ses_-zUSD61nszzp9Buuhd3w` 对与323相同的W3C test.xhtml先text再markdown，两个实际response标题保留application/xhtml+xml。纯文本5579字符，两个方向性示例均实际包含`Arabic text: غرب`，并保留`Line`/`break`换行与pre缩进；markdown7553字符，原Source标题及URL正确。字符数量仅描述这次结果，不作为性能指标。

[323原观察](../source-mime-323/actual-source-contract.json)仍保留数字实体，当前结果解码为真实字符。比较器最初错误地假定旧输出的标签和实体在同一行，实际旧正文保留了源HTML换行，因此第一次核对失败；已用原始实体序列核验该历史事实，新输出仍检查完整明确的Arabic行。原[第一次核对日志](verification-first.log.gz)与[修正通过](verification-corrected.log.gz)均保留，没有改动历史数据迎合检查器。

人工看过三张真实截图：[工具正文](screenshots/01-plain-text-tool.png)、[Sources标题](screenshots/02-source-and-decoded-text.png)、[阿拉伯文与换行/缩进](screenshots/03-decoded-arabic-and-line-break.png)。第三张为模型按实际结果给出的简短引用，工具正文的正确性另由规范Tool结果证明。没有截图比较、DOM断言或浏览器fixture；没有把双向排版或浏览器布局解释成文本提取验收。

## 验证与退出

原[红测](before-text-observed.log.gz)真实输出了错误实体、拼接段落、`beforeend.`与嵌套对象内容；不是预设模型错误。替换后[9项聚焦测试](after-text.log.gz)76断言通过；补充链接/图片文字契约后[同一源测试重跑](text-links-contract.log.gz)38断言通过，当前9个唯一用例合计77断言。Source/fragment持久化、HTTP大小/超时/取消/失败和原challenge处理都进入原后端实现。核心typecheck、路由6规则/34文件、package-topology10包、docs345操作/25组通过。

真实6次gpt-6.1-sol请求均流式HTTP200正常读到末尾（含预检），处于原12请求预算内。没有Task/产品worker派发。原NativeService执行器41028、聚焦45164、类型64388均actual exit0。自己的tab96已关；Native36012/Host70104物理/output/request退出，18294释放，复制auth/models配对清理，[终态记录](live-01/source-text-324-live-01-qualified-surface-completion.json)完整。未重启或操作用户正在使用的进程。

当前修复有代码、本地真实HTTP、授权Provider、规范数据及人工页面证据。持续Sources/UI与整体功能目标仍保持active，未把本次通过扩大为全部页面和全部问题已修复。
