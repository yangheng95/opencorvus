# 文件链接条目证据

[方案与Recall](../../records/2026-10/2026-10-13-file-link-entry-contract.md)记录根因、全部影响、实施前决策、真实验收和未覆盖范围。本批唯一产品实现为File/index.ts条目合同，目录链接浏览能力没有新增。

- before：3张真实修前图、原fixture、发布后原inode/dev/readlink及旧/新内容404与原target200。图02原PATCH404、图03旧编辑path/text，均人工查看。
- after：11张真实修后图及原观察；图02新编辑path与独立read404；图03仅选中已移动条目（跨标签未保留反馈，不称可见成功横幅）；图05junction刷新后保留选择；图06/07真实OLD→NEW；图08复制；图09/10/11broken重命名及中文删除。
- after/physical-http-check.json：同一原物理项目13真实只读请求、5完整字节/API内容文件、3移动link准确身份、原copy文字和明确内容错误。renamed-entry-identity.json保删除前准确entry身份。
- runtime：前后原Host/Target/PID/birth/occurrence及普通shutdown、物理/output/request结算与parentjoin0；都在固定900秒截止前完成。
- validation：92项正向功能测试847断言、额外类型、首轮工具失败和修复后同检查。独立tests子目录51/618与99原TCP请求来自真实日志，其余41/229来自主agent原runner。整源format仍1，baseline/current五个原hunk相同；不得称整文件格式通过。
- primitive-investigation：10项原cp和broken entry宿主调查；它不替代修后HTTP或页面。
- reviewed-scripts：实际执行launcher/fixture/checker与成熟Native Host脚本原字节gzip，仅供证据审查，不是新增产品入口。

日志、AX（Accessibility Tree，无障碍树）与脚本保留原bytes gzip；包括所有失败，不trim或重写成功。14图均实际呈现、人工复核，无UI自动化测试、Provider调用或凭据复制。[独立只读复核](independent-review.md)与主agent/测试owner实际执行资格分开。POSIX、未知I/O、外部并发替换、跨卷和其它metadata发布后故障仍未实测；下一批候选详见方案。
