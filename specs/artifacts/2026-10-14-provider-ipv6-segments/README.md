# 第20批：IPv6 Provider零段位置证据

对应[Recall、实施前根因与实际资格](../../records/2026-10/2026-10-14-provider-ipv6-segments.md)。Root独立实施并亲看9张原PNG；0 UI自动化，0真实凭据、模型推理或real Sol。

- screenshots：01/02修前两种不同零段位置得到同一ID；03首声明真实保存；04第二声明的ProviderFormConflictError（第一句完整可见，stack下部viewport裁出）。05/06修后明确不同ID，06还含首条保存行；07英文双条及完整API；08编辑草稿改为[::1]仍保留原ID，取消未保存；09中文双条及端点。原图未编辑/裁剪，没有DOM/像素/文案断言。01/02的提交控件不完整可见，只资格地址与ID预览；05完整新增表单可见。
- runs：before PID60400/18648、49、51，occurrence 3202bfa2-dd23-4a4c-b3db-809c08b872f2；after PID88128/18650、51、53，occurrence 484aacef-1ead-472c-b9d5-f05c3b3c89c0。正式源backend /ui，before冻结B19 UI，after本批Node build。两轮正常settlement、parent实际exit0、3端口0后精确删除自有假auth/models整对；完整后台原日志98086/109425字节、stdout/stderr各0，全量已知假凭据检查后无损gzip。terminal实际requests0、realSolCalls0。
- config-qualified.json：真实UI保存后正式公开GET/config实际200；before精确读回旧ID和首IPv6端点，after读回ipv6-2001_db8_1__1-18651与ipv6-2001_db8__1_1-18651及各自name/API/env[]/models{}。IPv6地址只用于声明，不访问这些地址/点击Test或Discover；没有IPv6网络、第三方Provider或模型资格。受控participant仅供隔离初始化/完整目录，不冒充真实Provider。
- inputs：B19的两个修前业务/测试原件、原运行器、当前独立fixture/launcher、公开checker、只读生产函数probe。产品只在唯一providerFormID的IPv6分支将冒号映射为下划线，保留双冒号位置；旧ID继续早返回，其他地址与优先级复用原逻辑，无迁移/回退/兼容路径。
- checks：baseline42/82，先红态38通过13失败/91断言，再实际51通过91断言；新增8地址+1完整map，4条原IPv6期望按当前合同更新。服务/test格式、overlay类型、Node构建（59.58s）、双轮公开配置和隐私0；构建原warnings保留。文档/index回执在最终检查后补入。
- previous-delivery：B19实际正常commit e3c3d1aa7、99路径核对/精确索引结算、exact topology与同步/pending原件。首次push1被并行Combobox类型错误拦下；第二次8项类型通过后push1被并行权限租约入口登记检查拦下。两个失败的完整输出/exit/receipt无损gzip，不写成已经推送或掩盖错误，不借用他人push。

同host的path/query/protocol普遍唯一性不在本批；默认port仍由URL标准省略。保留显式ID/name和冲突合同，不修改后端/SDK/错误协议。独立用户任务的未提交修改、暂存与进程不由Root改写或接管。
