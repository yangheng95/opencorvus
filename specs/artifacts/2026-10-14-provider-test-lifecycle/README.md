# Provider Test 生命周期资格证据

对应[第14批记录](../../records/2026-10/2026-10-14-provider-test-lifecycle.md)。本批由Root独立实现、操作和人工验收，全部子agent保持停止。

- screenshots：22张原始桌面PNG，全部Root实际查看。01–13为原始调查；14–15修后超时窗口未通过；16–17为修后12.346秒有效响应窗口；18–20为修后A/B并行与逐项退休；21–22为修前12.357秒有效响应对照。
- runs：首次before因显式catalog缺Kilo自然退出1；after、final、postfix、shortbase均正常退出0，自己的两个端口释放且假Auth/models整对清理。每轮完整原日志经原privacy结果扫描后gzip归档；before在写入假Auth前失败，保留完整原stderr，不冒充成功。
- inputs：实际生产backend运行输入、唯一当前launcher/lease/响应触发release工具与隐私工具；historical文件是明确标注的原始执行证据。当前launcher为增加fresh shortbase而扩展枚举，既有stage端口和行为保持原输入；postfix/shortbase runtime未改。参考ProvidersPanel来自已提交B13 e91191975，供修前构建溯源。输入副本只作证据，不是第二个生产实现。
- route-facts.json：从完整原server日志投影身份、时间、路由、HTTP结束码；不是替代原日志。checks保留68正向测试184断言、typecheck、Node UI build的完整输出和实际exit。构建56.27秒完成，现有bundle警告保留。

受控HTTP参加者共15次真实POST，body.stream均true，均按原10秒返回真实HTTP400；Test控制API保持其实际200结果合同。这些输入不认证第三方Provider，不伪造模型成功，本批0 real Sol。所有凭据为自有临时假输入，没有复制用户Auth。隐私检查只覆盖各轮收集的当前已知假凭据和实际完整日志，不把不存在的历史秘密集合声称已扫描。

有效结论：同一backend全局Auth已接受且前端在15秒内获得响应后，修前新项目面板保留旧Test，修后按真实Provider ID退休。A接受保存时B仍在途并独立完成。旧43.630秒和152.383秒窗口均超过产品15秒超时，只保留为失败调查，不用它们证明通知缺口。

边界：没有新增/运行UI自动化。截图人工核验是桌面英文Provider区域；本次没有新增产品文案。通用认证/刷新/项目Config等共用通知入口有源码与局部正向合同，尚未完成全部在途桌面矩阵；CLI、其它窗口、前端超时后才提交、完整Task/Mission/Session重启容量矩阵仍未资格。B13的9次真实Sol属于上一批，不算本批验收。
