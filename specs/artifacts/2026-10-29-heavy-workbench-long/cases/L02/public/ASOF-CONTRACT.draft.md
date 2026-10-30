# L02 发布时间输入合同（局部草案，未冻结）

本合同仅限定合成整数日界的输入原语，不是完整预测任务、数据发布或评分合同。旧H02的全量未来CSV及作者总资源额度不适用。最终L02仍须补真实研究材料、多序列、真实时间/修订元数据、外层预测与内层选模、区间和决策交付。

`l02-vintages/1`的权威事实由评估侧保存。series注册单位；variables另注册`observed`或`known_future`。每条事实有业务时点、发布时点、非负整数revision_id、value及quality_flag。当前tick范围0..1000000、数值为绝对值不超过10^9的整数，`missing`时value为null，`valid`时为整数。此范围仅是合成格式，不是用户任务预算。身份/时点/revision三元组唯一。观测在区间结束后发布，即release_tick严格大于event_tick/valid_tick。

评估侧指定origin及horizon（1..32），按`release_tick <= origin`投影。因变量观测另须`event_tick < origin`；observed协变量须`valid_tick < origin`；known_future协变量可以含未来时点，但仍必须已发布。快照保留全部合法修订，不预选唯一值。最高revision_id是该时点已发布权威版本；最新版本缺测时明确缺测，不能悄悄取旧非缺值。空/不足历史可给具名执行错误，不得填入未发布历史。

预测程序每次只获得`l02-asof-snapshot/1`及新的输出目录：origin、horizon、两个注册表和合法vintages。完整原始事实、未来目标和评估器位于工作进程之外。合法未来日历/当时发布预测可使用；事后实测不能当成当时已知。后续更晚origin可看到新增修订，其质量和可知性分开评价。

点预测原语输出`l02-point-forecasts/1`，每条含series_id、target_tick与有理数value（numerator/denominator）。当前参考采用最高已发布版本的普通最小二乘（Ordinary Least Squares，OLS），仅为解析资格见证，不是限定候选必须采用的最终算法。

独立检查必须绑定评估侧指定的origin/horizon，重建许可集合并逐事实核对。未来不可知值扰动在合法输入相同的条件下应保持同一确定程序输出相同；该控制与物理输入隔离共同构成局部证据，不证明所有任意程序无泄漏，也不证明预测质量或统计成熟。
