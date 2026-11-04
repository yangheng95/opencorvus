# 已配置模型服务商：真实页面证据

[调查与方案](../../records/2026-11/2026-11-05-configured-provider-visibility.md) · [资格摘要](qualification.json)

2026-11-05，由一个agent在两个独立原生开发服务的`/ui`页面实际操作并逐张查看截图；没有操作用户18571窗口、进程或真实用户数据库。

## 观察与修复

空模型项目已有OpenAI配置，“已配置1”却无法在首屏辨认，搜索“已配置”还显示0项。根因是统计使用配置/运行目录并集，目录行却只保留active（实际已连接）状态。现在复用统计原有身份集合，目录依次展示已连接、已配置和其他项；配置本身使用中性徽标，不宣称认证或推理正常。名称、标识、模型数与原始诊断保持真实。

两类原行的配置状态搜索使用同一身份集合，配置统计和搜索语义一致；没有新增平行目录、缓存或持久状态，也没有修改共同providerState契约。

| 实际截图 | 人工观察 |
| --- | --- |
| [01-before-default-chinese.png](01-before-default-chinese.png) | 修改前：已配置1个，但默认首屏全是其他目录项。 |
| [02-before-openai-search.png](02-before-openai-search.png) | 修改前：搜索OpenAI仅见0模型，没有已配置标记。 |
| [03-before-configured-row-expanded.png](03-before-configured-row-expanded.png) | 修改前：真实展开已有条目。 |
| [04-before-configured-search-empty.png](04-before-configured-search-empty.png) | 修改前：搜索已配置显示0/227。 |
| [05-before-original-connected-project.png](05-before-original-connected-project.png) | 修改前：原正常项目OpenAI已连接、12模型并优先。 |
| [06-after-default-english.png](06-after-default-english.png) | 修改后：英文默认页优先显示灰色Configured及真实0模型。 |
| [07-after-configured-search-english.png](07-after-configured-search-english.png) | 修改后：英文名称与Configured联合搜索。 |
| [08-after-default-chinese.png](08-after-default-chinese.png) | 修改后：中文默认页优先显示灰色已配置。 |
| [09-after-configured-search-chinese.png](09-after-configured-search-chinese.png) | 修改后：搜索已配置找到对应1项。 |
| [10-after-configured-row-expanded.png](10-after-configured-row-expanded.png) | 修改后：配置行原展开操作保持。 |
| [11-after-no-matching-provider.png](11-after-no-matching-provider.png) | 修改后：不匹配查询仍显示正确0结果。 |
| [12-after-add-form-and-configured-row.png](12-after-add-form-and-configured-row.png) | 修改后：添加表单正常打开，随后取消且未保存。 |
| [13-after-original-connected-project.png](13-after-original-connected-project.png) | 修改后：原项目已连接、12模型和最高优先级保持。 |
| [14-after-connected-in-configured-search.png](14-after-connected-in-configured-search.png) | 修改后：配置搜索也包含原已连接服务。 |
| [15-after-return-to-empty-project.png](15-after-return-to-empty-project.png) | 修改后：返回空模型项目恢复其真实0模型/中性已配置状态。 |

## 验证与数据

- 15张人工截图：5张修改前、10张修改后。实际覆盖中英默认与配置搜索、中文展开/收起、无结果、清除、添加/取消、原项目已连接与双项目往返。英文名称+状态联合搜索正常；中文配置查询从0/227改为1/227，原已连接服务也包含在配置查询中。
- 两阶段各初末9项公开检查共36项通过；既有持续任务、交互、目标、24条收件箱、文件/404、原四题八文件、两轮四题与40行纪要、原不可变快照和四资源保持。真实空会话四检查点均0消息/0模型请求，配置原字节不变。
- 8包类型、1次最终Node前端构建、接口6规则36文件、文档352操作26组及20架构文档检查通过。纯UI（User Interface，用户界面）改动未新增或运行UI自动化测试，没有运行无关单元测试。
- 两原始原生句柄退出0，公开关闭200，物理/输出/请求结清；四份认证与完整模型目录副本成对退休，原认证元信息、目录字节/元信息及源库保持。
- schema（结构）10、92表不变，293738→293740→293742，每阶段只增加正常服务租约和授权各一。114项目/Git身份、104隐藏配置及277附件完整保全；0新增项目/会话/模型请求，累计请求仍1400。

## 限制

没有保存配置、密钥、认证或删除/刷新/发现/连接测试。只读账户200和精确模型投影不代表实际推理验收。继承的可解析项目配置没有可编辑自定义服务声明，其搜索字段扩展仅源码复核；未为了验收制造配置数据。原构建大包警告仍在。
