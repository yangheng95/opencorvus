# L02 私有完整评估协议（建设稿）

本文件供评估者使用，不是给候选的输入。唯一当前入口为`current-source/l02_grade.py`的prepare/grade；它不启动候选、Provider或数值进程，不增加调度/消息/队列。当前只资格化已行使的失败、原对象/阶段、外部review/参照边界；完整成功路径、实际38科学叶判断、锚点多质量校准及新全12参考仍未通过，正式分数null，case未冻结。

## 原执行与阶段

`l02_sealed.inspect_run`短持既有owner锁捕获原SQLite逻辑run/cell/event及registration/prepared/terminal/accepted原对象，再释放进行只读检查。逻辑快照是该次评估的不可变证据，不是另一活数据库或cell状态来源；不包含capture时间、临时路径或解码对象。不用DB文件hash代替实际内容。

原source/input/native/实际exit/typed checker支持每格outcome；所有expected身份由权威日程和冻结pool推导。C01检查全numeric，C02检查全部inner选择；其它38科学/运营/复建研究叶由分配的独立审查判断，26质量由实际完整选中策略与固定外部参照计算。1个候选失败不会被扩成所有未调度单元失败；只有真实必要依赖blocked_candidate，独立未调度保持unassessed。

真实native非零与坏候选输出可归候选；未知host validator错误、原原因与native矛盾、旧failed而原输出合法、损坏/漂移对象均为设施调查。OOM（Out of Memory，内存不足）或signal/外部终止因果未资格时保持设施，不伪装成已覆盖硬件/取消场景。

## 收集assignment

prepare需要评估者已分配的非空submission ID、subject_role、单层reviewer ID、候选目录和原run、当前rubric/quality policy、此前已注册并独立核验的固定reference及外部指定的reference method。后两个对象从已批准的原注册/来源交付收集，不能由候选提供；符合schema不认证其来源真实性。loader仍核业务事实、日程/尺度/单位/指标/固定配置及原真实reference终态。

```text
python current-source/l02_grade.py prepare --run <原run> --candidate-root <候选workspace> --rubric ../rubric.draft.json --quality-policy quality-policy.draft.json --reference <已注册原ZIP> --reference-method <独立指定原method> --submission-id <已分配ID> --reviewer-id <单层reviewer> --subject-role candidate --out <全新私有目录>
```

subject_role只能为candidate、reference_qualification或protocol_control；参考/协议控制不能冒称候选成绩。评估和review目录均在候选及run之外。包为`assignment.zip`，含assignment头、rubric及anchor版本、固定政策/reference/method和同一capture的执行原对象/逻辑stage。ID/路径只定位；实际对象绑定来自原内容，非可变源码摘要。

本轮初草稿包遗漏逻辑stage的原件保留。没有原stage事实的旧实验包返回facility_evaluation_stage_unbound，不能从当前DB补造当时stage；须重新收集当前事实和新review。合法stage进展也必须新assignment，不静默复用旧阶段判断。已交付SQLite schema1与原capsule格式不变。

## 外部独立review

评审者收到的原`assignment.zip`完整复制在独立私有目录，并写`review.json`。format为`l02-independent-review/1`，含原assignment_id/submission_id/reviewer_id/anchor_version、实际AI-agent模式/盲法与熟悉度/局限披露，以及恰38个独立研究叶。

每叶有id、status、basis、sources、dependency_roots。status只用verified_pass、verified_fail、candidate_incomplete、blocked_candidate、unassessed；二元评分无half/N/A。sources每项为原execution对象、其具体member（或整个对象的null）及非空locator；所有材料合读，JSON/CSV/代码/完整公式/表/图可等价闭合，不限定作者文件名。依赖根因须来自同一原inspection已证候选失败/阻断，不能把无关或未调度工作伪成候选根因。

review目录缺交/尚未完成保未评；已有review却版本/原包/来源错误为设施。原对象副本与schema仅证明绑定，不能证明判断真实；实际独立读源、核数、查看图及多质量/等价格式校准仍是必要证据。熟悉作者参考的非盲AI开发审查不等于专业真人或统计成熟认证。

## 纯读grade与公开分数

```text
python current-source/l02_grade.py grade --assignment <私有assignment.zip> --run <同一原对象run> --review <独立私有目录> --out <全新私有目录>
```

grade先核固定外部设施/参照，再合并实际原选择/预测与外部review，最后调用唯一l02_rubric.aggregate。只从原selector实际选中ID读取对应原outer预测，不取报告selected或outer hindsight最优。未选消融出错不自动阻断完整已选策略质量；真正必要选择/预测缺失按实际根因blocked或未评，不缩分母。

assessment.json保全每叶规则/权重/critical、实际来源、观察及依赖根因；stdout只显示结论/计数。固定分母100，已知关键失败保留；draft/readiness不齐、设施无效或任何未评均禁止总分。CLI（Command Line Interface，命令行接口）成功正式graded为0，未评/建设稿为4，设施无效为3。没有任何LLM token或任务总墙钟额度，也不以这些评估侧计算证明候选小时。
