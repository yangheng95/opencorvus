# Same native runtime for both candidates

Windows PowerShell. Python3.12.14, SQLite from that interpreter, plus the exact independently installed packages below. Use:

`D:/opencorvus-benchmark-runs/sqlite-safe-import-pair-20261101/runtime/Scripts/python.exe`

From this project root, `& <python-path> -B -m sqlite_utils --help` imports the local source. To run a script elsewhere set PYTHONPATH to this project, keeping private files and other projects outside scope. The runtime and its standard-library/site-packages paths may be read but not modified; write caches, temporary databases and configurations only in your project. No new downloads are required. No Docker, WSL or native UI needed.

Installed package snapshot (actual preparation output, not an assumed latest catalog):

```text
click==8.5.0
click-default-group==1.2.4
colorama==0.4.6
coverage==7.17.0
execnet==2.1.2
hypothesis==6.170.14
iniconfig==2.3.1
packaging==26.3
pluggy==1.7.0
Pygments==2.21.0
pytest==9.2.0
pytest-cov==7.1.0
pytest-xdist==3.8.0
python-dateutil==4.0.0
sortedcontainers==2.4.0
sqlite-fts4==1.0.3
tabulate==0.10.0
tzdata==2026.6
```

The same installed dependency tree is supplied to both candidates. Setup time and evaluator computation are not candidate effective hours. The original Linux container/network-locked execution protocol is not claimed here. Avoid unreviewed broad tests; use directly relevant non-UI positive behavior/state/error checks.
