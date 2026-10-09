# 251 自然完成正文保留开始时间

在前一批真实Side库中，3295字符流式正文的开始和结束时间相同；当前共用SessionProcessor的text-end确实把原开始时间重新赋为Date.now()。本轮只保留真实text-start的start并追加end，正常结束仍在原前缀队列与插件完成之后，中止/重试和正文内容仍走同一事实来源。没有历史回填或UI（User Interface，用户界面）改动。

原正式验收第一次0pass/5fail；其中Bun匹配器修改收到的时间字段，且并发夹具成功路径后的完成屏障无法覆盖断言失败清理。最小实际probe（探测）证明matcher（匹配器）把end数值19改成object，调整为先复制数字再匹配；并发finally（必执行清理）先join两处理器再清理全局Instance。工具链修复后原生产再次1pass/4fail，外部中止通过，长/短/重试成功/双项目自然完成都在明确开始数值失败。原日志全部保留。

修复后真实本地TCP（Transmission Control Protocol，传输控制协议）Provider、生产SDK（Software Development Kit，软件开发工具包）/流读取/SQLite/事件五项通过，相关producer/retry/Task-root共24项、108次断言通过；最终夹具异常清理补齐后五项重新43次断言、exit0。后端类型和文档/架构检查实际0。没有UI自动化；局部真实后端检查不能冒称新OpenAI远端或原ResearchStudio网页全程闪烁验收。

[完整Recall与影响](../../artifacts/2026-10-05-connection-workspace-authority/text-part-time-plan-251.md)及[原运行证据](../../artifacts/2026-10-05-connection-workspace-authority/text-part-time-251/checks/README.md)说明所有共享入口、当前公开时间契约、原失败与界限。最新用户单agent指令保持，持续目标仍进行中。
