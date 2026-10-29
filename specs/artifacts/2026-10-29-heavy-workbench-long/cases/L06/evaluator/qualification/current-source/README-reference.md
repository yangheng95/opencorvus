# L06 reference source pipeline

Run in the declared reference image with Python 3.11, NumPy2.4.6, SciPy1.15.3, OR-Tools9.15.6755 and Matplotlib3.10.3:

```text
/opt/cpsat/bin/python -B reproduce.py --input <raw-packet-directory> --output <new-output-directory>
```

The program reads the supplied raw packet and its declared source modules only. It compiles a new integer model, starts a fresh CP-SAT search without a supplied warm-start hint with no default time limit, records real improving incumbents, verifies the native/derived cost, and writes the plan/ledger/summary, baseline and alternative, report and rendered figures. The baseline is the first actual feasible solution of this run; all local alternatives enter the same business checker. No reference score or candidate-hour claim is produced. A nonzero solver gap is not an exact optimum proof.

All output paths in manifest are relative to the new output root; source paths here are relative to this project root. Input facts and units are described in DATA.md. Defaults are 8 search workers, seed20261029, primal-relative gap0.009; optional explicit solver-seconds is a local diagnostic parameter, not a benchmark or user global budget.
