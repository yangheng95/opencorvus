# 必交交付物

submission.json及全部程序/依赖/真实调查与迁移说明。report程序只读自己的evidence目录，生成REPORT.md、reconciliation.csv、operations.md、reproduce.md、migration.png。报告必须从本次原始库/真实执行结果计算而非缓存已知答案。

reconciliation.csv逐scenario给出schema_version、epoch、entries、quarantine、receipts、notes、amount_minor_USD、amount_minor_CNY、fee_minor_USD、fee_minor_CNY；金额单位为最小单位，不能跨币种相加。报告解释权威身份/异常分类、逐来源原文保存、收据/版本/栅栏与真实故障事实、恢复选择/新业务结果和局限。图是实际可见的币种业务/手续费及恢复场景图，有轴/单位/标题，不能以文件存在代替查看。

完整报告中的事实应能定位本次evidence下原request/native/PID/SQL/数据库和export；候选自报“测试通过”不是依据。operations.md给替班人员具体命令、核对项、停手条件、备份边界/前向恢复与未知身份处理；reproduce.md给新环境完整输入→执行→测试→报告步骤。等价完整表/JSON/公式可作解释，不按字数评分；错误强声明不能被正确底表洗掉。
