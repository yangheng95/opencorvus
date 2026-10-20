# 模型投影实验与回归合同

451单agent，见[方案、Recall与最终裁决](../../records/2026-10/2026-10-20-model-variant-projection.md)。本轮两项生产优化均因完整保存没有稳定收益而撤回，交付仅增加四个正向回归用例及证据；不将其报告为保存性能修复。

- `measurement-bun.json`、`measurement-node.json`及对应日志：完整89项目路径与真实junction/hardlink/missing输入，各组470次底层操作、交错两轮。标准/native callback没有稳定替换收益；保留原Promise API、物理身份语义与错误合同。
- `projection-pressure.json`、`projection-pressure-after.json`：完整目录转换交错真实release helper叶子查询，所有原close/输出结算。它们不是ProcessFacade或完整服务验收。`projection-preflight-error.log`保留首次scratch错误字段protocol_version的明确失败，修正为实际protocol后重跑。
- `clone-cost.json`：临时函数拦截局部诊断，受JIT和拦截影响，不能冒充实际优化验收。
- `projection-baseline.log`、`projection-final.json`：227 Provider/8162 Model实际完整投影，六轮逐值比较全部序列化字段一致。只归档计数和比较结果，9MB原目录及6MB全投影留在私有scratch。两种序列化计时边界不同，不作直接性能对比。
- `results.json`、`after-cost.json`、`final-cost.json`：两次独立native服务的原完整canonical保存/恢复与全阶段摘要；去除大量重复span行，未改变测量。90项目空record实验14.397/12.797s，91项目按需选项实验12.973/12.765s，原10s/5s门槛均未达标；73/117个全部真实GET分别最长10112/10370ms，均HTTP200且在20s内。项目数和手动请求到达时间不同，不能将轮次差异当作严格因果收益。
- `final-contracts.log`是实验源码的38例/129断言；`retained-contracts.log`是撤回实验后的最终交付源码，重新通过相同38例/129断言。覆盖初始值、独立变更、JSON/structuredClone、冻结/密封、生产插件与跨Project/global投影以及实际候选配置合同。均为正向后端用例，无UI自动化。
- `final-typecheck.log`为实验阶段类型检查；`retained-format-check.log`、文档、架构索引和路由检查为最终交付检查。最终生产源码与已交付450相同，正常push hook再次完整验证。
- `after-home.png`、`after-chat.png`、`final-home.png`、`final-chat.png`：真实独立开发/ui人工交互和截图复核，包含Goal入口、真实OK、精确模型与Ask。它们明确属于实验服务，不伪称撤回后重新启动了一轮服务；本轮无UI代码变化。
- 两轮均已预检实际gpt-6.1-sol、streaming=true、凭据可用和完整目录投影，公开shutdown200，原native物理/输出/请求/launcher结算。最终checker11479的工具exit观察在截断时丢失，明确记录此限制；原completed canonical结果accepted/restored=true、failures=[]完整保留。第一轮checker56856 joined0。最终只读库schema2/91项目，保留全部历史，未操作用户18571或用户数据库。
- `private-pair-retirement.json`：原native结算及runtime配对退休后，扫描实际敏感值、核对原授权metadata及完整源目录，再精确退休私有auth/models配对。

没有宣称性能目标完成；持续迭代goal保持active，没有POSIX验收或版本发布。
