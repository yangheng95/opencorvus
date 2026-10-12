# 359 来源复制边界

[Recall与方案](../clipboard-boundary-plan-359.md) · [月记录](../../../records/2026-10/2026-10-13-clipboard-boundary-359.md)。本轮将358的复制异常复现到新标签页首次复制，并在独立MDN网站取得同样现象；不是仅Sources按钮的现象。精确浏览器/操作工具根因仍未知，没有修改产品剪贴板实现，未宣称修复。

## 手工复现与对照

所有条目来自同一个已关闭原生开发服务的真实历史页面。没有生成或修改消息/Source，也没有创建UI（User Interface，用户界面）测试页面或fixture（夹具）。剪贴板值和截图仅人工审阅。

| 页与操作顺序 | 观察结果 | 证据 |
| --- | --- | --- |
| 167先用工具写自有marker，原生复制乙2，再Shift+Insert | 草稿及随后两种读取均为完整乙:2 | [02截图](02-shift-insert.png)、[原观察](first-paste-observation.json) |
| 167原生复制乙3，立即读回，再Control+V | 完整乙:3 | [03截图](03-control-v.png)、[立即读取](same-call-read.json)、[粘贴](control-v-observation.json) |
| 168实际可见指针复制乙10，再Shift+Insert | 完整乙:10 | [07截图](07-fresh-pointer-paste.png)、[观察](fresh-pointer-paste.json) |
| 169首次可见原生复制乙2，显示Copied；首次读取后Shift+Insert | 读取及草稿仍为此前乙:10 | [09反馈](09-cold-copy-feedback.png)、[10粘贴](10-cold-paste-after-read.png)、[首次读取](cold-first-native-read.json)、[粘贴](cold-first-paste.json) |
| 169同一按钮再次复制乙2 | 完整乙:2 | [再次读取](cold-second-native-read.json) |
| 170首次可见原生复制乙4，再Shift+Insert，此前未调用该页clipboard API | 草稿和之后读取仍为此前乙:2 | [13截图](13-cold-paste-before-read.png)、[观察](cold-paste-before-read.json) |
| 171首次原生复制用户正文，随后再次复制同一正文 | 首次仍乙:2；第二次为完整原正文 | [15成功图标](15-message-copy-feedback.png)、[首次](message-first-read.json)、[再次](message-second-read.json) |
| 172独立MDN页面首次原生Copy，显示Copied，随后再次复制 | 首次仍为此前OpenCorvus正文；第二次为页面代码writeText(newClipText)，text/plain也一致 | [17截图](17-mdn-first-copy.png)、[首次](mdn-first-read.json)、[再次](mdn-second-read.json) |

MDN对照使用其[现有Clipboard.writeText说明页面](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)的Syntax复制按钮，不执行示例代码、不提交表单、不访问页面隐藏函数。该页面也说明写入Promise在剪贴板更新后兑现；OpenCorvus当前await单writer的代码与此合同一致。跨应用首次旧值的观察排除了“只由Source标题/行号改动导致”的解释，尚不能证明是浏览器本身还是操作工具同步，也不能直接证明用户普通桌面操作会有相同行为。

页168的第一个locator动作目标不在实际视口，未得到Copied反馈，04图也没有来源按钮，因此[fresh-tab-first-read](fresh-tab-first-read.json)不计成功复制或有效复现。随后实际指针对照另记为07。01/05/08/11/14/16为位置或准备截图；所有17图均实际呈现查看，未进行自动DOM（Document Object Model，文档对象模型）/文案/像素/剪贴板断言。

## 范围、实现与未满足项

SourceEntry以原Source.path/range构造目标；createClipboardCopy捕获该值、await共享copyText后才显示当前操作的Copied。正文ConversationTurnControl独立await copyText，浏览器transport直接返回navigator.clipboard.writeText，Rust桌面命令直接交给系统clipboard。没有另一个字符串转换或恢复旧值的产品路径证据。图片image/png写入未参与本轮。

本轮没有产品代码、协议、模型、调度或状态变化，不增加空写入、二次写入、延时重试、读回权限或后备实现。首次复制的精确宿主/工具根因和普通桌面应用验收仍未解决；外部对照不能当作产品已修复。已取得可重现的调用顺序及跨应用证据，后续继续调查这个边界，并继续原Sources/Rendering与功能体验目标。

## 真实运行与归档

clipboard-boundary-359 / localhost:18354/ui：原启动handle76574实际exit0，Native耗时447294ms，小于固定600000ms。5张本地页167–171均先关闭，公共shutdown随后完成；独立MDN页172也已关闭。Host/Native精确身份、端口、输出、请求与配对边界完整闭合，自有5份Bun pile在物理退出后按精确出生/路径归档。没有用户应用操作或新模型请求；历史凭据不存在，不宣称新Provider资格。

先重新读取356-live-02全源schema/config/recovery/permissions/Message/Memory和物理事实，再完整copy90表，原Project/Session保留。最初把已存在的报告目录误用为新运行证据目录，copy在创建运行前拒绝；修正为独立history子目录后原检查通过，失败日志保留。没有放宽准入或覆盖历史。

[实际runtime checker](checks/runtime-qualification.json)逐值核对11 Message/192 Source与完整闭合原库相同，90表复制、实际main-CrFGPI-s.js的HTTP 200交付、Native终态及输出/request完成通过；这不替代剪贴板或视觉验收。[docs检查](checks/docs.log.gz)、[完整归档清单](checks/archive-receipt.json)、[凭据扫描](checks/credential-scan.json)。归档字节回读只校验压缩完整性，不作为源码或功能验收。
