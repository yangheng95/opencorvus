# 候选插件错误与可重试提交

单agent第456轮，见[Recall、方案、根因与完整结果](../../records/2026-10/2026-10-20-candidate-plugin-failure.md)。

- `before.log`：三个真实writer用例返回accepted并写入坏factory。`schema-normalization.log`：初版已正确拒绝插件，但手写无schema输入发生现有读取元数据写回，保留为独立未解决项；当前writer格式的事务用例随后通过。
- `retry-before.log`：修复同一路径文件后仍命中旧候选目录缓存的真实失败。`retry-pattern-error.log`为首个过滤器未匹配用例的工具失败，修正后原重试检查才作为产品证据。
- `contracts-summary.log`、`typecheck-final.log`：原7505九文件67例/161断言和原37594类型检查均joined0。覆盖拒绝、无模型引用、全局已注册项目、typed错误、同URI修复重试、部分成功目录、快照代际与建议，以及原缓存/来源/身份/登记合同。完整原日志保留自有scratch，没有UI自动化。
- `http-contract.json`是首轮18719的13个实际HTTP（Hypertext Transfer Protocol，超文本传输协议）请求；`http-contract-final.json`是最终18721的18个实际请求。最终同时验证项目/global坏候选400、健康标准模型、同URI修复后两scope成功、正常替换/空选择和完整源恢复。两轮独立gpt-6.1-sol流式预检成功。没有alias LLM调用或伪造Message。
- `http-contract-final.ts`、`config-write-final.ts`、`readers.mjs`是实际checker源码，绑定已结算的各自scope，复用需创建新scope。网络收到字节后重置无活动超时，已接受并发读取全部结算后才报告失败。
- `canonical-write-candidate.json`、`candidate-reader-admission.json`、`candidate-reader-results.json`记录最终原90805/3635 checker均joined0；完整101项目保存11881.957ms/恢复11464.019ms，四读取均200且最长11707.907ms。原10s/5s仍失败、读取20s通过。生产config service的browser HostTransport是API传输，不是浏览器/视觉验收。
- `global-cost.json`仅关联最终两个性能写入，排除此前错误/修复诊断请求；重叠span的totalMs不能相加作CPU或墙钟。
- `data-verification.json`：两个原native/全部checker结算后直接readonly SQLite，schema2、101 Project/134 Session。逐一核对两轮开始前99/132及最终开始前100/133的全部Project和Session身份、归属与目录，全部保留；没有用户数据库初始化、迁移或清理。
- `results.json`与`private-pair-retirement.json`：原28047/27072 launcher均exit0，两个scope公开shutdown200、physical/output/request/runtime配对完整结算；实际敏感值扫描后精确退休两组private auth/models，未写源凭据或由准备脚本exchange/refresh。原配置、Provider正文和凭据不入仓。
- docs、API和architecture日志为补充；没有UI源码修改，Work浏览器访问仍禁用，没有最新视觉资格。

唯一Provider builder、global选项与catalog投影共同服务运行时和操作内候选；候选不发布运行时cache，所有引用读取同一快照。现有ConfigCandidateValidationError共享单一class/schema及原导出/400映射，运行时目录保持部分成功与原model建议。

剩余：配置schema-less读取的schema/legacy写回owner与并发审计、原性能目标及最新视觉资格。未更新版本、发布tag/Release或完成持续goal。
