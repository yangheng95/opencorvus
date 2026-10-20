# 推送密钥检查：历史覆盖、去重与安全错误

[实施前方案、Recall和原始复现](../../records/2026-10/2026-10-21-push-secret-snapshots.md)。494单agent，不使用凭据/catalog或模型，保留用户18571与数据库。本轮交付唯一`script/secret-scan.ts`修复及真实Git正向测试；没有UI（User Interface，用户界面）改动或新Sources/Rendering视觉资格。**原完整业务配置保存10秒/整份恢复5秒仍未达成。**

## 真实失败到修复

[旧checker复现](before-reproduction.json)：自有真实Git仓库三个持久化commit，base公开→中间假key→最终清除；同一四字段pre-push输入让旧真实CLI（Command Line Interface，命令行接口）返回exit0/OK，但同一checker实际读取中间commit返回secrets.ts:1/provider-key。凭据形状仅为生成假材料，未使用Provider/真实凭据或向remote推送。

[最终真实CLI结果](after-reproduction-final.json)在同一个原fixture/相同base-tip输入exit1，明确报告文件、行、规则及描述。此前[首修正结果](after-reproduction.json)也保留，不覆盖旧证据。旧parser只保留local tip而丢弃remote边界，故历史中间blob逃过最终树/index选择；此前只对已发现hit去重，又让同一快照重复工作。

当前四字段parser只保留一个实现。新可达commit经真实rev-list、diff-tree --stdin/root/merge/raw/NUL（Null，零字节）读取所有新引入/变更路径的内容版本；同时保留各tip完整树与整个index。不同路径/版本各自检查，相同路径+真实不可变Git blob在本次调用内只扫描一次；不是跨运行缓存或diff-only削弱。缺失对象、坏输入和原资源上限错误明确失败，六个实际检测模式/忽略行/1MiB/扩展名/Gitlink规则保持。

原错误结构还暴露匹配内容前16字符，当前报告只有file/line/pattern/description，错误行包含规则的固定说明，不输出凭据派生片段。旧help一概建议filter-repo/force push也改为撤销真实凭据、清除所有待推commit/index、若已发布则与维护者协调。没有自动历史重写或放宽检测。

## 聚焦正向验收

[最终6项实际Git/core/CLI测试](tests-final.log)，Bun1.4.0，6 pass/10 expect：

- 四字段更新/新ref/delete边界及明确坏输入错误。
- 中间多个版本、同blob不同路径、从非扫描扩展名rename为`.ts`后删除、暂存秘密而工作副本公开，各自返回准确报告。
- 新ref根提交的中间秘密、真实commit-tree合并祖先、多个ref。
- 默认HEAD/index保留每个路径，并输出明确的四字段发现对象。
- 真实完整CLI接收原hook输入，exit1及准确、无凭据派生内容的错误行。

没有UI自动化或仅源码文案/DOM（Document Object Model，文档对象模型）测试。[首测试结果](tests-first.log)保留。独立类型检查首[TS2688](scanner-types.log)源于临时命令从根查找workspace安装的bun类型；明确现有`packages/opencorvus/node_modules/@types`后[修复检查](scanner-types-fixed.log)/[最终检查](scanner-types-final.log)实际exit0，无依赖安装或失败掩盖。

## 相同71757输入的真实checker

[原前后比较](comparison.json)使用同一696cc6478完整tip、精确原index bytes及71757项path/object/mode/size；[共享完整元数据](indexed-snapshots.json.gz)逐项相同，未改实际暂存区。checker读取真实Git objects，不是文件模拟。

| 组件 | before | after |
| --- | ---: | ---: |
| 墙钟ms | 78420.4906 | 40173.2471 |
| 真实Git调用 | 741 | 372 |
| 实际blob读取查询 | 72511 | 36253 |
| blob响应bytes（含头） | 2994593485 | 1497175930 |

本组耗时降低约48.8%，实际输入/输出身份保持；[before原调用](before-result.json)/[after原调用](after-result.json)保留每个真实Git命令、时长、对象查询数与输出bytes。两个组当前全量扫描都为无发现，历史漏洞与安全报告由独立正向fixture证明；没有把当前全量无发现当成历史回归用例。该性能样本不是所有机器承诺，也不是原完整业务Config通过。

## 物理与数据收尾

[两个原native scope](physical-scopes.json)：原26978/49325自然exit0，原物理/output/request/launcher完整，精确原host/target出生dead_or_reused，runtime/data文件0。Git同步子进程也已返回，外层原Job（Windows作业对象）物理终态覆盖本组所有后代。没有用PID（Process Identifier，进程标识）名字或观察超时当终态。

[原源库保留](source-preserved.json)：schema3/integrity ok，149Project/198Session/518Message/1155Part/1407protocol/119request/119outcome共3665行与原rowid/字段/时间/bytes/mtime一致；只读源库，无其initializer/业务输入。新测试临时仓库仅生成假材料，已按精确自有临时父目录/非链接条件清理；原复现仓库仅留在忽略的自有scratch，真实凭据与私人DB/历史不归档。

相邻原脚本与[旧实现文本](secret-scan-before.ts.txt.gz)用于核对前后，不是生产兼容路径。归档解压bytes相同只证明保存完整；Git object ID（对象标识）用于不可变内容真实身份，不是可变源码摘要门槛。正常hooks提交/push另行检查全部待推集合，未创建branch/worktree/tag/Release。
