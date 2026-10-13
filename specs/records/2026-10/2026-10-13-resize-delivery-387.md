# 387 尺寸通知的真实回调归因

持续单agent，按[Recall与方案](../../artifacts/2026-10-05-connection-workspace-authority/resize-delivery-plan-387.md)追查386的14条ResizeObserver通知。当前私有诊断构建经正式CLI /ui提供，只记录原生回调和实际布局，不写样式、不代替callback、不合成消息、无UI自动化。

真实Sol读取、流式打开来源、多行草稿、侧栏380→441和回到底部产生28条被动诊断。13条递送错误均紧邻Virtua.createResizer的observer11；初始0、流式测量后13、后续手动尺寸操作后仍13。textarea/toolbar没有观察到同步目标box变化。已结合安装0.49.3的ACTION_ITEM_RESIZE、Solid subscriber与上游FAQ定位为虚拟行同步尺寸结算产生的递送通知，不能把它等同原用户Rendering闪烁或无限重绘。

据此没有实施原候选补丁：产品代码、观察器和日志处理保持原样，临时诊断仅在私有产物中，after未启动。将库同步测量强制延期会改变当前滚动/跳动合同；当前没有证据支持这种修改。两张真实截图由主agent人工查看，来源、行高亮、草稿保持；[完整证据](../../artifacts/2026-10-05-connection-workspace-authority/resize-delivery-387/README.md)分别保留描述性诊断和规范运行checker，不用错误计数替代视觉。

7次gpt-6.1-sol流式请求全部200/EOF，3个真实read和Source正确绑定。launcher37065实际exit0，Target76316/Host36232在395715ms后正常退出0，Job/output/request与端口收敛，随后复制auth/models清理完成，tab5关闭。原构建cwd/模块解析工具错误保留，修正后原构建成功；386原fetch_failed未改写。

仍未满足的是原subagent侧栏逐次更新的Rendering闪烁复现与根因，应继续调查真实组件身份和Markdown加载，而不是根据通知关键词修textarea。未验证OS崩溃恢复或全部侧栏场景，没有产品发布。当前文档索引、范围提交和正常上游同步随本轮证据收尾，持续goal保持active。

当前构建、后台规范事实checker、docs:check与check:architecture-index通过。134份完整脱敏日志/脚本/实际静态资源/依赖源码归档解压核对通过，138份完整文本/归档凭据扫描为0。原PID再次检查已结束，端口监听0。归档完整性和诊断统计均不充当UI验收。
