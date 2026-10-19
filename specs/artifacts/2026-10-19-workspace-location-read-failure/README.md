# 工作区定位失败与恢复证据（2026-10-19）

对应[调查记录](../../records/2026-10/2026-10-19-workspace-location-read-failure.md)。生产入口独立端口18603、18607—18619，正式开发服务/ui；未操作用户18571页面。

| 图 | 人工观察及资格 |
|---|---|
|01—03|无Provider环境；Work原历史/404空首页，Mission实际400模型不可用|
|04|仅目录环境Mission仍400，不能作404证据|
|05—06|中间修复Work404摘要和原Details|
|07|仅正文恢复，文件未打开；原因未知|
|08|完整凭据及模型环境，原Mission404空首页|
|09—11|Mission404摘要、Details及真实中文设置|
|12—13|中间版本原Source文件2—3行及正常取消Task|
|14—15|中间未知Task错误及其污染后的Mission失败；15文件名normal不代表成功|
|16—17|最终未知Task拒绝和WorkspaceLocationError原详情|
|18—19|最终正常Mission原草稿及刷新|
|20—21|最终正常Task直接链接及刷新|
|22—23|最终Work历史及README2—3行高亮|
|24|最终中文未知Task错误面|

checks/为脚本、原源码、构建/检查日志和只读请求事实的gzip副本；runtime/为8个scope物理结算、公开shutdown和成对清理回执。三个paired scope的Provider摘要仅保存model/streaming/status/response_reader（各2次真实gpt-6.1-sol流请求，reader EOF），不保存完整请求body、凭据或数据库。没有UI自动化测试；截图均由真实页面交互后人工查看。当前版本没有新成员流式生成资格，也未完成Goal/default页改版。
