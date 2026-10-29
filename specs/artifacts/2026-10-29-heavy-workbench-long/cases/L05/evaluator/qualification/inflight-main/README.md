# 原HTTP在途跨越暂停/恢复的受控资格

[主方收据](receipt.json)与[原件](originals.zip)保留真实receiver/sender、固定源和原现场。旧已登记A/Z请求停在服务apply之前，GET确为unknown；同事务pause取得accepted边界7及完整5intent，旧新请求paused、已接受重试duplicate、未结清resume被具名拒绝。同键恢复先取得receipt并完成A1015/B710，再release旧HTTP，得到200/replayed和同receipt；原事实/逐来源及服务effect身份均通过实际checker。修后主方兼容复验自然exit0、1.9762秒，无sleep或HTTP mock。

独立审查仍发现EOF错误收尾：receiver退出0、请求线程尚被SQLite锁阻塞，client ConnectionResetError，effects/requests为空。ThreadingHTTPServer的daemon请求线程未被原主线程join等待；不能拿exit0包装业务完成。[原失败及修后独立追加](../../inflight-independent-review/REPAIR-ADDENDUM.md)完整保留。修后明确non-daemon/server_close等待请求，同时加固定header/body读取截止，防止半包把join变无限等待。

本次只认证一个真实交错及有限read/cleanup，未认证任意并发、多sender、修复中进程退出、完整checkpoint/逻辑导出自由、监测/职业交付/全rubric/冻结/小时。EOF/半包是请求治理资格，不是给候选增加总额度。本资格的合作接收方仍只有public/l05_effects.py。
