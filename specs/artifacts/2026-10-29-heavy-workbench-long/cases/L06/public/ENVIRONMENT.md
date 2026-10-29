# 运行环境说明

候选需要读取UTF-8 CSV/JSON、执行自己的源码、运行数值工具并生成交付图表。允许成熟求解器和任何正确算法，没有强制慢算法或最低计算时间。硬件/安装准备不当作候选有效工作时长。

当前评估者参考使用隔离Python3.11.13、NumPy2.4.6、SciPy1.15.3、Matplotlib3.10.3与OR-Tools9.15.6755，实际从原始包生成新模型/计划和全部交付。当前整数执行后端唯一为CP-SAT；历史NumPy1.26.4/highspy1.8.0研究捕获只属于旧资格，不是当前参考入口。候选可选择其他正确方法，须声明并实际验证其依赖、可行解及终态，不能把停止或非零gap写成精确最优。

SciPy1.15.3声明numpy>=1.23.5,<2.5，来源为[固定版本官方依赖](https://raw.githubusercontent.com/scipy/scipy/v1.15.3/pyproject.toml)；CP-SAT参数依据[固定v9.15官方定义](https://raw.githubusercontent.com/google/or-tools/v9.15/ortools/sat/sat_parameters.proto)，并已实际导入和求解资格。正式运行仍记录实际镜像/版本/参数，不根据库名猜接口/状态。本说明未提供完整传递依赖锁。

不用GPU、联网或外部模型也可以完成本实例。声明依赖的准备发生在冷复跑之前；执行时只带源码、冻结输入与准备好的依赖，不带候选旧输出。每次候选运行的实际Task/模型/角色、权限和资源在运行注册与真实记录中另记；本环境说明不代表难度或运行时长实证。

本机已准备可用的依赖镜像`opencorvus-benchmark-reference:20261029`，其不可变镜像ID为`sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf`，上述Python位于`/opt/cpsat/bin/python`。该镜像仅提供依赖，不含本题输入、计划或评估源码。无需在宿主Python上重新安装数值包；例如可以将自己的项目挂入该环境运行自己的入口：

```text
docker run --rm --network none --mount "type=bind,source=<绝对项目目录>,target=/work" --workdir /work opencorvus-benchmark-reference:20261029 /opt/cpsat/bin/python reproduce.py --input /work/inputs --output /work/new-output
```

只挂载自己的项目/输入/输出，不挂载其他运行或评估者目录。评估侧可在同一准备环境直接调用入口；程序不应要求在容器内部再次访问Docker。其他正确语言/方法仍可使用，需给出可准备的依赖与实际执行说明。
