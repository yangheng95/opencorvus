# 附件保存后的文件变更投影

## Recall

用户要求持续自主查找整体体验与功能问题，只用一个agent；已关闭的Rendering闪烁不再排查，真实页面复核后精确提交并正常推送，仅实际冲突才等待。上一批2850b9ea4已正常hook推至main，含真实Office保存、原文件下载与紧凑PDF；第一次上传TLS（传输层安全）握手失败，保持证书校验改用HTTP/2后正常推送成功。598的19次Sol请求已全部结束，自有服务/原始调用/输出/请求已结清，凭据和完整模型目录副本退休；其提前五分钟关闭验收失败及首轮原生batch原因未知继续保留，不改成通过。

开始状态包含用户未提交的旧产物删除、共享索引排序和历史Bun目录，均不改。用户18571页面/进程和真实数据库不操作，无子agent、新分支或worktree。本轮实际页面复查只读已关闭598的自有完整数据副本，不向模型发起请求，不复制凭据。

已读598完整Recall/证据、04-extensions、07-panel、02-data、Snapshot.diffFull、SessionSummary、WriteTool、ConversationArtifactSummary、tool-file-changes、file-change-summary、conversation/transport与transport-protocol索引；全仓搜索FileDiff、Files changed、metadata.filepath/source/exists/bytes、bounded metadata、完整/延迟Tool读取和各调用点。未发现本轮触及路径下UI自动化测试；后端投影测试是生产HTTP/SSE（服务器推送事件）数据合同，不使用DOM、组件或浏览器测试。

## 修改前根因与影响面

真实598最后截图显示“Files changed 2 files”，仅早先MD/CSV；磁盘和两个实际write完成事实证明目录另有DOCX/XLSX。直接触发是通用write的附件分支返回filepath、exists=false、verified source和bytes，但完整Tool文件变更normalizer只识别metadata.files/filediff；延迟Tool的唯一有界投影又只声明edit/apply_patch的文本行数。因此新附件的真实完成事实没有进入摘要，而非源文件没写成、文件事件缺失、Snapshot排除Office或UI闪烁。

Snapshot.diffFull本身保留二进制文件，baseline不排除DOCX/XLSX；当前摘要从真实Tool事实和已有会话事实归并，不能通过重跑Git、写入假的text diff、扩大快照或新增文件影子状态补它。附件新建的既有完成事实足够证明路径、原始字节身份及新建状态；二进制行数应为null并显示既有binary语义，不能伪造+0/-0。文本write的历史before/after信息不足是另一现存合同缺口，本轮不猜测或合成旧文本端点。

在transport-protocol增加一个公共纯投影，从已完成附件保存的完整metadata元组验证并导出当前文件观察；完整面与后端延迟面复用该实现。现有ConversationToolFileChange扩展明确的二进制分支（isText=false、null行数），既有文本分支保持当前数值合同；解析器、server投影和前端normalizer同步修改。原始Tool结果、immutable receipt和数据库schema8不变；该字段仅HTTP/SSE读取投影，不新增持久数据格式或迁移。

影响全部普通会话/Work/Task及历史真实附件保存结果、首次加载/PartUpdated/Moved与打开延迟Tool；不改变写入授权、附件读取、调度/队列/恢复/并发终态或Provider。没有共享调度异常证据。风险是把不完整metadata误判成完成、二进制伪行数、延迟前后身份不一致和错误归并；以公共解析合同和真实页面覆盖。

## 实施与验收

1. 公共解析/创建观察及三种真实transport入口的聚焦正向后端合同，使用当前实际二进制写入metadata元组验证明确输出，不新增/运行UI自动化测试。完整与延迟投影必须相同，原有文本观察继续成立。
2. 普通Node.js生产构建，隔离开发CLI `/ui`读取598完整自有数据与附件。启动前完成准备；服务最多20分钟且前15分钟内公开关闭，本轮不执行Provider请求，不复制auth。手动查看原Chat摘要4份文件、展开剩余项、二进制标识及Review状态，截图人工复核；用真实页面而非DOM测试作为UI验收。
3. 更新架构与三索引、文档检查，精确提交，先fetch/merge并检查完整待推集合，保持正常hook与证书校验推送；保留全部外部工作区更改和已有未知项。

## 结果

公共metadata解析器与明确的opaque-byte观察落地，server完整/延迟投影与前端使用同一实现；无持久数据修改或迁移。聚焦`test/attachment-write-transport.test.ts`和现有`test/conversation-transport-projection.test.ts`共20项通过、61次断言，覆盖首次历史、PartUpdated与Moved入口的原样观察和有界传输。当前前端typecheck及普通Node生产构建通过，发布为`main-JKYdYGSX.js`。

真实隔离开发CLI54107 `/ui`从完整复制的92表/24573行、56份附件及sidecar读取原Chat；复制完整模型目录，但没有凭据及模型请求。单人操作页280，摘要4文件并展开，DOCX/XLSX标为Non-text，MD/CSV仍为+16/+6；点击真实XLSX行打开Review，显示Added、Non-text和完整4文件列表。两张实际截图已人工查看。缺凭据导致的模型配置提示是预期状态，历史阅读仍可用，不冒充模型端到端测试。

服务公开shutdown200，原始调用1062已收集exit0，native/launcher均0，物理/输出/请求已结清且精确进程链dead_or_reused，实际预留1123957ms。之后只读验证message/part/Tool request/outcome/Artifact/Task/task plan/Provider request/outcome/usage共10表精确事实保持，schema8、integrity ok、模型请求0；自建页面关闭，用户18571保持。

上一批2850b9ea4已正常推送成功并由远端确认。其后并行CI记录da5316316独立提交到主交付来源，仅改CI记录，不与本轮重叠；继续按当前HEAD精确收拢，不等待无冲突工作。598既有关闭时序失败、原生首轮batch未知原因及594连接失败未被本轮消除，保持原记录与持续Goal active。
