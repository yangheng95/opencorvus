# 351 长来源列表阅读与收起

[Recall 与方案](../source-collapse-plan-351.md)。单 agent 完成调查和实现，使用348已经真实运行完成的完整Task历史，在当前开发服务 `/ui` 进行人工复核。

## 问题与改动

64条搜索来源展开后高约1968px。[原末尾画面](03-before-last-source.png)中，第52—64条和后续正文已经可见，唯一收起入口却在视口上方约1383px。之前的目录去重、复制命名和阅读保持没有提供列表末尾的退出动作。

共享 SourceParts 现在在展开列表末尾提供“收起来源 / Collapse sources”，使用现有 Button 和原 cardExpanded。操作声明阅读意图，关闭原 disclosure，把焦点还给唯一 summary，并让收起后的来源组回到可见区域。不增加展开状态、恢复计时器、第二个 summary，不改变来源顺序、数量、打开地址或复制内容。原生 details 的[单一 summary 合同](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element)与[焦点 API](https://html.spec.whatwg.org/multipage/interaction.html#focus-management-apis)是交互依据。

样式检查还发现既有PDF透明文字层的 `line-height:1` 不符合当前 token 合同，已替换成值同为1的 `--ui-line-height-flat`；没有放宽检查器。该等值变更不构成本轮独立PDF视觉验收。

## 实际页面与边界

8张截图均实际呈现并人工查看，时间见[截图记录](screenshot-times.json)，几何和焦点仅作[人工观察依据](manual-observations.json)，没有DOM、组件、源码或像素断言。

| 画面 | 观察 |
| --- | --- |
| [01](01-before-expanded-top.png) | 旧版唯一展开/收起入口在顶部 |
| [02](02-before-list-tail.png) | 向下阅读后进入正文，此图已越过来源末尾 |
| [03](03-before-last-source.png) | 回到第64条附近，末尾只有来源打开/复制，无收起动作 |
| [04](04-after-tail-control.png) | 新版末条来源后的小型收起按钮和正文衔接 |
| [05](05-after-mouse-collapse.png) | 实际鼠标收起，第一条来源、顶部入口与后续正文回到可见区域 |
| [06](06-after-keyboard-focus.png) | 原生Space重新展开，从末条复制按钮Tab至收起动作，焦点清晰 |
| [07](07-after-keyboard-collapse.png) | 原生Enter收起，焦点返回原summary |
| [08](08-after-dock-return.png) | 关闭并重开侧栏，仍收起且保留读点 |

05/07/08的子面板scrollTop均196，来源组top143.94/bottom209.04，面板top143.60；第一条与正文同屏。05/07主会话scrollTop均1069.6。这些是实际只读几何的解释，不是自动测试通过指标。截图中的模型配置提示来自无凭据只读历史模式，不能作为正常已授权生产页面的状态。

实际只验了历史Task的child面板；主会话/Side虽复用同组件，未独立操作多来源组。摘录、仅有一条剩余来源、独立PDF、原Research Studio209来源全历史和持续流式Rendering仍不在本轮视觉证明范围。

## 原始数据与收尾

[实际运行检查](checks/runtime-qualification.json)对原历史和两份完整副本逐值核对13条Message、66条Source、17个持久化Provider请求身份。348当时实际Provider审计19个流包含预检，不能混为数据库的17条。本轮没有新模型调用或重启Task。两次启动前分别以当前schema/config/recovery/lease/Task/Memory读取器检查，复制90表完整内容相等；保留同一Task `tsk_g00VXpiXcz00KjYqx3vV`、child `ses_ho9Gh33iZxyYclSMkLkj` 和原项目身份。

| 运行 | 实际前端 | 原始结算 |
| --- | --- | --- |
| history-01 / 18330 / 页143 | main-Byx48Ve-.js，HTTP200 | 原启动55760 exit0；Native88648ms，物理/输出/请求闭合 |
| history-02 / 18331 / 页144 | main-qcEW9nAj.js，HTTP200 | 原启动68603 exit0；Native139001ms，物理/输出/请求闭合 |

自己的两页均主动关闭，精确Host/Native/端口闭合；未复制auth/models。原生生成文件按确切出生时间归档。第一次私有串联准备命令因未赋值LASTEXITCODE提前结束，首次启动在缺复制清单处退出、尚无进程；分开执行原检查与复制后通过，原失败事实保留。

前端构建88361、类型73628、中英文2137键检查及CSS token检查均实际exit0。首次CSS检查失败保留，等值修复后原检查通过。完整桌面构建3865也已实际exit0，桌面安装目录仅在本地生成，没有发布、标签或用户应用重启；该构建结果不能替代真实网页验收。docs:check通过345操作/25组。

完整运行、检查与帮助脚本见[运行归档](checks/archive-receipt.json)、[脚本归档](checks/helper-archives.json)；4份较大的只读观察数据完整压缩并私有保留原件，[清单](checks/large-archives.json)记录路径。114份文本含解压内容的[凭据扫描](checks/final-scan.json)为0。字节比较仅证明真实归档完整性，没有用源码哈希代替行为验收。
