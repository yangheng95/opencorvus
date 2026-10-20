# 持续目标的本地化输入反馈

2026-10-21，单开发 agent，实际开发 `/ui`、19张人工截图。方案、根因与返工见[记录](../../records/2026-10/2026-10-21-goal-form-validation.md)。

## 结果

修复两个已实页复现的问题：中文表单仍显示英文浏览器错误；目标已填好却继续显示上一轮“请填写目标”摘要。原生约束校验先于应用提交，已有语言键尚未被使用；原本地摘要只在打开/提交时清理。当前四个原字段的 invalid 事件提供现有本地化文本，编辑清除原生自定义错误与过期本地摘要；服务端错误保留。required、原生数值下限/步进、焦点及原 save/服务检查保持。没有关闭浏览器校验、增加第二校验器、改变预算或创建有效目标。

最终10—19全部人工查看：英文/中文空目标和零预算、小数自动轮次提示正确，焦点落在对应原字段。将预算纠正1000/1、目标改成一个空格后，原生校验通过并进入原应用语义校验，15显示当前中文Feedback；随后填好目标，16清除旧摘要，17只提示当前零预算。18重开从Home草稿预填目标、预算回到未指定状态，19取消后仍在原首页编辑同一草稿。这些是实际交互，没有DOM（Document Object Model，文档对象模型）断言、组件测试或截图差异测试。

| 图片 | 实际含义 |
| --- | --- |
| [01](01-before-empty-en.png)、[02](02-before-empty-zh.png)、[03](03-before-budget-zh.png) | 当前正式485：英文原生提示；中文仍英文目标/预算错误 |
| [04](04-after-empty-en.png)—[07](07-after-fractional-turns-zh.png) | 首轮候选语言与原生焦点通过 |
| [08](08-after-corrected-native-submit.png)、[09](09-stale-summary-after-edit.png) | 首轮原生纠正后进入语义校验；09暴露编辑后旧摘要残留，不能当最终通过 |
| [10](10-final-empty-en.png)、[11](11-final-budget-en.png) | 最终构建英文目标/预算错误 |
| [12](12-final-empty-zh.png)、[13](13-final-zero-budget-zh.png)、[14](14-final-fractional-turns.png) | 最终构建中文必填、零预算、小数轮次与焦点 |
| [15](15-final-application-validation.png)、[16](16-final-edited-feedback.png)、[17](17-final-current-budget-error.png) | 原生合法→原应用语义错误→编辑退休旧摘要→当前预算反馈 |
| [18](18-final-draft-reopened.png)、[19](19-final-home-draft.png) | 重开与首页草稿保留/继续编辑 |

## 数据、原生收尾与检查

[before](before-preserved.json)、[首轮after](after-preserved.json)、[final](final-preserved.json)的原七表87行（4 Project/4 Session/14 Message/33 Part/28 protocol_event/2 request/2 outcome）含rowid、完整字段和时间全部保留，源库全部行及原大小/mtime保持。每个新副本只增加自己的1个Project，最终均5 Project/4 Session/schema3，canonical `{}`。没有用户数据库访问或清空数据。[prepare输入](prepare.ts.txt)与[只读数据checker](preserve.ts.txt)提供可审查运行输入，不是UI自动化。

[三个原scope](owned-scopes.json)：before原11212/18851，首轮after原46698/18853，最终原17964/18855。各自一次公开shutdown200，原句柄join0，精确物理/output/request/launcher完整结算后才准备下一scope。三个自有55/56/57页已关闭；用户18571未操作。没有复制auth/models、Provider预检、有效Goal或模型请求。

[最终构建](ui-build-final.log)原65506 exit0/51.82秒，`bun run build:overlay --skip-tauri`；[最终类型](ui-typecheck-final.log)原43952 exit0；[语言](i18n.log)两语言2523键；[文档](docs.log)与[架构索引](architecture.log)是辅助检查，不能替代人工图。首轮构建46205 exit0/53.29秒、类型22750 exit0仅属于04—09。归档日志规范行末空白，原scratch日志保留，不改写实际输出。

标准接口依据为[WHATWG约束校验](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#dom-cva-setcustomvalidity)：原生invalid事件、指定错误文本与清除自定义错误的契约。没有浏览器文案解析或替换原校验规则。

## 边界

本轮实页资格是Home创建表单；完成evidence字段、既有Chat/Task/Mission/SideChat沿共同组件代码修复并类型通过，未取得它们的独立实页资格。没有实际有效Goal、模型执行、所有输入法/浏览器或跨平台资格；本轮不以无效输入冒充模型端到端完成。Sources/Rendering未采样场景与完整配置10秒保存/5秒恢复仍未完成，没有改该性能路径，没有版本/发布。
