# 成员活动导航身份与朗读名称

2026-10-22，单Codex开发agent，[实施前分析与逐次视觉修订](../../records/2026-10/2026-10-22-agent-rail-identity.md)。修改仅涉及活动栏、两语言目录、其局部样式与当前架构合同。

## 改动与真实证据

| 对象 | 原行为 | 最终行为 | 实际证据 |
| --- | --- | --- | --- |
| 两同角色成员按钮 | 名称3937/3948字元，追加整个原输入，标题同为base-researcher/Completed | 公共Session身份DP6d/ByPb，英文名称各39、中文各31字元 | [原观察](before-rail-observation-02.json)、[英文最终](final-a-description-en.json)、[中文最终](final-rail-observation-zh.json) |
| 原生关联描述 | 中间版名称已短，但aria-describedby仍引用3943字元的完整Tooltip | 悬浮框只保留身份/真实状态，英文关联内容31、中文25字元 | [原3943关联](review-description-observation.json)、[实际安装primitive](tooltip-association-source.json)、[最终中文关联](final-b-description-zh.json) |
| 原输入 | 导航Tooltip前三行实际只见技术提示前缀 | 原Message/Part/inputPreview数据保持，完整输入在原会话Handoff context读取 | [实际原文观察](final-a-handoff-observation.json)、[展开截图](09-final-a-handoff-en.png)、[原Question](10-final-a-original-question.png) |
| 实际导航 | 旧入口能到B但缺少身份区分 | 新入口英中各能到原A/arXiv与B/ACL来源，编排器仍定位Main原卡片 | [英文A](08-final-a-source-en.png)、[英文B](12-final-b-source-en.png)、[中文A](20-final-a-source-clean-zh.png)、[编排器定位](13-final-orchestrator-locate.png) |

这里的长度是原DOM（Document Object Model，文档对象模型）属性或textContent的JavaScript string.length代码单元数，不是语音时长或真实屏幕阅读器软件验收。身份和状态使用原会话字段；按钮、Tooltip、面板选择和来源必须对应同一实际对象。未覆盖所有执行状态、普通Session/Mission独立页面、新模型流、流中刷新或传输断连重连。

原Task为tsk_g00VYhVoHG009opnUqaV，A为ses_hMgssyDsC0xd7DISDP6d，原最终Message为msg_g0VYhW8rf00ZNXlsbIIs；B为ses_hLCAejj9kewYbP2FByPb，原最终Message为msg_g0VYhW7Ym00oixQDUhdN。实际来源、原输入与正文来自上一轮真实Sol任务，本轮没有新建消息、Task、Goal或效果重放。

不解析提示词关键词、另造成员名称、override原生关联或隐藏原消息；删去唯一旧compactLabel、重复导航input预览及仅服务它的旧语言键/样式。原inputPreview在其他进度卡/会话仍使用；不改公共数据、排序、定位控制流或数据库。

## 20张人工图

| 图片 | 范围 |
| --- | --- |
| 01 | before带Task参数初次停在首页，不能算Task自动恢复通过；从真实侧栏进入后继续 |
| 02–04 | 原两同角色Tooltip标题相同、长名称；原B来源可读 |
| 05 | 第一版身份已区分，但状态换行留下孤立分隔点，促成本轮样式修订 |
| 06 | 身份/状态分行正确，但关联描述仍3943字元；中间版不是最终验收 |
| 07 | 最终英文紧凑身份、状态，原生关联内容31字元 |
| 08–10 | 最终A真实来源、完整原交接与Question可读 |
| 11–13 | 最终B身份、正确ACL来源及编排器定位 |
| 14–15 | 实际设置切到中文，按钮/状态/关联内容响应，原文保持其真实语言 |
| 16–17 | 中文同B侧栏隐藏/重开，原来源及位置保持 |
| 18–20 | 中文A身份及正确arXiv来源，最后一图移开来源hover浮层便于查看 |

所有图片均通过内置浏览器实际呈现并人工查看，没有UI（User Interface，用户界面）自动化、组件渲染、源码文案、截图或像素断言。一次Playwright checkbox语义定位未匹配，因为该AX（Accessibility，无障碍）控件不是同一DOM role；读取当前AX后按实际索引172/171完成操作。超时没有被算成产品失败或通过，也没有盲目重试同一定位。

## 四个隔离范围

| Scope | 端口 | 原exec | 原native PID | IAB页 | 实际模型/上限 |
| --- | --- | --- | --- | --- | --- |
| before | 18933 | 54627 | 91304 | 90 | 0/0 |
| after | 18935 | 51493 | 91396 | 91 | 0/0 |
| review | 18937 | 53525 | 73068 | 92 | 0/0 |
| final | 18939 | 70991 | 32004 | 93 | 0/0 |

[范围结算清单](scope-disposition.json)及各自physical-terminal文件保留原公开shutdown200、exec exit0、原生物理/输出/请求/launcher与精确出生链结算。四页都已关闭。全部模型0/max0，未复制auth/models或使用凭据；图片中的模型配置提醒来自这个明确无凭据的隔离只读范围，没有据此判定用户Provider配置故障。用户18571进程、页面、数据库不操作。

[完整数据核对](data-preservation-observation.json)证明四scope各90表152721原行、全部表计数/字段/rowid或主键/时间相同，Provider activity382→382，所有原源bytes/mtime、schema3/实际对象/integrity、完整五键canonical保持。没有清库或迁移，也没有回写旧租约。

正式Node/Vite构建after/review/final原49730/14261/14153分别53.27/51.75/52.56秒，均exit0；before复用无生产差异的508正式main-BZjSJ4zp。第一after实际main-BZfoDLYa，最终实际main-Bv-r8j-J；服务冻结启动时的静态字节，因此每轮以原生完整结束后新隔离服务加载新包。运行不是独立Vite服务。构建耗时不作为性能达标证据。

最终Overlay类型检查原73465通过，两语言目录2526键与CSS（Cascading Style Sheets，层叠样式表）token检查通过；它们不替代视觉。目录/架构检查记录另附，正常push还会执行仓库完整钩子。原始构建日志保留工具输出字节。脚本标注实际本机.tmp-product-iteration位置，不是发布工具；此处不归档全库私有dump、数据库、完整运行日志或凭据。

初始Task参数页在before停首页、后续三个正确默认目录范围自动恢复的差异只作下一轮调查线索，当前证据不能据默认目录横幅直接认定根因。该路径、成员流中刷新/同文档重连、完整149目录10秒保存/5秒恢复、Rust父依赖图和其他未达矩阵继续保留，长期Goal active。
