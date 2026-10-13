# 373 正文冒号行范围引用

[Recall与实施前分析](../source-colon-range-plan-373.md)。单agent完成正文冒号行范围支持，使其与Sources显示/复制的范围语法一致。

唯一file-reference解析器现在接受`path:line-end`，端点为安全正整数且end>=start。沿既有endLine属性、委托和canonical range打开，不另建renderer分支或导航状态。单行列号、#L范围、Unicode及Windows drive保留原行为；过期语法注释和架构同步更新。

before18378/page197：实际read得到20–22 Source和自然五项引用。行内范围点击无动作；显式Markdown链接实际离开/ui并落在无样式Preparing Environment。返回自身页面、重新选择同一会话后，Source范围按钮与单行列号对照正常。before01–04为四张实页证据。

after18379/page198：Main行内范围、显式Markdown范围、Windows绝对路径均打开20–22且保持/ui；#L范围对照与20:4列号对照正常。顺序打开产品Side会话、完成真实read和自然回复后，两种Side引用都激活File并显示完整20–22范围。after01–05为Main，06为实际Side完成态，07–08为两种Side激活结果。4+8共12图人工复核，小JSON只保存原生选择位置/URL/已载入资源作辅助，没有UI自动断言。

精确parser改前16pass/5fail；改后21 parser+11 workbench revision=32pass。60893类型exit0，82967正式build exit0，53.91s，实际加载main-B5ENb1Oe.js；docs/architecture通过。

before原37511 exit0，Native207158ms、5实际gpt-6.1-sol流式HTTP200/EOF；after原70590 exit0，460397ms、9流式EOF。每scope事先固定600000ms/12请求，无延长或重开；页面197/198、全物理/output/request/端口与私有auth/models对均闭合，最终IAB为空。真实checker验证原文件完整字节、Main1 Source与after Main/继承/Side共3 Source、read完整结果、自然Message终态、HTTP/Provider/Native事实；这些数据资格不替代截图。

边界：本轮没有操作用户Native外部编辑器或验证其完整范围选区，未改变剪贴板机制或覆盖359首次复制未知。绝对路径仍按已有absolute-source合同显示只读，after03可见同一项目文件的绝对引用与相对引用编辑状态不同；这项导航语义留待后续调查，不包装成本轮已修复。非UTF8编辑风险同样未在本轮处理。
