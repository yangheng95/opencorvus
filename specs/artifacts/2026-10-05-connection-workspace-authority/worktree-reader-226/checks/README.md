# 226 聚焦后端检查

真实Git和HTTP输出完整保留，公开副本只统一文本换行。不是UI自动化验收。

- baseline：修改前4例2pass/2fail，进程实际1；模型耦合原错误。
- tests：首次修复后19例17pass/2fail，Windows测试路径表达与规范Git输出不符，实际1。
- tests02：最终19pass/0fail/55expect，实际0；三轮process/exit包含真实出生与终态。
- core-types、sdk-build、docs-render、docs-before：实际0类型、SDK与文档生成/检查。
- readiness、frontier：当前源完整只读事实与执行恢复前沿；实际0，原完整JSON另见准入目录。

[真实页面/原终态](../README.md)。未完成视觉矩阵和其他原错误仍明确保留。
