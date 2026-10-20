# Goal 页面模型选择与双语指南

[Recall、范围与实施前裁决](../../records/2026-10/2026-10-20-goal-model-selection-review.md)。本轮跨本地日界，证据归档于2026-10-21；单开发agent，无UI（User Interface，用户界面）自动化。只使用全新自有数据根与18819/18821/18823源码CLI（Command Line Interface，命令行界面）开发页面，未操作用户18571、用户数据库或旧149 Project/198 Session历史库。

## 实际完整路径

初始canonical配置始终为{}。无模型的真实Goal进入blocked/model_not_configured、0轮/0消息；原会话和Goal保留。完整auth/models成对暂存且精确模型投影、实际流式预检成功后，在页面模型菜单点击GPT-6.1 Sol，再显式Resume原Goal。之后通过New chat返回无目录Home，保留所选模型并确认创建第二个Goal。

| 实际路径 | Goal | 接受轮次 | 累计令牌 | 真实结果 |
| --- | --- | ---: | ---: | --- |
| 原阻塞Goal页面选择模型后恢复 | pev_g0VYbeG9M00ru2dhyMQ7 | 1 | 33,642 | GOAL_MODEL_479，模型真实调用complete |
| Home使用所选模型创建新Goal | pev_g0VYbfTed00GsWyP2RtS | 1 | 33,825 | GOAL_HOME_MODEL_479，模型真实调用complete |

[原Goal、Session模型配置、消息、协议和用量关联](goal-model-selection.json)包含正向核对：两个Session配置都是openai/gpt-6.1-sol，两个原用量关联之和各自等于公开Goal累计，整个canonical仍是{}，没有预设model/small_model代替页面操作。当前自有业务根3 Project/3 Session/schema3；一个独立Provider预检、一个原Goal、一个Home匿名Project的Goal。[最终视觉根取消核对](visual-cancel.json)为1 Project/0 Session/schema3。

[Provider原始观察摘要](provider-summary.json)：固定整批6/6个实际gpt-6.1-sol请求（2预检+2恢复+2Home，所有helper计入）全部stream200且原source reader EOF（End Of File，流结束），未扩额。真实流程成功不等于当前代码存在模型传递缺陷；main已正确快照模型并传给两个Conversation创建入口，本轮没有改写这条行为。

## 交付与人工视觉复核

本轮仅改两个locale的共享指南第一步标题/正文：明确输入框下方的模型菜单、空列表中的“配置 Provider…”入口，保留合法继承默认模型、确认后创建新会话及已有会话顶部控件。没有API（Application Programming Interface，应用程序接口）、schema、权限、模型解析、调度或消息语义变化。共享错误原因未加主界面方位，避免误导没有同一Composer菜单的SideChat。

13张截图均实际呈现并人工查看，未做截图/DOM（Document Object Model，文档对象模型）/组件/源码文案断言：

- 原首次页面：[01首页](01-before-home.png)、[02空模型菜单](02-before-empty-model-selector.png)、[03真实OpenAI配置入口](03-before-provider-configuration.png)、[04缺模型阻塞](04-before-blocked.png)。配置入口只展开查看，未登录或填写凭据。
- 页面选模型恢复：[05已连接模型](05-recovery-model-menu.png)、[06明确选择后仍等待显式Resume](06-recovery-model-selected.png)、[07原Goal完成](07-recovered-complete.png)。
- Home新建：[08所选模型保留](08-home-selected-model.png)、[09第二Goal完成](09-home-goal-complete.png)。Home可真实显示完整技术模型ID，未将其误报为模型未传递。
- 新正式构建：[10英文指南](10-final-en-guide.png)、[11中文指南](11-final-zh-guide.png)、[12中文表单](12-final-zh-form.png)、[13取消后首页](13-final-zh-home.png)。长英文、中文正文和固定操作区均在1280×720实页完整可用。

[正式构建](build.log)约63秒并通过renderer public surface检查；[类型检查](ui-typecheck.log)、[两语言2523 key检查](i18n.log)通过。两个实际生产HTTP（Hypertext Transfer Protocol，超文本传输协议）读取检查器输出见[原Goal恢复](observe-recovered.log)和[Home创建](observe-home.log)。它们读取真实状态/持久配置/消息/Provider EOF，无浏览器测试逻辑。纯UI文案没有新增或运行UI自动化测试。

[文档检查](docs-check.log)通过345 ops/26 groups，[当前架构索引](architecture-check.log)通过20篇文档。归档日志仅去除行尾空白；原私有日志保留实际内容。

## 结算、凭据与边界

[三个原native句柄结算](settlement.json)：1921/67464/73685均原句柄join exit0、公开shutdown200，精确Host/Target物理状态、output drain、request cleanup及launcher完成；三个原日志都在后续启动前冻结，自有tab38/39/40已关闭。[凭据退休](credential-retirement.json)：全部6个source reader EOF早于运行完整对退休；2636个自有文件按5个实际凭据值检查clear后，private auth/models完整对也精确退休；源凭据大小/修改时间不变，无refresh/exchange或源写入。

本轮没有测试服务商登录/密钥保存、Task/Mission的Sol执行或原完整历史Sources/Rendering；不能由两个有限Work Chat Goal推导全部场景。当前Goal条按既有五秒API轮询刷新；第二Goal完成文本先出现、条仍短时显示Budget reached/0用量的工具观察与后续公开complete/33825一致，图09为收敛后的真实状态，未把该延迟包装为调度故障或已优化。完整配置10秒保存/5秒恢复仍未达标。长期Goal继续。
