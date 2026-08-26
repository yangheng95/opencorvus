# 七角色案例：表面成功与过程正确性

`event-ledger.json` 保存七个身份、Session、终态、已知创建时间、真实并行区间、最终产物和限制；`dependency-graph.json` 保存声明有向无环图（Directed Acyclic Graph，DAG）与逐边观察结果。

可以直接引用：七个角色均到达终态，两个 analyst 真实重叠 566,808 ms，最终 Git/typed/interactive 报告存在，Task 与 Mission 完成。

必须同时引用的限制：fact checker 在 synthesizer 终态前 218,494 ms 创建；writer 在 synthesizer 终态前 82,968 ms 创建。前者审查了早期进度并返回 zero-claim clean review；后者的 typed publisher 初次因缺少六个精确前驱而拒绝，随后经 generic publisher 完成。故本案例只能作为真实交付与过程缺陷反例，不能称为严格 workflow success。
