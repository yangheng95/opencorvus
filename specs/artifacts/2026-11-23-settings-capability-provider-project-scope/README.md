# 聊天、通用工作与模型服务商设置的项目范围证据

两个实际 Git（版本控制）项目位于本人创建的公共隔离目录。截图中的路径均为本批配置的测试路径。基线 `40524/ui/` 入口为 `main-jM2QDImN.js`。实际侧栏点击完成两个目录切换，未保存能力分配或服务商配置。

| 原图 | 观察 |
| --- | --- |
| [01 Alpha 聊天](01-baseline-alpha-chat-scope.jpg) | 折叠项只显示 workshop |
| [02 Alpha 通用工作](02-baseline-alpha-work-scope.jpg) | 折叠项只显示 workshop，原内置工具数 41 |
| [03 Alpha 服务商](03-baseline-alpha-provider-scope.jpg) | 折叠项只显示 workshop，项目与共享凭据说明可见 |
| [04 Beta 聊天](04-baseline-beta-chat-scope.jpg) | 实际切换后仍只有相同的 workshop 标签 |
| [05 Beta 通用工作](05-baseline-beta-work-scope.jpg) | 实际切换后仍只有相同的 workshop 标签 |
| [06 Beta 服务商](06-baseline-beta-provider-scope.jpg) | 实际切换后仍只有相同的 workshop 标签 |
| [07 按键展开 Beta 服务商](07-baseline-beta-provider-expanded-directory.jpg) | Enter 后才显示精确 Beta 路径，焦点仍在展开控件 |

实际 HTTP 读取均为 200。工作记录查询得到两个项目，回执为 `e18c3079-c29c-49a4-a127-bd94cb6e952d`。

| 项目 | 项目标识 | Chat 能力回执 | Work 能力回执 | 服务商读取回执 |
| --- | --- | --- | --- | --- |
| `alpha/workshop` | `prj_hqAHr0B5jdxyK8XBr8bI` | `b2b4a8c5-e8dc-411b-bdf8-1df5390bc9f7` | `a13fb3c9-0951-47d6-bf18-bd5a7d893c82` | `fa1caeb4-2949-41e4-b0ca-8557319e0308` |
| `beta/workshop` | `prj_hxE5z4XbKKr374EnJIj4` | `c5723413-f8e1-4bbf-8c29-77c11070b464` | `c4a5d9b0-8e7d-4d4a-93ff-c92a30219e46` | `1936fb98-b40c-4b1f-96d9-839e00acd4cb` |

最终候选 `40526/ui/` 入口 `main-BXXZyC-P.js`，能力区块 `ConversationCapabilityPanel-Dx2NjSFI.js`，服务商区块 `ProvidersPanel-BWzmql9C.js`。截图均为 1280×720 桌面原图。

| 原图 | 观察 |
| --- | --- |
| [08 Alpha 聊天](08-candidate-alpha-chat-scope.jpg) | 折叠态显示 `.../preview/alpha`，37 项内置工具 |
| [09 Alpha 通用工作](09-candidate-alpha-work-scope.jpg) | 同一 Alpha 路径，41 项内置工具 |
| [10 Alpha 服务商](10-candidate-alpha-provider-scope.jpg) | Alpha 项目配置、共享登录说明及原目录数 |
| [11 Beta 聊天](11-candidate-beta-chat-scope.jpg) | 侧栏按 Enter 选择 Beta 后显示 `.../preview/beta` |
| [12 Beta 通用工作](12-candidate-beta-work-scope.jpg) | Beta 短父路径和原工具标题 |
| [13 Beta 服务商](13-candidate-beta-provider-scope.jpg) | Beta 项目配置范围与原服务商目录 |
| [14 键盘展开 Beta 确切目录](14-candidate-beta-provider-exact-directory.jpg) | 完整路径匹配服务器目录，原展开触发器仍持焦 |
| [15 简中 Beta 通用工作完整目录](15-candidate-zh-beta-work-directory.jpg) | 鼠标展开，显示中文标签及原目录字符 |
| [16 简中通道共用范围](16-candidate-zh-channel-shared-scope.jpg) | 现有共用范围仍指向 Beta，通道配置列表可读 |
| [17 简中 Alpha 服务商](17-candidate-zh-alpha-provider.jpg) | 真实侧栏切回 Alpha 后显示其短父路径，原共享信息可见 |
| [18 简中 Alpha 对话](18-candidate-zh-alpha-chat.jpg) | 相同已选 Alpha 范围和 37 项工具 |
| [19 无项目对话](19-candidate-zh-unscoped-chat.jpg) | 通过新对话打开后保留原有项目要求 |
| [20 无项目服务商](20-candidate-zh-provider-global.jpg) | 同一无目录状态显示全局写入说明和共享登录说明 |

候选读取和前态读取的完整能力响应一致，服务商目录及模型标识集合一致。候选回执如下，均为 200。

| 项目 | 项目读取 | Chat 能力 | Work 能力 | 服务商 |
| --- | --- | --- | --- | --- |
| `alpha/workshop` | `64a7fe9b-7721-4fbe-8aa6-ef3f2beab20a` | `b5ff3ff3-4bc8-4485-94aa-0ed25ac06bdf` | `92b13b01-cb24-40f2-b214-2e7ac517230b` | `04d3b6f6-4a1b-4dbe-a417-104ded3ddf93` |
| `beta/workshop` | `5b7ab257-982e-4477-8f79-2e8ca073d146` | `d5c72841-a6a6-496f-bb12-18791aadc012` | `78ff2192-5f36-4045-b328-d08dbbbf12ac` | `1b062260-9c7e-4f5c-b287-3b3b707ab655` |
