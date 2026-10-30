# 干净复建
Python 3标准库用于app/旧app/演练，Matplotlib用于图。程序为app.py、legacy_app.py、report.py、reproduce.py及submission声明的其它普通文件。离线依赖预装，不在运行时联网。
将完整public输入保存RAW（含app-v1.sqlite、identity-authority.json、legacy_app.py和exercise_app.py），将submission文件保存SOURCE。在ENVIRONMENT规定的Linux owner容器运行python SOURCE/reproduce.py --input RAW --output NEW_OUT。该入口仅调用随公开输入交付的唯一exercise_app.py执行器，无私有grader/参照/权重依赖；它启动自己的旧/新应用进程、控制公开故障、保存全部原native/SQL、再以无特权只读原事实执行本submission的report命令，生成NEW_OUT/delivery。新输出必须不存在；容器networknone、1CPU、SOURCE/RAW只读。独立验收从原raw重新计算，不用候选自评。
先观察原owner真实终态，不重复已完成的同一目录。任何失败保留request、stdout/stderr、exit与现场库后处理。与SQLite commit后ACK丢失相区别，无法承诺物理掉电下OS/磁盘可靠性。
