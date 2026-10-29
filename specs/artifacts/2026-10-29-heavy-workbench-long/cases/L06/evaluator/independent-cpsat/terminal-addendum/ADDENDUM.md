# CP-SAT终端来源缺口补全

2026-10-29追加：**原命令session87433的终端退出码0已由原持久化调用/响应摘录绑定，先前记录的来源缺口已补全。**旧命令快照和旧报告中的“当时缺终端码”描述保留；没有重跑求解器或倒填旧JSON。

最初提供的原response确含chunk069218/exit0，提取receipt与该终端对象完全相同，但response本身不含session_id。独立审查没有将新receipt中的session标注当作原始绑定证据，初步结果保留在 `initial-field-comparison.json`。

随后补充的 `cpsat-terminal-original-call.json` 是同一call_id `call_054ff60e55964000a816f7f83d0922de` 的原custom_tool_call。其原functions.exec代码最后按序调用并输出 `tools.write_stdin({session_id:87433,chars:"","max_output_tokens":500,"yield_time_ms":1000})`；对应原response最后一个input_text为完整终端对象chunk069218、exit_code0、空stdout。该调用只出现一次；调用timestamp13:54:47.923Z早于响应13:54:50.425Z，与同call_id和顺序共同绑定。session87433也与原cpsat-full-command.json实际初始session一致。

摘录原调用ordinal7404/原响应ordinal7409分别对应来源声明行7405/7410。审查仅读取已提取的工具项，按摘录ordinal及origin对照行号，没有打开整份rollout或任何reasoning正文，也没有执行原工具代码。

实际标准库复核9项全部通过，完整逐项结果在 [final-source-assessment.json](final-source-assessment.json)。四份原始/来源/提取材料和原命令副本都保存在本子目录；主方原command与此前审查快照直接相同。此处来源身份核对用于连接具体原始调用与响应，不代替此前业务正确性验收。

当前局部数学资格结论仍为通过，新增明确事实仅为原CP命令自然终端exit0。新可行上界49032.9、严格下界46220.3、尚不能认证1%、不批准重型冻结/小时级等结论均不改变。本次新增solver/模型/业务执行次数均为0。
