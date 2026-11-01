# 销售结算
修复现有 sales_summary.py：逐笔十进制定点金额运算，状态去除两侧空白；计入 paid 与 refunded（退款金额已为负），忽略 cancelled；按 team/currency 分组，金额为保留两位小数的字符串，分组键为 team/currency。命令 python sales_summary.py orders.csv 输出 JSON。不得跨币种相加。
生成 summary.csv，列 team,currency,net_amount，按team/currency排序；生成 REPORT.md，包含口径、实际结果表、修复点和实际运行命令/结果，以及原数据边界。仅使用Python标准库。不要更改orders.csv。
