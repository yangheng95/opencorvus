# Goal入口与默认布局实际体验

2026-10-21，单agent；完整原149Project/198Session/3665行、schema3、完整原5键配置的两个隔离Source CLI开发服务。18571原用户服务无监听，没有重启用户进程或改变用户数据库。before/after使用同一正式488 UI；本轮生产改动0，不宣称新布局修复。

- 01英文Home：Goal卡片、Create与How可见。
- 02英文About：模型选择、创建、追踪/暂停三步实际指南。
- 03英文创建：目标、可选预算与明确确认；取消返回原Home。
- 04既有会话：顶部Goal入口；实际打开右侧栏再返回New chat恢复Home完整宽度，未复现挤压。图中悬停提示属于原按钮。
- 05中文Home：入口、说明、模型与权限可见。
- 06真实Goal运行：单轮已接受、原webfetch来源已显现、update工具参数流接收中。“已达预算”仅阻止新自动轮次，当前已接受工作可完成。
- 07真实完成：Example Domain网页来源、中文结果、Goal已完成。
- 08手动展开webfetch：真实输入/输出/来源阅读。
- 09完成详情：原目标、真实证据、80,511令牌、1/1轮与完成后新目标入口。

全部图均1280×720内置浏览器手动交互并实际查看，未使用UI测试/DOM断言/截图基线。截图06不等于活跃子agent side dock验收；该回归仍未覆盖。

[goal-runtime.json](goal-runtime.json)来自真实UI确认后的公开HTTP200与生产持久事实：单created、单continuation、Session作者complete，webfetch/update两原tool outcome completed。after原5次模型请求加before2次，7/12总上限，均Sol流式200/源reader EOF。Goal80511与整轮约121K的差别符合每次请求开始时捕获当前未完成Goal：最终40366令牌请求开始时原Goal已完成；没有改写用量或补造消息。

私有checker首轮使用错误payload层级，保留[原失败](check-goal-failed-001.log)，按真实store.payload.input修正[checker](check-goal.ts)后[原验收通过](check-goal-private.log)。失败属于验收工具字段假设，不能说成产品修复。

[完整保留核验](data-and-authority-preserved.json)证明全部原行/rowid/字段/时间、schema、integrity与完整canonical；[before](before-physical-and-pair-cleanup.json)/[after](after-physical-and-pair-cleanup.json)证明原native物理、output、request、launcher及精确出生结束后，两runtime配对凭据退休。原private authority在实际秘密值扫描后配对退休，见credential-cleanup.json。不归档原DB、原私有历史或凭据值。

原完整配置性能10秒保存/5秒恢复仍未达；本轮没有重新定义指标或用本次Goal通过代替。长期Goal保持active。
