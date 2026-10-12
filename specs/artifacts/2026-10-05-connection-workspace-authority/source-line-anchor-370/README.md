# 370 文件行号锚点的统一定位

[Recall、调查与方案](../source-line-anchor-plan-370.md)。本地`#L30`代码引用过去没有点击动作，显式`#L30-L32`链接则按相对网页地址导航离开会话。唯一file-reference解析现在识别合法行/行范围锚点，经既有属性和委托传到同一个编辑器范围；原冒号列引用保持。

## 真实页面

- `before/01–03`：真实模型回复中行内锚点没有文件动作，点击无文件面板；点击行范围后URL变成`/ui/资料/行号示例.txt#L30-L32`，03显示无样式Preparing Environment。新文档仍用相对`./assets/main-BR2lLe8z.js`。导航错误及空console记录均保留。
- `before/04`：Back后重选原会话，冒号对照正确打开30:10，排除编辑器本身无法定位。
- `after/01–04`：新的真实模型消息中行内锚点成为链接，点击到第30行；行范围正确标记30–32，URL保持原会话；冒号列对照仍到第30行第10列。
- `after/05–06`：Side真实搜索与最终回复完整完成，侧聊范围链接打开同一三行范围。加外部落地页共11张截图全部亲自查看；只读DOM记录仅辅助，无UI自动化断言。

外部GitHub链接保留完整URL及`#L1-L3`。点击后第一次即时IAB清单只有191，最初记录为未确认；稍后收尾清点发现新页192，绑定该已存在页面后实际确认GitHub README和完整原URL，见`after/07-external-page`。没有用直接创建目标页或goto替代点击。该页显示GitHub自身的Markdown预览，不宣称其行高亮行为；页面192已关闭且最终IAB清单为空。Native外部编辑器范围行为未扩测。

## 数据与运行边界

23聚焦纯parser/service正向测试通过；改前8pass4fail完整保留。类型原32923 exit0，正式build原68894 exit0（54.47s/main-w4chjmbj.js），当前bundle实际HTTP200。

`checks/runtime-qualification.json`核对真实Source、生产ToolOutcome、自然Message终态与原文件完整字节。before1 Source/5 Sol流式EOF，after3 Source（含Side继承1）/9 Sol流式EOF。两个scope均固定600000ms/12请求，原48162/66181实际join exit0，Native分别187915/250691ms且physical/output/request/端口/配对清除完整。页面190/191已关闭；运行资格不抹去before UI失败，外部落地页另有实际截图证据。

没有SDK/数据库/Host旁路、版本发布或开发子agent。未知fragment保留原文字，不猜目录/范围；367预算失败和359首次复制未知继续保留，持续目标active。
