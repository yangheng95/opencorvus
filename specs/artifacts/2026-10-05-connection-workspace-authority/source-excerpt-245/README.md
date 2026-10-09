# 245 Sources摘录的实际上游边界

[Recall与分析](../source-excerpt-investigation-245.md)。仅root，原244 scope已完整退役；没有启动LLM或服务、复制凭据或操作用户页面。

`original-244-search-boundary.json`由实际readonly SQLite/current production completedToolOutcomeOutput解析原search结果。三条canonical摘录1700/1400/4142字符逐字出现在原7730字符工具输出中，精确URL/Source Part/Message/resultAttempt身份保留。原输出已有13/22/20个空inline-code span。没有重新生成或修改Source Part。

`independent-public-exa-boundary.json`来自一次新的公共远端请求，沿用原真实query/numResults3，不发送凭据。实际HTTP200/text-event-stream、12054字节/current production parseExaWebSearchText→3结果；三段完整snippet在raw远端文本中的实际偏移189/2083/3673，空span13/22/20。这些空位在parser处理前即存在，不能靠显示层修复丢失事实。

这次新请求不是244原HTTP重放；244原HTTP未保留，其原缺字只在Tool输出/canonical之间直接证明。当前代码链只有trim与源事实验证，Source excerpt唯一纯text显示。完整原工具和新remote raw保留在ignored `.tmp-product-iteration/source-excerpt-245/`；公开仅身份/长度/数据对应关系，没有完整文档或secret。

没有生产修改或UI自动化，本轮数据检查不冒充新视觉验收。244实际图片仍是已观察到的症状；所有Source内容质量、无格式snippet美化、运行中侧栏Rendering还需要对应范围的证据。
