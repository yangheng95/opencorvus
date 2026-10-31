# Native numerical runtime

Execution is native Windows with owned Python processes, one solver CPU thread,
no Docker or WSL. Declared compute interpreter:
D:/opencorvus-benchmark-runs/native-operations-reconstruction-20261031/Scripts/python.exe
Python3.14, NumPy2.5.4, PySCIPOpt6.3.0 and OR-Tools9.15.6755 are installed there.
You may use mature tools or declare/install your own dependencies under your
submission. This runtime is a dependency, not permission to read other run roots.
Plotting dependencies must be declared; no specific plotting library is required.

Each final assigned programme execution has a nominal180-second numerical
optimization allowance, one solver thread. This is a numerical experiment
profile, not a total agent wall-clock/token budget or minimum work duration.
Register and record numerical allocations; actual setup, validation and
indivisible optimizer-step overruns remain visible. Early valid completion is
allowed. Preserve actual CPU/process and native-solver facts; do not count the
model's120 periods, accumulated multicore CPU, queueing, setup, plotting or the
whole lifecycle as useful candidate work.

The programme is executed from captured submitted source against new assigned
inputs. All source/dependencies/output claims are preserved before evaluation.
Native same-user execution does not certify an operating-system security
sandbox or side-channel isolation. Public inputs are immutable; keep owned
outputs, installs and caches in the declared submission scope and use -B for
Python when appropriate. Source identity does not replace numerical behavior.
