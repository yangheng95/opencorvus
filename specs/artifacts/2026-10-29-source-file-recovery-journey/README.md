# 来源恢复与同目录项改名证据

17张原始截图均来自两个独立开发serve的/ui，已经实际呈现并人工查看。没有UI自动化、DOM/源码文案断言、浏览器fixture或像素基线。

01–03：独立QA项目中的真实Code Chat输入、gpt-6.1-sol回复和search_code的八处来源，以及test_invoice.py原4行21列打开。02回复后的Sources位于滚动区域顶部，未将首屏遮挡描述成缺少来源。

04–09：通过Explorer重命名test_invoice.py至新名，旧引用显示加载失败；07展开真实HTTP404/FileNotFoundError详情。恢复原名后，从同一错误面板Retry恢复内容与原引用行。05的截图为改名后加载中状态，后续实际读取成功才继续。

10–11：对invoice.py通过相同真实文件操作取得失效定义引用，中文摘要/详细信息/重试入口均本地化；还原后重试回到定义第4行。这里是模型正文的4行链接，不能冒充5列引用验收。

12–13：原版本invoice.py→Invoice.py实际返回HTTP409/FileConflictError，文件仍为原名。结合[case-primitive.json](case-primitive.json)真实native正反改名成功与同一entry身份，定位为共享File.move的存在性冲突判断，而非系统限制。

14–17：新开发实例使用修复后的File.move，原项目与真实历史保持；同一改名成功，列表显示Invoice.py及成功回执，编辑器同步标题和原定义内容。中文反向改回invoice.py后，再关闭/打开原历史定义链接仍读取正确文件。14/16的先前AX仍捕获加载态，实际截图已显示完整正文，不将其判为失败。

DOM角色定位Details的一次no_matches改由刷新后的原生AX索引展开成功，属于浏览器控制层差异。没有读取或更改原剪贴板。两页面warn/error读取为空，仅作辅助，原404/409事实以真实反馈/请求详情为准。

- [data.json](data.json)：两库92表/schema9/integrity ok，初库110245条旧行中110243条精确，两条已过期容量槽按真实Provider租约正常复用；业务旧记录和源库保留。后库全部112116条旧行精确，最终112184行。十个原输入/新QA副本及两个namespace各17项原附件保留，八处来源未改写。
- [runtime.json](runtime.json)：两次公开shutdown200，原exec8032/11198及native/launcher退出0，物理/输出/请求与出生身份退休；首次5次实际流式gpt-6.1-sol均200/EOF，未使用的1次额度退休，后实例0请求/无auth副本，累计782。
- [checks.json](checks.json)：正确重现的旧代码3失败/3成功、修复后11项真实路由合同与5项根/链接移动合同、后端类型及文档检查。非UI合同总16成功/170断言，不把原失败或重复轮次累计为成功数。

修复只改变File.move对现存同一目录项的名称变化判定，保留原子不替换发布、权限/路径保护和不同目标409。未修改schema、源历史、Provider、前端组件或包版本；复用当前普通前端产物，实际新进程加载修复后后端。Windows文件/目录/junction通过真实路由；视觉复核仅覆盖文件。macOS不区分大小写卷、Linux及外部retarget原子性未新增资格。
