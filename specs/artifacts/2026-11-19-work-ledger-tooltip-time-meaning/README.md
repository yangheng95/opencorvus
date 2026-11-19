# 工作侧栏时间语义的桌面验收

## 基线

- [未派发草稿被侧栏显示为 Started](baseline-draft-claims-started.png)
- [最近列表键盘聚焦已有空 Work 显示 Started](baseline-empty-work-claims-started.png)
- [最近列表键盘聚焦已有空 Chat 显示 Started](baseline-empty-chat-claims-started.png)

本人在 `40312/ui/` 悬停、点击和按键，逐图复核。视口 1280×800，入口 `main-CYCLy1Fu.js`。 [真实工作记录、会话时间和草稿状态](baseline-creation-times.json)

## 候选

- [项目组草稿英文显示 Created，正文为原始待开始请求](candidate-en-draft-created.png)
- [Tab 聚焦最近 Work，读到相同英文创建事实](candidate-en-work-created-keyboard.png)
- [Enter 打开实际 Work 会话](candidate-en-opens-work.png)
- [Tab 聚焦最近 Chat，读到相同英文创建事实](candidate-en-chat-created-keyboard.png)
- [Enter 打开实际 Chat 会话](candidate-en-opens-chat.png)
- [最近草稿和项目组草稿的创建时刻一致](candidate-en-recent-draft-time.png)
- [简体中文 Work 的创建时间和相对时长](candidate-zh-work-created.png)
- [简体中文 Chat 的创建时间和原题](candidate-zh-chat-created.png)
- [简体中文待开始草稿的创建时间](candidate-zh-draft-created.png)

本人在 `40314/ui/` 使用鼠标和键盘并逐图复核。视口 1280×800，入口 `main-CzlgD35T.js`。 [候选工作记录、会话时间和草稿状态](candidate-creation-times.json)
