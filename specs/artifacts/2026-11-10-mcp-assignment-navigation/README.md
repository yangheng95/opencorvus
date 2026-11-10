# MCP 连接分配导航的桌面证据

对应 [根因、方案与验收](../../records/2026-11/2026-11-10-mcp-assignment-navigation.md)。1280×720 原图均由独立开发服务的真实 `/ui` 页面手工交互并逐张目视检查。没有执行浏览器自动化测试，服务标识取自自有隔离项目的实际配置。

| 场景 | 截图 | 观察 |
| --- | --- | --- |
| 基线管理 | [英文](baseline-en-mcp-management.jpg)、[中文](baseline-zh-mcp-management.jpg) | 文案指向旧 `Code`；中文和侧栏标签也不相符。 |
| 基线分配 | [对话页首](baseline-en-chat-settings-top.jpg)、[工作页手动下滚](baseline-en-work-assignment.jpg) | 分配控件在技能列表下，实际服务尚未分配。 |
| 首版自检 | [未插值的按钮](draft-en-unresolved-labels.jpg) | 截图发现单花括号直接出现在界面；最终版使用已有双花括号契约。 |
| 最终管理 | [英文](candidate-en-mcp-navigation.jpg)、[中文](candidate-zh-mcp-navigation.jpg) | 入口使用当前导航标签；连接操作仍在原位置。 |
| 对话目标 | [英文](candidate-en-chat-assignment.jpg)、[中文](candidate-zh-chat-assignment.jpg) | 点击即显示连接区、实际未分配行，焦点在该区。 |
| 工作目标 | [英文区域](candidate-en-work-keyboard-region.jpg)、[英文复选框](candidate-en-work-keyboard-checkbox.jpg)、[中文区域](candidate-zh-work-keyboard-region.jpg)、[中文复选框](candidate-zh-work-keyboard-checkbox.jpg) | 回车到区域，有可见轮廓；Tab 进入实际首行控件。 |
| 普通设置导航 | [侧栏打开对话](candidate-en-normal-sidebar.jpg) | 仍从页首打开，并保留侧栏焦点。 |
| 真实延迟 | [工作加载时](candidate-en-work-awaiting-capability.jpg)、[完成后搜索焦点](candidate-en-work-retained-search-focus.jpg)、[对话回执后仍在外观](candidate-en-stayed-on-appearance-after-chat.jpg) | 在加载中可继续使用界面；回执不抢已经移开的焦点，也不会重新打开离开的页面。 |

[真实公开读取及延迟回执](receipts.json) 仅保留隔离项目标识、公开状态和请求身份，不含原响应、用户目录或凭据。两个延迟均对同一真实上游 200 响应原样放行。完成后再读仍为 `disabled`、同项目可分配且未分配。
