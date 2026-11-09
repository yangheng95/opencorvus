# 归档行操作标明当前对象

## Recall

用户要求持续分批迭代直到明确停止，最新要求独立不委托。每批根因/影响先落盘、真实桌面和本人截图、聚焦正向检查、正常同步推送。前批 `7f10d66dc` 正常推送；HEAD 与上游 0/0、177 条原工作区状态一致。GPT-6.1 Sol 凭据授权仍无新答复，本批不读取凭据、模型目录或调用模型。

已读 AGENTS、07-panel Archive queries、两批归档分页与焦点记录、当前 ArchivePanel 行/操作与 workLedgerProject/projectLedgerDisplayName、Button/ArmedConfirmButton 和现两语种消息、正式聊天恢复路由与共享工作台只读查询。全仓检索四个文案键 `archive.open_item` / `archive.restore` / `archive.delete_permanently` / `archive.delete_confirm` 当前生产使用仅 ArchivePanel；ArmedConfirmButton 还服务其他表面，本批不改变其确认规则。未找到触及路径的界面自动化测试。参考 [W3C 描述性标签](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html)和[按钮语义](https://www.w3.org/WAI/ARIA/apg/patterns/button/)，仅验证当前桌面实际可访问名称，不宣称读屏或全站符合。

## 根因与影响分析（实施前）

前批 Tab 到不同归档行时，实际按钮名称只为 Restore，不携带记录。待同名双项目复现：当前行正文有真实项目名和路径，但 Open 只插值标题，Restore 与永久删除只使用固定动词，ArmedConfirmButton 进入确认后只说「此记录」。实际焦点移到控件时，名称可能不能说明所操作的是哪个项目里的哪条历史。视觉邻接项目名不等于控件的独立名称；即使此前修复后焦点移动正确，也没有改变名称的输入。各点击 handler 已闭包捕获真实 row，未证实任何服务路由或归属错误。

若复现，使用行自身的原题名（现标题缺失时的原 ID）及已经显示的规范项目名作为同一文案输入，在当前语言中描述 Open、Restore、永久删除及已 armed 的说明。项目名与行显示复用同一个响应式派生，不创建数据缓存、改名或合成身份。可见按钮文案仍保持短动作；图标原 tooltip 和可访问名称沿现 Button/ArmedConfirmButton。保持第一按进入确认、第二次才执行、现时间、失焦撤销、恢复焦点和实际 handler 完全相同。不会点击第二次永久删除。候选含同名项目的完全唯一性没有证据，不声称所有用户自定义名称全局唯一；实际目录仍在原行。

影响面仅归档行可访问名称/确认说明、当前语言与同名歧义。读写接口、后端恢复/删除、权限、任务执行、持久格式、搜索和游标均不改。没有执行轮次调度/并发/终态异常证据；真实已归档的空聊天恢复按已有路由且不启动执行。风险包括同名仍歧义、脱离当前语言、标题或项目原文被改变、按错删除、焦点/操作目标变更。测试以真实同名双项目原 ID 和界面状态复核。

## 验收

Temp b49 前后各一个隔离 profile，两个独立 Git 项目 North Review/South Review，各创建并真实归档一条同题名 `Shared archive review` 的空 Chat，无消息或任务。通过真实 `/ui` 归档页面键盘操作，原版核对两行原显示和重复名称。改后 EN/ZH 复核各行动词、同名对象和真实项目；只按一次永久删除并观察当前对象的确认描述，再移开焦点撤销。用可访问名称定位并实际打开 South 的原只读归档；通过真实 Restore 恢复 South，验证其确切原 ID、创建时间、归档状态，North 保持原归档。前后真实 `/doc` 校验归档/活动查询与身份；本人保存并检查实际桌面截图。无永久删除、界面自动化、模型或用户进程操作。关停自己的服务并消费退出，核对四份原 Git 文件和原会话事实，类型、双语、构建、文档作为辅助。

## 真实前态和实施定稿

39019/IAB110 两条同题名实际归档，01 显示 South/North 项目原文及各目录。两行实际可访问的 Open 名称都为 `Open Shared archive review`，Restore 都是 `Restore`，删除都为 `Delete permanently`。单次 Enter 在 South 原控件把确认置为 armed（02），说明只称 `this record`；Shift+Tab 离开，没有第二次确认。随后实际全局归档与各独立 Chat GET 三项 200/current schema 保有两个项目原归档、ID 与创建值，页和进程正常退休。

定稿：行项目显示与四个本地化动作模板统一读取当前 `archiveProjectName`，原投影 `projectLedgerDisplayName` 的参数保持。仅扩展现四条模板参数为 title/project，原动词、可见 Open、图标、确认时限、选中/恢复和失败路径保持。不用 ARIA 动态隐藏另一名称，原 primitive 负责名称和 armed 描述。

## 验收结果

39020/IAB111 使用最终 `main-D94d7JQf.js` / `ArchivePanel-djaI8I0i.js`。03 两行项目原文、路径和原题名均正确，可访问的三个英文动作各带 North 或 South，04 切换中文仍是各自真实项目及原题名。05 对实际 South 控件单次 Enter，原 armed 视觉勾及当前说明明确为 South/Shared archive review，Shift+Tab 后同控件状态 0、焦点落在 South 恢复，未确认永久删除。按实际新名称打开 South（06），真实 08:02 归档时间匹配 South 原项，页面为归档只读；进入设置按带 South 的恢复按钮，实际成功后仅 North 08:01 原行仍在（07），现焦点归还在该行恢复控件。返回应用，活动 South 下为原题名（08），未发送消息。

前态与修复后初态各三项实际 HTTP 200/当前运行时 schema；恢复后四项 HTTP 200 覆盖全局归档、两条精确 Chat 和活动工作台。持久读证实 South 原 ID、标题、项目、目录、创建时间不变，归档值变为 null，North 原归档时间完整；前态两个原归档完整。四份独立 Git 文件/HEAD 原字节保留，两个库各 Project 2、Session 2、Message 0、engine_task 0，配置文件清单空。无永久删除或任务/模型执行。两个自有页面关闭、两个自有服务正常关闭并消费进程退出0，无待结算 Prompt。

8 张[桌面截图及检查记录](../../artifacts/2026-11-09-archive-action-identity/README.md)本人查看。类型、双语 2932 键、构建 50.12 秒、渲染器公共面、文档与架构索引均通过。名称以真实可访问树和有对象的实际键盘操作核验，截图核查布局、armed、只读和恢复状态；未运行读屏器或宣称跨浏览器。未发现服务归属错误。
