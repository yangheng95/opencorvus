# 237 Sources后的失败可见性

[Recall与修改前影响分析](../source-failure-visibility-plan-237.md)，[当前启动准入](../source-failure-readiness-237-before01/README.md)，[实际review-01](review-01/README.md)。单agent、真实普通Session完整失败历史，不重新执行236检索，也不改变原预算失败。

before已保存error，但非空ChatBubble正文省略错误；after同一errorReason在Sources/parts/children之后清楚可见。共享Main/Side Chat/成员renderer，独立Side Chat/成员错误样本和实时Rendering尚未视觉验证。
