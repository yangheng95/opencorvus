# 372 CR 文件来源坐标

[Recall与分析](../source-cr-location-plan-372.md)。单agent修复search_code来源坐标与read/editor行定义不一致的问题。

grep现在用原始字节搜索以保留UTF-8字节顺序标记（BOM），将真实submatch转换为CR/LF/CRLF逻辑行。同一记录中的不同CR命中行各有来源，重叠匹配行合并，跨CR匹配保留完整范围。原记录之前的裸CR由同一权限、同一30秒时限和2MiB累计输出预算下的边界扫描提供事实；没有Host文件读取旁路。/find和debug ripgrep仍保留明确的原rg协议。

| 实际来源 | 改前 | 改后 |
| --- | --- | --- |
| CR两个命中 | 合并成1:11 | 3:4、5:2 |
| mixed命中 | 3:4 | 5:4 |
| UTF-8 BOM命中 | 1:4 | 1:5 |
| 跨CR匹配 | 1:8 | 2–3完整范围 |
| LF/CRLF对照 | 3:4 | 3:4 |
| read对照 | CR3/mixed5 | 与搜索真实逻辑行一致 |

before01–04实际错误跳转，05–06实际read正确对照；after01–04为两处CR、mixed和BOM，05为完整跨行高亮，06–07为CRLF/LF，08–09为read与搜索重复定位。15图均人工查看；每图的小JSON仅辅助保存原生selection，没有UI自动断言。真实模型输出和工具来源均自然产生。

初次测试命令把过滤参数误传给只收文件路径的仓库runner，保留原1088失败日志；精确单文件重跑60295得到25pass/5fail，五个新问题均由实际rg复现。实现后84653为30pass，补完整权限/预算/零宽合同后，最终94473为35搜索+8协议+11读取=54pass，8275类型exit0，docs/architecture通过。生产代码仅后端数据投影与工具说明，未变UI构建；两页面实际使用371正式产物main--IPEAIl1.js。现有真实Task与conversation预算验收还证明补充扫描在原累计输出边界以output_limit结算，各保留2096038bytes，进程计数回到原值。

before18376/page195，8来源、8Sol流式HTTP200/EOF，原15809 exit0、Native241666ms；after18377/page196，9来源、8流式HTTP200/EOF，原31997 exit0、271765ms。两scope均事先固定600000ms/12请求，无延长或重开；原页面、进程、输出、请求、端口、auth/models对全部关闭。真实checker核对完整输入文件字节、canonical来源/完成Message/ToolOutcome、HTTP与Provider/Native凭据事实；不将其当视觉证明。

边界：CR密集的大前缀可能触达现有输出预算，此时明确返回执行错误，不生成未经证实的坐标；测试覆盖了此正向错误合同。Task补充扫描由实际原生执行路径验证，未宣称新增OCI部署端到端资格。非UTF-8编辑仍未完成；历史Source不重写。实页自然回复中的`path:2-3`还未成为正文文件链接，属于后续引用一致性候选；本轮结构化Source范围按钮已正确打开。
