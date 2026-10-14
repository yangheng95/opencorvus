# 第18批：资源表单反馈位置证据

对应[Recall、根因和实际资格](../../records/2026-10/2026-10-14-resource-form-feedback.md)。Root独立实施并逐张人工查看16个原PNG；0 UI自动化、0真实Provider凭据、0模型推理/real Sol。

- screenshots：01修前提交视口，02修前顶部真实400；03修后inline摘要及原提交焦点，04原诊断同屏，05关闭保留原输入；06首轮deadline后才收起（不作在途资格）；07第二轮在途收起，08迟到响应后阅读区域，09重开表单保留原输入/该次诊断；10英文MCP本地解析，11中文Skill400，12真实有效Skill已加载完整来源，13中文MCP本地解析，14关闭保留字段；15原请求在途切到B项目，16原响应后B项目正常输入页面。图片未经编辑/裁剪，没有像素断言。MCP只是参数解析，没有第三方连接资格；12仅证明安装/来源呈现，未执行更新/删除。
- runs：before PID87808/18638–39（occurrence见ready原件）、after PID69828/18640–41、occurrence 08662276-e39c-4cc7-91a1-da4dfa71bb10。正式源backend /ui，修前使用B16冻结UI，修后使用本批Node build。两轮正常runtime settlement与parent实际退出0，端口0，之后整对精确删除假auth/models；完整后台原日志分别101482/193179字节，stdout/stderr各0，已知假credential全量扫描后无损gzip。
- request-timelines.json：纯原日志/人工动作时间收集，不是UI自动化测试。实际输入/请求ID/400状态、开始/完成和持锁时间可核对。首轮有效HTTP等待6389ms，但UI步骤分开，收起时已经返回，不冒充在途资格。第二轮请求71d25cbf-4050-47f7-bf84-d70caa96d2db实际4330ms，form关闭1791936552478、响应完成1791936556231（晚3753ms）；第三轮9a6c82bf-4054-4066-be37-4356cfc14d4d实际2617ms，B选择1791936908749、响应完成1791936910117（晚1368ms）。全部由10秒deadline释放，后续release接口只是确认已释放，不能称为manual释放或延长timeout。
- installed-qualified.json：真实UI成功POST（9fb4da9a-157a-419e-9c16-4a6f9f994994，200，1044ms）后，从正式公开GET读回owned-feedback/config_path及全局source目录身份。不是模拟接受。
- inputs：唯一产品修前组件、before原运行器、after增加真实生产catalog-owner控制的独立fixture、公开读回checker和日志收集器。fixture只限本任务localhost participant，响应仍由真实生产route产生，10秒上限；没有产品新路由、mock响应或模型请求。
- checks：前端类型、Node UI build、formatter、公开读回、两轮全日志隐私与最终文档/index实际回执。未新增UI测试；原构建warnings完整保留。窗口只资格桌面；没有宣称耗时精确到固定环境指标或全部宿主。
- previous-delivery：第17批自己的normal commit、fresh sync、完整pending、exact topology、normal push与远端dc14840a3原件无损gzip，保留remote原空格。不借用其他任务推送。

原图03和10对应的提交后AX焦点分别仍为Install Skill和Add MCP；展开Details后才自然转到Disclosure。15刚切B时按钮仍有焦点，16正常Chat输入已获得焦点，因此不宣称该跨页面动作“焦点恒等”；本改动没有focus调用。语言切换会卸载资源页，不宣称同一个notice跨页面存活。
