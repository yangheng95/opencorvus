# 第17批：本地Skill来源校验证据

对应[根因、Recall与资格](../../records/2026-10/2026-10-14-skill-source-validation.md)。Root独立完成，未委托。

- screenshots：6张未经编辑的真实桌面PNG，01缺失目录400英文，02普通文件400英文，03空目录400英文，04缺失目录400中文，05有效Skill已加载身份/路径（底部控件部分裁出），06滚动后完整来源区域。Root逐张查看；05不冒充控件完整可见，06仅证明呈现，没有执行更新/删除。错误出现后由Root手动滚回顶部，未宣称已修自动定位。
- runs/after：真实生产源后台PID61496、18636/18637、occurrence 751d518d-2bdb-4945-b6e0-018a33e9763f。通过正式runtime启动/recovery与正常settlement退出0，端口0、物理退出后精确清理本任务假Auth/models整对；全量原后台日志129147字节、stdout/stderr0经已知假凭据扫描后无损gzip。使用B16冻结UI build，无前端产品改动或本批新UI构建；原真实/dev /ui静态服务。
- runs/after/public-qualified.json：真实HTTP三种400的完整正向DTO与请求ID，UI成功安装后真实目录投影、全局source身份，及global路由path输入的现有schema400。不是mock或UI自动化。UI交互的四个请求ID由完整后台日志对应：fdc3b965-030d-4e9a-95df-f5715c817881、13c4752e-02e0-4d05-ac82-3f5550847b9c、3d8d98a2-7c1a-49cb-80b6-c335993cc004、70f73268-e29e-4919-9150-63c7991cbddd。
- checks：原focused-before/focused-before-details保留首次夹具生命周期缺陷；focused-before-lifetime为有效修前资格（2成功，4个500红态）。focused-after保留Windows file/child的ENOENT分类预期失败（5通过1失败）；focused-final为纠正OS合同后的6通过18断言。shared-recovery为生产发布恢复+Config writer、真实远程缓存流/安装、来源身份4通过11断言。初次SDK生成使用通用named schema，final改用唯一LocalSourceError.Schema，正式generator同时生成完整path/reason/message DTO；类型与文档回执保留实际轮次。
- inputs：唯一生产运行器/launcher、公开checker、隐私检查器和3个产品修前源文件，只是本批证据，不是第二个产品实现。
- previous-delivery：第16批已交付commit/index/normal push原回执无损压缩，附该批真实修前500原图。发布拓扑回执若未在原scratch使用同名文件不伪造补录；精确交付事实见原receipt。

本批0真实Provider凭据、0推理请求、0 Sol、0 UI自动化；未资格POSIX实际宿主、EACCES磁盘/权限故障、远端git错误或全部替换cut。现有替换测试辅助的非零退出检查不作为本批资格，使用公开正向恢复终态测试验证真实共享路径。
