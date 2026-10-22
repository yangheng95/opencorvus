# Goal 当前交互复核

[Recall、真实复现与根因](../../records/2026-10/2026-10-22-goal-current-experience.md)。单agent、内置浏览器、隔离Source CLI开发/UI；不操作用户18571。模型预算0，无auth/models副本。

同一未提交表单保留目标和两项预算，Close、Escape或经过How it works后重开仍可继续编辑；改变API/selection/owner或原composer输入时初始化新草稿。字段继续由原组件信号持有，不增加持久化或反写聊天草稿，不宣称刷新页面后持久保存。

| 图片 | 实际人工复核 |
| --- | --- |
| [01](01-current-home-en.png) | 当前英文默认首页 |
| [02](02-current-create-en.png) | 当前英文创建表单 |
| [03](03-before-reopened-draft-en.png) | before输入目标/10000/3后Close再打开，全部清空 |
| [04](04-after-reopened-draft-en.png) | after相同操作，目标/10000/3完整保留 |
| [05](05-after-guide-en.png) | 真实英文使用说明 |
| [06](06-after-guide-retained-en.png) | 查看说明后重开，三个字段继续保留 |
| [07](07-after-new-composer-draft-en.png) | 修改聊天输入后，Goal以新正文初始化 |
| [08](08-after-home-zh.png) | 中文首页，保留实际出现的设置悬浮提示 |
| [09](09-after-retained-zh.png) | 中文目标/12000/4，经Escape重开后保留 |
| [10](10-after-narrow-home-zh.png) | 左栏280→493的较窄桌面首页 |
| [11](11-after-existing-chat-retained-zh.png) | 已有Chat独立目标/9000/2，经Close重开保留 |
| [12](12-after-final-home-zh.png) | 返回新首页，保留真实导航tooltip |
| [13](13-after-new-scope-form-zh.png) | 新Home表单按当前空composer初始化 |
| [14](14-after-final-clean-home-zh.png) | 最终干净中文首页，恢复280左栏并清除自有输入 |

所有图片均通过真实页面交互、截图并人工查看；没有UI自动化测试、DOM断言或像素检查。正式Node构建、类型、本地化与token检查分别记录，不能替代上述视觉验证。新模型执行、自动续跑、所有Sources/连续帧Rendering及Native WebView2不属于本批资格。

09为草稿修复主图，14为当前首页主图。`observations.json`包含实际资源200与命令/范围；两`physical-terminal.json`为原native/output/request/launcher/精确身份及零模型结算；`data-preservation-observation.json`为90表156566原行、schema3与完整canonical保留结果。原始构建日志以gzip保留，含未消除的依赖和大chunk提示。

脚本归档依赖原513/413/446工具、冻结Bun与闭合512历史数据，不能当独立安装包。原完整DB、行快照、runtime私有日志、凭据和模型目录不归档。实际秘密值扫描只本地读取，不输出权限内容。
