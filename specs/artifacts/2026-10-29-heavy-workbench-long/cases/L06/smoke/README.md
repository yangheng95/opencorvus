# S06微型原生管线smoke

**小合同已冻结，实际四条件smoke通过。** 这不是L06重型任务，不计入十题、不证明小时级、不产生难度排名。用户要求先做便宜实验，因此先验证公开输入→真实流式Task→独立数学检查→清洁源码复跑这一闭环。

[公开TASK](public/TASK.md)和两份输入是候选仅有材料。单价变化使独立最优从4.5变5.5，沿用原策略会变8.5，故需要实际读输入重新计算。[独立冻结审查](evaluator/independent-freeze-review/REVIEW.md)用标准库完整枚举认可这个微型定义；它没有代签任何实际运行结果。

[profile](profile.json)记录独立身份HeavyWorkBench-Smoke/0.1.0-dev/S06及null总量政策；[评估合同](evaluator/contract.json)的四项要求全部通过才算smoke_pass。Inspect的lifecycle分不是数学结果。只给原生Task导出`public/`，参考解、评估器和凭据均留在项目外；真实模型/stream与runtime脏状态另记，comparable=false。

[最终判定](evaluator/final-smoke-assessment.json)、[实际原生运行](evaluator/actual-run/README.md)及[独立非盲复核](evaluator/independent-post-review/REVIEW.md)分别保存证据。原生Task自然完成650.922秒，实际builtin/base 2026.10.14.1、openai/gpt-6.1-sol，有orchestrator和1个base-tester。主方完整源码冷跑及四次checker合计.818秒；独立agent另目录实际两次执行及四次checker合计.923秒，两实例精确成本9/2和11/2。均使用冻结原输入，未靠旧结果或自报成本评分。

这个时间差说明不能把完整原生流程墙钟当成题目的内在难度。后续先做便宜业务/数值验证，不重复同一LLM smoke；当前十题重型升级与L01/L06正式冻结仍未完成。
