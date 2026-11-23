# 连续浏览多步任务专家团匹配项

## Recall

用户要求本人独立持续分批调查并迭代。先复现与分析根因、影响和验收并写规格，再实施、亲自操作真实桌面和复核截图、运行聚焦正向验证、范围提交、合并上游及普通推送。第 461 批已确认远端与本地同为 5bb22557e，原有 177 条工作区状态保留。本批仅用自有隔离项目、内置目录和手动草稿。模型调用和供应商凭据与该路径无关。

已读 [当前面板架构](../../current/architecture/07-panel.md)、[专家团搜寻的首末项入口](2026-11-23-mission-squad-search-keyboard.md)、[项目范围搜索回读](2026-11-12-mission-create-squad-search-settlement.md)、[共用搜索结果导航](2026-11-23-release-history-result-navigation.md)、[多步任务技能续行](2026-11-23-mission-skill-result-navigation.md)。核对 MissionCreateDialog、SearchField、Checkbox、ArchivePanel、ReleaseNotesPanel、MissionSkillPanel、专家团服务及公开搜索路由、两种语言提示、选择和草稿的聚焦测试。全仓搜索 resultFocusTarget、createSearchResultNavigation、data-search-match、aria-keyshortcuts、expertSquad.search 与搜索回读入口。对话引用和专家团设置各自使用独立控件。触及范围未发现现存界面自动化测试。

## 基线与根因

独立开发模式 40816/ui/ 加载 main-Ce7V_k1e.js。正式项目搜索 research 的超文本传输协议（HTTP）响应为 200，顺序为 research-studio、base，total_count 为 2；zzreview462noresult 返回 200 和零项。界面还保留已选 Dynamic 并标明不在本次搜索。英文 100% 从搜索框按下到 Research Studio，第二次仍停在那里且表单滚动。原生 Tab 可经过 Base 到保留的 Dynamic，选中状态为真。简体中文 160% 从搜索框按上到 Base，第二次仍停在那里。取消两个临时表单后，正式 Mission（多步任务）列表返回空。 [真实基线截图](../../artifacts/2026-11-23-mission-squad-result-navigation/README.md)

先前修复让搜索输入通过 resultFocusTarget 找到首或末个可用原生复选框。已安装列表的原生复选框只有 onChange，没有相邻项的按键事件，浏览器接收后续普通方向键。列表保留的已选行和安装入口在相同容器中，只有当前回读接受的匹配身份才有 data-search-match；因此直接用全部行会跨入保留项。项目、工作类型、对话框代次、请求序号继续决定搜索回读归属，等待或读取失败时已有条件停用导航。这些机制解决候选正确性和首末项入口，尚未接上已存在的结果内导航。

影响限多步任务新建表单专家团选择区域以及共享按键处理的归档、技能和更新日志三个调用者。后者是原生按钮，按键目标与原注册元素一致。Checkbox 其他调用方未在该组件传入 aria-keyshortcuts，转交原生输入后仍沿用自身标签和值。范围外移除及其回焦、工作类型、市场安装、空查询、选择摘要、草稿请求和保存回执继续沿各自正式路径。未观察到调度、队列、唤醒、重试、重启、执行轮次或终态异常，后端路由、数据结构、版本及发布均无改动。

## 实施与验收方案

以当前结果且可用的原生复选框作为唯一导航集合，让现有共用函数同时处理输入首末项和组内相邻项。允许列表容器代理按键，按真实事件目标识别集合中的当前控件。仅在方向键所属目标为集合成员时消耗普通上下键，保留边界、修饰键、原生 Tab 和 Space。两种语言更新方向键提示，按键说明绑定搜索输入和当前匹配的原生复选框。保持现有焦点样式，通过实际放大页面检查移出可见区后能看到下一行。

英文 100% 与简体中文 160% 实页分别从输入进入首或末项，再往相邻项浏览，确认边界、精确焦点、原生选择、原生 Tab 到保留项、零项与清除。实际键盘选择并保存自有草稿，在正式回执与数据中核对项目、原请求、确切专家团和待办位置。真实更新日志用日期复核共享原生按钮路径的方向键与 Enter。独立检查目录请求、原项目文件、SQLite 完整性与会话和消息状态，人工复核原截图及正常关停。运行聚焦选择和草稿契约、类型、双语键、样式令牌、正式构建、文档、架构检查。

## 实施与实际验收

候选 40818/ui/ 加载 main-CSBbkIeF.js。英文 100% 搜索 research 后，Down 从输入进入 Research Studio，再到 Base，末项保持焦点，Ctrl+Up 保持原生行为。Space 勾选 Base 后 Up 回到 Research Studio 并可单独勾选。Down 到 Base 再用 Tab 进入范围外 Dynamic，取消后回到查询。无匹配的已确认查询将焦点留在搜索框，Base 与 Research Studio 都保留并标明范围外。Escape 清除后 Up 进入恢复的真实末项 Generate Expert Squads。

简体中文 160% 从输入 Up 到 Base，再 Up 到 Research Studio。首项保留焦点，Down 与 Space 回到并勾选 Base。实际焦点边框和本地化说明完整可见。取消临时表单后，中文更新日志查询 2026年11月5日，连续两次 Down 依次聚焦 v0.1.46、v0.1.45；Enter 打开真实 v0.1.45 详情并将焦点给标题。 [14 张本人复核的原始桌面截图](../../artifacts/2026-11-23-mission-squad-result-navigation/README.md)

正式列表与持久快照一致，唯一自有草稿 Receiving review selection 位于 backlog，身份 draft-90caeecc98c22bca6036bd2993d7e039，会话 ses_hrzCOnj72QzW2A8T7Uyf。项目为 field-notes-review，精确请求为「Compare the receiving notebook with the signed list and record any differences.」，保存的专家团为 base、research-studio。独立基线和候选各核对两个正式目录查询、五个原文件字节和 SQLite quick_check。基线零会话，候选仅有该草稿，会话消息、执行任务和入口、自动化及供应商请求、结果、用量均为零。

聚焦专家团选择、草稿回执和真实草稿创建回放共 10 项、33 个断言通过。面板类型检查、两语 3281 个键、9355 处样式令牌引用、正式构建及公开渲染器检查通过。

公开接口文档的 353 个操作、20 份架构文档索引及截图链接核对通过。两个独立服务通过正式关闭接口返回 200 并正常退出，端口 40816 和 40818 已释放。
