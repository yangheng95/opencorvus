# 30数值叶的局部执行资格

当前单一实现位于[唯一源码目录](../../current-source/l06_numeric.py)。A01–04、B01–11、C01–11、D03–06共30叶读取原始公开材料，复用check_l06.inspect_plan中的唯一精确递推。schema先行；所有可计算约束逐家族采集。财务需要物理/信息/终期条件完整可执行，C06需要整体业务可行；错误声明库存独立落D03，不代替真实库存。其余17执行/审查叶unassessed，total_score始终null。

[最终28次真实CLI](run-d-reference-binding/receipt.json)约7.24秒，包含47808完整可行、49032.9质量失败、四类事实错误、同一策略多约束违例、零动作、缺交/shape、现金手算、可选库存、行序重排、未注册变体、巨大合法整数与参考矛盾。成本49032.9不是整体业务不可行。原22业务CLI和11输出CLI因共享递推改动而必要回归通过，完整命令/源/输入/输出在originals.zip的legacy-regression/，未重复solver。

[独立审查](../../../independent-numeric/REVIEW.md)初轮发现两处实际P1：public与本次raw一起漂移仍套用旧界，以及可行C低于伪下界仍按负gap通过。修后从现有注册ZIP/member经共享decode_json读取原业务身份；行序可不同，业务语义须相同。C<L为reference_bound_contradicted/run_invalid。修后10数值CLI+4decoder合同通过，不向候选扣设施错误分。

originals.zip保留source-before、首轮cp1252资格错误、巨大整数两真实exit1、每轮固定源码及所有日志；独立原错误通过在独立目录的originals.zip。只有诊断呈现投影大整数的位数/定位，业务精确乘加未舍入。archive是保留原件，不用可变源码摘要当验收。该资格不批准完整47叶、冻结、变体、小时级或十题完成。
