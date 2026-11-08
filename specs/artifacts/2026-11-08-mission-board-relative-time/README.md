# Mission看板静置时间证据

对应[分析与方案](../../records/2026-11/2026-11-08-mission-board-relative-time.md)。本人隔离项目与真实未启动草稿，零模型/凭据。

- 01/02与before-ui-observations.json：同卡连续visible72.446秒，85.267秒年龄仍just now，原datetime/title一致。
- 03—05与after-ui-observations.json：新构建同卡连续列表从6s ago、1m ago到2m ago，期间无刷新/语言/筛选/布局动作；首次两观测间77.998秒。
- 06—08：同卡英语Board、中文看板2分钟前，以及无交互静置到3分钟前。全部8图实际呈现并人工复核。
- before-original/idle-record.json与after-original/idle-list/final-record.json：正式公开GET /mission完整记录，分别与保存后逐字段一致；原请求/身份/updated/backlog/tasks均保持。
- acceptance.json：纯服务clock正向checker、真实页面/辅助检查/未验与资源结算。

未执行UI自动化；纯服务计时测试只证明原共享时钟输出，不充当页面或Provider端到端。真实document隐藏/恢复与小时/天/周边界未验，不用注入事件或伪时间替代。
