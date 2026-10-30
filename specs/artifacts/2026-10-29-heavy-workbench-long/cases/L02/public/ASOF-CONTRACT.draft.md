# L02 发布时间输入合同（局部草案，未冻结）

本合同限定整数tick输入原语，早期解析例采用合成日界；当前[UTC多系列材料](MATERIALS.draft.md)通过唯一decoder按固定小时坐标映射到同一原语。本文件不是完整预测/评分合同。旧H02全量未来CSV及作者总资源额度不适用；正式内外层研究执行、点/区间质量和决策交付仍待。

`l02-vintages/1`的权威事实由评估侧保存。series注册单位；variables另注册`observed`或`known_future`。每条事实有业务时点、发布时点、非负整数revision_id、value及quality_flag。当前tick范围0..1000000、数值为绝对值不超过10^9的整数，`missing`时value为null，`valid`时为整数。此范围仅是合成格式，不是用户任务预算。身份/时点/revision三元组唯一。观测在区间结束后发布，即release_tick严格大于event_tick/valid_tick。

评估侧指定origin及horizon（1..32），按`release_tick <= origin`投影。因变量观测另须`event_tick < origin`；observed协变量须`valid_tick < origin`；known_future协变量可以含未来时点，但仍必须已发布。快照保留全部合法修订，不预选唯一值。最高revision_id是该时点已发布权威版本；最新版本缺测时明确缺测，不能悄悄取旧非缺值。空/不足历史可给具名执行错误，不得填入未发布历史。

`l02-asof-snapshot/1`是唯一许可投影的评估侧中间事实。当前每日预测worker只获同投影选中的原始CSV行及`l02-daily-worker-packet/1`公开manifest/显式target_ticks；不把规范答案当额外输入。完整原始档案、未来标签、尺度和评估器位于工作进程之外。合法未来日历/当时发布预测可使用；事后实测不能当成当时已知。后续更晚origin可看到新增修订，其质量和可知性分开评价。

早期`l02-point-forecasts/1`及7时点OLS（Ordinary Least Squares，普通最小二乘）仅为历史解析资格，其入口已从current-source退役，原执行源/命令保存在评估侧qualification/main及independent-review的originals.zip；不保留旧小时range预测fallback。当前每日输出和均值/区间格式见[研究合同](STUDY-CONTRACT.draft.md)，候选算法不受参考方法限制。

独立检查必须绑定评估侧指定的origin/horizon，重建许可集合并逐事实核对。未来不可知值扰动在合法输入相同的条件下应保持同一确定程序输出相同；该控制与物理输入隔离共同构成局部证据，不证明所有任意程序无泄漏，也不证明预测质量或统计成熟。
