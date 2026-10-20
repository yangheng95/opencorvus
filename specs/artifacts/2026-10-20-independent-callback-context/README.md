# 独立回调的数据库所有权

两个新增正向用例在修复前均失败。原诊断分别证明 Event discovery 的 Database.use 和两个真实 HEAD 监听回调的 Database.immediateTransaction 继承了已关闭的 effect owner。修复在独立工作入口使用现有 Database.runOutsideContext，原 Instance 生命周期、事件身份和物理结算保持。

[验证记录](validation.json)包括原失败和修复后六个后端文件的22例、60断言，覆盖 post-commit discovery、真实双项目 HEAD 回调、租约计时器在 effect 结束后的 FIFO 交接、跨项目容量、Mission 关闭/重开、重试和 Session Created。局部 wake hook 仅证明本地合同。

[真实运行](results.json)通过公开 event-schedule API 创建 oneShot 定义，写回自有 QA 项目 HEAD 原字节，触发真正的操作系统监听、Bus、持久化 fire 和生产 Session wake。原 fire 成功回执与完成的 assistant 回复分别核对；模型为 gpt-6.1-sol，回复 EVENT468READY。没有伪造事件或执行模型工具。完整历史、身份、目录、归属和 schema2 均通过只读 SQLite 复核。

[原 native/Provider 结算](native-settlement.json)包含3/预设8个实际流的200/EOF、公开 shutdown200、原服务物理/输出/请求/launcher结算与运行目录复制对退休；[私有复制对退休](private-pair-retirement.json)核对实际秘密值扫描和源未写入。启动前凭据、完整模型目录和实际请求模型分别验证。

验收脚本首轮把 match 写成 file/event，实际契约要求 properties.file/properties.event，导致没有 fire；该自有定义已通过公开 API tombstone，原只读观察器180秒无活动后exit1。修正后同一真实路径通过。另一个初始脚本只核对接收回执和所有文本，可能把原输入误算成回复；已修正为 assistant role、completed 时间和精确回复，并对同一原 Session 独立核验完成事实。未把这些 checker 问题归咎产品。

本轮没有修改 UI，也没有运行 UI 自动化。[人工页面截图](event-session-link-error.png)记录把事件内部 Session 作为 Chat URL 打开时的真实404；该入口尚无视觉通过资格。Scheduled 页面显示当前 Automation 列表，没有据此声称旧 experimental Event 已具有相同 UI 契约。原用户18571未操作，自有tab19已关闭。Sources/侧agent直播Rendering、配置性能等既有未达项继续保留。
