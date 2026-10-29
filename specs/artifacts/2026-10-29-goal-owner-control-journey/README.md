# 持续目标与历史复制实页证据

对应[方案与调查](../../records/2026-10/2026-10-29-goal-owner-control-journey.md)。三个独立开发`/ui`：38334基线main-I1f_al31.js；38335修复后无认证、0模型额度；38336配对资格后真实模型。后两者普通main-BO7BfSY_.js。23张未经编辑的原图全部实际呈现并人工查看；没有UI自动化、DOM文案/像素/组件断言。

- 01–03：真实既有Mission的Goal作用域与空目标原生校验。
- 04–05：零轮预算校验；折叠错误字段后提交仍展开并归还字段焦点。
- 06–07：已完成订单Task及其独立表单；前一Mission草稿随owner切换退休。
- 08–09：修复前Task首个侧聊被ProviderModelNotFoundError挡住，列表已成功；原完整错误保留。
- 10–11：修复后无认证也能准备独立侧聊、出现输入区与其自身Goal表单。Task根Session实际无物理Message，空参考历史有对应SQL事实，没有伪造worker历史。
- 12：另一真实Chat成功复制并展开8条完成历史，原用户/模型/停止记录完整保留。
- 13–14：中文侧聊Goal表单及“请填写目标”校验，未创建新目标。
- 15–16：资格预检后提交一轮目标，第一阶段实际回复并进入budget_limited。
- 17–18：普通Details将额度1改2，恢复选项保持未勾；Save without resuming后实际paused、41,127 Token/1轮。
- 19–20：明确Resume后，第二阶段回复与真实get/update_continuous_goal工具记录完成；完整详情显示124,421 Token、2轮。
- 21：完成目标创建下一目标草稿，指南返回保留原输入；取消，没有再次执行。
- 22–23：同一完成目标的中文证据/本地化日期数字，恢复英文。用户/模型原文保持真实内容。

早期截图受既有1119捕获/1280 DOM差异影响，右Dock部分截断，不据此修改CSS或称完整Dock通过。后续15–18原图实际1280×720，19–23为当前桌面约1094×1244；最后只读DOM为1093×1244，与原图舍入相符。未设置viewport override，也未操作用户窗口；尺寸变化来源未定，不把它当产品已修复。后段完整Dock及模态目标区域均已人工查看。

`qualification.json`分别记录已有OAuth、完整catalog投影、指定模型真实流式资格。`live-first-check.json`、`live-paused-saved.json`和`live-final.json`来自实际只读HTTP观察，记录同一Goal/SideSession、两个真实controller输入及对应回复/工具。全批6次请求，全部gpt-6.1-sol、streaming/200/原reader EOF；总8次额度中未用2次随服务退休，累计773。Goal的三条原usage关联为41,127+41,414+41,880=124,421；完成后才开始的最终回复继续属于Session，未回填目标。

`data.json`核对三实例全部原行与每个源库。基线103724/103724精确；无认证实例103724原行精确、最终104444；真实模型实例104444原行中104441精确、最终106258。三个授权差异仅两个过期容量slot的本批取得/释放，以及本批侧聊自身的time_updated和零文件摘要；原Task/Mission/消息与权限/metadata保持，未清库。原五输入字节/mtime与三个13文件附件namespace一致。`runtime.json`含公开200、原19593/3712/83801 join0、native/launcher0、物理/输出/请求结算、出生身份链退休和认证/目录清退。用户18571及其数据库未用作运行目标。

`checks.json`为当前通过的聚焦服务端合同、类型、构建、SDK/OpenAPI与文档检查；不能替代上述视觉与实际模型证据。`toolchain.json`保留夹具类型、树投影观察范围及PowerShell参数错误和重跑，不把它们伪称为产品红灯或首次全通过。没有穷举所有Task/Mission/SideChat owner、平台、在途取消和重启恢复；普通fork的本轮验证为真实服务端路由，未声称完成其整套网页入口旅程。持续迭代Goal保持active。
