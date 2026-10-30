# L02 通用数值执行合同资格（未冻结）

[主方报告](REPORT.md)、[机器事实](assessment.json)及[完整原件](originals.zip)记录两个真实语言的原CSV→预测→选择→外层→报告链，以及同一容器跨五个进程中断窗口恢复。[独立审查目录](independent-review/)限定本次认可范围；完整研究质量、正式rubric、冻结与候选有效小时尚未达成。

当前实现是[单一执行器](../../current-source/l02_execution.py)、[提交入口](../../current-source/run_l02_study.py)与[封存重算](../../current-source/summarize_l02_study.py)，候选[公开接口](../../../public/EXECUTION-CONTRACT.md)允许声明files/argv/配置池，不强迫Python或作者算法。SQLite为唯一cell生命周期来源；旧120组的作者专用入口只在历史原件，无当前fallback。

本轮两个单outer结果均为私有作者诊断，不能反馈可重提候选或称正式12outer研究。Node版真正用Node解析授权原CSV、以BigInt精确计算选择损失并写报告；它的简单算法不当质量参考。Python新图已实际查看，报告只是数值协议参考，不是完整职业论文。
