# 模型服务商设置范围：真实页面证据

[调查与方案](../../records/2026-11/2026-11-05-provider-scope-context.md) · [资格摘要](qualification.json)

2026-11-05，一个agent在三个独立原生开发服务的`/ui`页面实际交互并逐张视觉复核。用户18571窗口、进程和真实用户数据库均未操作。

## 修复与真实范围

模型服务商页现在直接显示当前项目，点击可查看完整真实目录；没有项目时明确显示“全局设置”。配置保存目标与所有项目共享的登录信息/API（Application Programming Interface，应用程序接口）密钥分别说明。目录、配置写入、表单捕获范围和共享认证仍由原实现拥有，没有另存范围或配置。删除的已有二次点击说明也明确共享凭据影响，其操作未执行。

项目模式继承完整原数据验收；全局模式通过正常无项目CLI（Command Line Interface，命令行界面）首次启动、独立全新数据根和应用初始化的新库验收。原库还有未完成任务，因此没有把原库改为全库恢复，也没有禁用恢复、注入浏览器状态或修改生产路由。

| 实际截图 | 人工观察 |
| --- | --- |
| [01-before-root-project-english.png](01-before-root-project-english.png) | 修改前：自然根页面继承启动项目，但英文设置没有项目范围说明。 |
| [02-before-empty-project-chinese.png](02-before-empty-project-chinese.png) | 修改前：中文空模型项目没有项目/保存位置说明。 |
| [03-before-add-form-scope.png](03-before-add-form-scope.png) | 修改前：添加表单没有说明保存位置。 |
| [04-before-original-project-chinese.png](04-before-original-project-chinese.png) | 修改前：另一真实项目仍没有上下文，模型数为12。 |
| [05-after-project-scope-english.png](05-after-project-scope-english.png) | 修改后：英文项目名、配置保存目标与共享凭据说明。 |
| [06-after-project-path-english.png](06-after-project-path-english.png) | 修改后：英文完整长目录实际展开并正常换行。 |
| [07-after-empty-project-chinese.png](07-after-empty-project-chinese.png) | 修改后：中文项目范围与真实0模型。 |
| [08-after-empty-project-path-chinese.png](08-after-empty-project-path-chinese.png) | 修改后：中文空模型项目的完整真实目录。 |
| [09-after-search-and-shared-key-context.png](09-after-search-and-shared-key-context.png) | 修改后：搜索及配置行展开时共享密钥说明可见。 |
| [10-after-add-form-project-scope.png](10-after-add-form-project-scope.png) | 修改后：添加表单上方保留项目保存位置，随后取消。 |
| [11-after-original-project-scope.png](11-after-original-project-scope.png) | 修改后：原Task项目恢复其真实12模型与已连接状态。 |
| [12-after-original-project-full-path.png](12-after-original-project-full-path.png) | 修改后：同名项目的不同完整路径可直接核对。 |
| [13-after-return-empty-project-path.png](13-after-return-empty-project-path.png) | 修改后：返回空模型项目，正确恢复原路径和0模型。 |
| [14-after-global-scope-english.png](14-after-global-scope-english.png) | 修改后：正常无项目首次启动的英文全局设置。 |
| [15-after-global-scope-chinese.png](15-after-global-scope-chinese.png) | 修改后：中文全局设置说明配置与共享凭据。 |
| [16-after-global-add-form-scope.png](16-after-global-add-form-scope.png) | 修改后：无项目添加表单保留全局保存说明，随后取消。 |

## 验证与保全

- 16张实页原图：4张修改前、9张新版项目、3张新版全局。中英项目/全局说明、长路径展开/收起/换行、同名目录辨认、搜索、配置行展开、添加取消、项目往返后的0/12模型均实测。
- 两个原数据阶段各初末9项业务检查，共36项通过；新全局环境4个公开入口各初末回读通过，真实defaultDirectory为空、0项目、0会话、OpenAI12模型与精确Sol投影。原空白会话四点0消息、0模型请求，配置原字节保持。
- 8包类型、1次最终Node前端构建、接口6规则36文件、文档352操作26组、20架构文档检查通过。纯UI（User Interface，用户界面）改动未新增或运行UI自动化，也未运行无关单元测试。
- 三原始原生句柄正常退出0、公开关闭200、物理/输出/请求结清，六份认证/完整模型目录副本成对退休；原认证元信息、目录字节/元信息保持。本轮0模型请求，累计仍1400。
- 原schema（结构）10和92表不变，293742→293744→293746，每阶段只新增正常服务租约/授权各一。114项目/Git身份、104隐藏配置、277附件和全部原行完整保全。独立全局新库仅4行初始化事实（database_authority 1行、全文索引内部3行）、0项目/0会话，且重新核验原293746行及原项目/附件保持。

## 覆盖限制

没有执行配置/认证/密钥保存、删除、发现/刷新或模型测试；二次删除说明仅依据真实写入/共享Auth合同源码复核。没有新建隐式项目，名称后缀沿用原格式化器。账号200和目录投影不代表实际推理验收。构建原有大包警告仍在。
