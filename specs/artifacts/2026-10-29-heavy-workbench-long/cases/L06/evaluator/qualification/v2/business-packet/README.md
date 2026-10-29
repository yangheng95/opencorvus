# 原材料到业务事实的编译资格

公开输入在[L06原材料](../../../../public/inputs/)，只有CSV/设施事实。评估侧`current-source/l06_packet.py`单向编译为规范format2，原构造JSON仅作为资格来源保留；不向候选提供计划、参考界、评分器或此编译器。

`receipt.json`保存5条真实CLI的argv/退出/完整响应：export、完整read、报价25→24准确字段变更、反转目录物理行序仍按index映射、重复报价返回`packet_invalid/supplier_quotes`。实际1.42秒。`originals.zip`保存所有原始/变更资料及规范输出；当前脚本在`../../current-source/`的相对位置应按资格根使用。

`executed-source/`是在这轮完成后、后续Decimal reader参数改动前捕获的当时packet/reader/资格源；不把后来当前源冒充原执行源。新Decimal只用于summary，旧默认packet读取行为另外由真实派生输出CLI覆盖。

这只证明事实映射，尚未验证正式扰动实例的最优/可达参考、政策翻转、逐叶grader或完整源代码职业交付，不计重型分或小时。
