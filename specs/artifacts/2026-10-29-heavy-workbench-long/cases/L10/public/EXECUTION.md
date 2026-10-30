# 程序接口
根submission.json format=L10-programme/1，prepare_argv/control_argv/report_argv为非空argv数组；全部依赖源/资产在同一根目录，无越界链接。环境镜像sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf，Python /opt/cpsat/bin/python，NumPy/SciPy/Matplotlib。可自带镜像已有运行时能执行的正确语言/二进制，不要求特定优化算法。
prepare追加--data /raw --out /results/model，raw只公开source，输出model目录及audit.json。controller工作目录/program；只有只读封存programme、只读/model，无网络、私有future/plant DB/前路径结果。stdin每行JSON、stdout每行一个JSON响应，诊断写stderr。kind=decide字段site/step/total_steps/device/site_terms/commission/state/current/forecast/confirmed_history；响应至少power_kw有限数，不接受bool。current含at/dt_hours/critical_kw/flex_kw/pv_kw/price/grid_available/derating。forecast每行step/revision/released_at/values，同当前结构；仅授权horizon16内最高已发布版本。state含soc/next/peaks/energy/wear及累计未供/弃电；confirmed_history为所有原receipt {key,row}。未来真实状态/路径ID从不传入。
故障恢复后首先kind=receipt_replay,receipt=<最后已commit对象>，响应acknowledged=<原key>；随后从该持久state和完整已确认历史继续decide，不重置SOC/peak或重提交原step。plant进程在nominal/CLINIC/S8 step45真实commit后退出73、同数据库/同programme自然续接。
report追加--data /raw --evidence /evidence --out /results/result，evidence仅全部已完成episode真实结果及authority，不含私有评分器/参照/权重。results.json episodes每项scenario/probability/site/device/state/ledger/telemetry/steps；不提供最终bill，报告必须由真实telemetry+action及原合同独立重建物理与账。报告程序已首动作前封存，结果输入不授权改程序。

控制策略须从完整输入和事前固定的随机种子可复现；相同完整信息prefix不得因实际路径身份改变动作。source控制base/price/quote必须同一不可变programme，无外层结果反馈调参。

因果性指同一完整JSON观察prefix和事前固定种子的动作功率数值一致（可用整数/等值有限小数表示）；这是本策略自身跨路径的非前视检查，不与参考动作轨迹匹配。不能把容器时钟/启动先后等未授权系统metadata当路径协变量。本题验证明示packet/argv/mount与实际非前视行为，不授对抗操作系统侧信道安全认证。
