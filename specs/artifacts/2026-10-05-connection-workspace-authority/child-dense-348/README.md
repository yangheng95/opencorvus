# 348 多来源子侧栏与同名复制控件

[Recall、调查与实施方案](../child-dense-plan-348.md)。全程单一开发agent；隔离产品Task只运行一个真实研究员，用于进入用户指出的SubagentConversationPanel。

## 本轮修复

两个目录的同名文件都含第20行，原复制按钮名称完全相同，尽管剪贴板值与打开文件按钮正确。SourceEntry对普通文件复用sourceDetail的相对目录与行号作为复制控件名称；附件、URL和实际复制值沿用各自契约。没有新状态、协议或UI自动化测试。

实际[修复前控件观察](02-copy-controls-before.txt)与[修复后观察](07-copy-controls-after.txt)供人工复核，没有把这些文本写成断言。四份copied记录均由实际Space激活后读取剪贴板产生；甲乙路径各自核对完整原值，甲文件第20行打开后选中真实“甲记录19”。

## 真实页面复核

| 截图 | 人工观察 |
| --- | --- |
| [01](01-expanded-during-first-prose.png) | 64条搜索来源展开，研究员第一组正文仍在生成 |
| [02](02-copy-乙20-streaming.png)、[03](03-copy-甲20-streaming.png) | 两个同名文件第20行分别复制，完整值正确且有Copied反馈 |
| [04](04-list-position-after-web-source.png) | 网页来源及后续正文进入，来源列表保留在同一阅读区域 |
| [05](05-reopened-during-later-prose.png) | 关闭再打开子侧栏，63 more保持展开，保留列表位置 |
| [06](06-collapsed-sources-and-body.png) | 收起后来源与真实正文衔接；此时研究员已完成 |
| [07](07-after-甲20-focus.png)、[08](08-after-乙20-focus.png) | 新构建加载后，两份文件的复制动作带各自目录，实际值不变 |
| [09](09-甲20-editor.png)、[10](10-甲20-editor-ready.png) | 09仅文件加载中，10才是完成加载且真实第20行被选中的证据 |
| [11](11-file-boundary-return.png)、[12](12-file-boundary-clear.png) | 从文件页返回，长列表保持展开；Escape关闭Tooltip后清楚看到第33个来源进入甲目录 |

12张图片均实际呈现并人工查看。前五张时间落在该真实worker的Provider reader区间，见[实际后端检查](checks/actual-qualification.json)与[screenshot-times](screenshot-times.json)。本轮没有观察到列表重新出现Rendering或丢失展开，但未记录全部帧；不能宣称原长期Research Studio闪烁全部修复。64个Source也不等于64个Markdown owner。本轮修复后的控件复核发生在Task完成后，不冒充修复后的新一轮流式验收。

## 实际任务、模型与闭合

- Task `tsk_g00VXpiXcz00KjYqx3vV`，worker `ses_ho9Gh33iZxyYclSMkLkj`；真实生命周期283988ms后completed。
- 两份实际输入各32行搜索命中，合计64个file来源；再加指定MDN URL和完整甲文件读取，共66个Source。所有来源均在真实Task流与当前持久化记录中对应。
- 研究员正文53/2054/1917/2200字符，共6224；负责人通过真实read_agent_message读取了三个叙述段的完整原文及工具输入输出，已逐值核对，未要求合并重写。原始glob一次多带“ご”后改正，以及研究员读取负责人事实索引的额外调用，均完整保留，未隐藏。
- 原始公开事件观察器67376实际exit0：5023事件、614156压缩字节、17597459解压字节；7个text字段最终值与持久化trimEnd契约一致。
- 19次实际openai/gpt-6.1-sol流式请求全部HTTP200和EOF；凭据usable、完整模型目录projected、实际模型分别验证。
- 原启动33182、构建94127、类型检查87261均实际join0。新`main-enuOTKXR.js`与基线`main-DbppdFkA.js`均由18325服务真实返回200。
- 仅关闭自己的137页和所属服务；Native78428/Host52996精确出生身份已闭合，Native500438ms，输出/请求/配对auth与models清理完成。Task创建器同样实际exit0。

检查器初次使用斜杠字符串查找Windows目录导致本地错误，改为path.dirname/basename后重跑原验收通过；[初始错误](checks/checker-initial-path-error.log.gz)如实归档。80份监督原始文本打包保留；原日志、实际脚本与公开流完整脱敏压缩。61份文本（包括压缩后解压内容）凭据扫描0，私有原件保留。压缩完整性只验证真实归档内容，没有源码哈希验收。

原Research Studio旧schema历史没有被这份新Task替代为已通过。本轮也未扩大到多项目并发或全部历史长度；当前证据没有建立调度异常，因此没有据此改动共享调度。
