# 离线启动链接恢复

[调查、根因、实现与边界](../../records/2026-10/2026-10-22-offline-location-recovery.md)。单开发 agent；真实 Source CLI（Command Line Interface，命令行接口）/ui，前端与API分别为自有loopback服务。用真实设置保存服务URL，后端确实未启动或已完整关闭，不拦截请求、不伪造响应、不注入浏览器隐藏状态。七scope模型预算/实际均0，无凭据或模型目录副本。

原版本在首次离线之后只恢复已保存工作区，遗漏文档传入的Task链接；原URL仍在，不能误报为地址被清空。修复首次/重连共用初始化owner，第一次健康恢复消费原输入，后续保持当前选择；网络健康与工作区恢复完成分别确认，失败的首次尝试仍注册原可见期monitor。新的用户导航优先，原Task/Session selector和权限/持久化不变。

| 图 | 真实人工观察 |
| --- | --- |
| [01](01-before-cold-offline.png) | 原Task链接冷启动、后端未启动、Offline |
| [02](02-before-api-online.png) | 原版本已Online且列表加载，但主区仍首页 |
| [03](03-before-manual-task-control.png) | 手动点相同Task可以正常打开，排除数据缺失 |
| [04](04-after-task-cold-offline.png) | 新资源重做同一Task离线冷启动 |
| [05](05-after-task-auto-restored.png) | 后端上线后自动进入原Task及正文 |
| [06](06-after-user-selects-chat.png) | 用户选择另一项目Chat的尚未结算过渡态 |
| [07](07-after-chat-ready.png) | Chat选择完成及原正文，准确链接已记录 |
| [08](08-after-chat-transport-offline.png) | 同一文档后端关闭，原Chat正文保留 |
| [09](09-after-chat-reconnected.png) | 新后端PID上线，仍为后来选择的Chat |
| [10](10-after-chat-cold-offline.png) | 准确Chat链接离线冷启动 |
| [11](11-after-chat-cold-restored.png) | 第一次健康后自动恢复原Chat正文 |
| [12](12-after-offline-user-new-chat.png) | 离线Task链接期间用户显式改选New chat |
| [13](13-after-user-intent-preserved.png) | 上线后仍保留新launcher，正常输入新草稿 |

十三张图全部实际查看，不是截图或DOM（Document Object Model，文档对象模型）测试。06的旧Task URL为真实未结算过渡态；[ready记录](selected-chat-ready-location.json)才是后续Chat冷启动使用的实际URL。13草稿在上线后输入，没有宣称离线草稿保留。无模型绑定环境中的“模型配置暂不可用”提示是预期边界，未发送新消息或创建Goal/Task。

[传输控制红](monitor-before.log)/[绿](monitor-after.log)记录最初六个正向合同4通过2失败→6通过；增加后继owner最终receipt后[七项最终通过](monitor-final.log)。这些不含UI/DOM/组件/文案断言，包含自有Node loopback HTTP，属于局部控制合同，不代替上表实页资格。原负向核心用例已删除且未运行。

[请求轨迹](network-observation.json)、[资源结算摘要](resource-disposition.json)、[数据摘要](data-preservation-summary.json)和[观察](observations.json)均由实际运行证据生成。七scope各90表156566原行、schema3实际对象/integrity、完整canonical和来源bytes/mtime保持，原行/表计数变化均0，Provider activity391→391。原40607/41759/5056/5282/4438/45131/12101完整退出，公开shutdown200/native/输出/request/launcher/精确出生链完整结算；105/106页关闭，18969每次复用都在原链结算后。

[完整错误观察](runtime-error-observation.json)保留53个实际错误的安全字段：18个server失败均为ProviderModelNotFoundError/400，其余是同一模型配置错误传播，无其他未分类error。结合实际未绑定auth/models和原config.validate/getModelFromCatalog代码确认目标不可运行，未把它说成凭据验证或数据库失败，也未宣称控制台无错误。首次归档后新增观察，最终[扫描](credential-scan-final.json)覆盖全部当前文件与解压内容。

重复原记录以gzip保留：[原始物理结算](physical-terminals.json.gz)、[数据准备](data-preparations.json.gz)、[完整数据检查](data-preservation-observation.json.gz)与[构建原输出](build-after.log.gz)。前两者解压为stage→原JSON文本映射，原文本字节不改写；构建保留原警告及空白。压缩仅减少重复归档，不作为功能验收。读取原输入、压缩文件和解压payload均做[实际秘密值扫描](credential-scan.json)，原值只在本地内存使用。

脚本快照依赖仓库 .tmp-product-iteration/live-sol-task-guidance-413.ts、原生supervisor及方案中的自有路径，需按原位置使用，不是独立安装包。数据库、原行私有快照、完整运行日志和凭据不归档。用户18571和真实用户库未操作，无schema或版本变化。

## 模型已配置的独立复核

前述七scope保持原零预算与原错误事实。新增qualified-ui18971/原14464、qualified-api18973/原49642，完整配对授权与模型目录，预算固定8次；[14](14-qualified-task-offline.png)为真实离线原Task链接，[15](15-qualified-task-restored.png)为第一次健康后自动恢复原Completed Task、正文和openai/gpt-6.1-sol，两图实际查看，无手动选择Task。与前七scope使用同一正式main-DhV28lza，未创建业务Task/Goal或新成员。

[真实预检](qualified-preflight-ready.json)确认凭据可用、目录投影和实际流式模型；[资源摘要](qualified-resource-summary.json)及[原物理记录](qualified-physical-terminals.json.gz)记录2/8次实际请求全部200/原reader EOF、原exec exit0、公开shutdown200和完整出生链结算。[真实158条请求](qualified-network-observation.json)及浏览器错误观察本次error为空。两个runtime与私有源auth/models四成员均已[退休](qualified-api-authority-retirement.json)，原授权和完整目录保持，未用额度退休；107页关闭。该预检不替代业务Task或成员正文流验收。

[独立数据摘要](qualified-data-summary.json)、[原准备记录](qualified-data-preparations.json.gz)和[原数据检查](qualified-data-preservation-observation.json.gz)保留90表156566原行/schema3/canonical/source bytesmtime事实。UI原数据全相同；API仅两个原容量租约的lease_id/owner_id/time_acquired/expires_at自然更新，另有真实预检Session/Message/项目/记忆及运行事件增量，未回填原租约。完整增量表保留，Provider activity391→392。最终[实际秘密值扫描](credential-scan-qualified-final.json)覆盖当前515记录、源码、所有产物及全部gzip解压内容；不归档凭据、数据库或原行私有快照。

尚无新的Mission、原生WebView2、业务Task/成员LLM流、全部Sources或连续帧Rendering资格。强制中断首次元数据读取、在其未完成窗口内同时导航也未做新的完整实页场景；代码/控制合同不得冒充这些通过。
