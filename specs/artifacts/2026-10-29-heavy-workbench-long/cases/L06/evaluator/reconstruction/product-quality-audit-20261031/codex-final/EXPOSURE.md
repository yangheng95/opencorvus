# Input and method provenance

This project used only the five supplied public contracts, the three supplied development MPS files, the supplied raw ZIP and supplied model PDF for instance facts. The complete raw text members were inspected. The PDF was extracted into model-pdf-extracted.txt. No external instance vector, incumbent, bound table, route answer, candidate output, hidden evaluator/reference data, other run root, host repository, credential, remote solving service or additional agent was accessed.

The declared native runtime was used as a generic dependency. Matplotlib, pypdf and their ordinary generic dependencies were installed in vendor; owned cache and temporary installation files are under this project. Exact package versions and install history are retained. No claim of pristine model pretraining or operating-system sandbox isolation is made. No preexisting remembered numerical solution to these instances was used. Web search returned some unrelated generic solver-help pages; only primary official library sources listed below informed implementation.

Generic sources consulted (2026-10-31):

- PySCIPOpt Model API: https://pyscipopt.readthedocs.io/en/stable/api/model.html — reading full MPS, incumbent access, original objectives, timing and parameters.
- PySCIPOpt event handlers: https://pyscipopt.readthedocs.io/en/v6.2.1/tutorials/eventhandler.html — genuine BESTSOLFOUND event capture.
- OR-Tools CP-SAT Python model API: https://or-tools.github.io/docs/pdoc/ortools/sat/python/cp_model.html — integral constraints, floating point objectives, solution callbacks and model export.
- Official OR-Tools solver troubleshooting: https://github.com/google/or-tools/blob/stable/ortools/sat/docs/troubleshooting.md — search logging and worker configuration.
- Official OR-Tools integer arithmetic notes: https://github.com/google/or-tools/blob/stable/ortools/sat/docs/integer_arithmetic.md — integer linear model representation.
- SCIP timing API: https://www.scipopt.org/doc-10.0.3/html/group__PublicTimingMethods.php — distinguishing native solver wall time and CPU clocks.

The original instance provenance is the supplied MIRPLIB data and Dimitri J. Papageorgiou's supplied 2013 Group 2 model PDF. The source website was not used to retrieve further instance information. The supplied PDF mentions inventory-routing large-neighborhood search literature; no claim to reproduce those authors' algorithms is made. The class-pair scheduling design in this project is a straightforward full-horizon block neighborhood around an incumbent, solved with the declared mature SCIP engine.

Initial development failures: the first Unicode PDF print failed under cp1252 after the UTF-8 extraction file had already been written. The first unseeded 5-second CP-SAT smoke run returned UNKNOWN with no feasible plan; its native log, parameters and termination record remain under experiments/smoke-cp-fiveclass. A one-second SCIP smoke run timed out without a feasible plan; its record remains under experiments/smoke-scip-singleclass. The seeded five-second CP-SAT smoke produced a feasible expensive terminal-only plan and passed full row/table validation. Smoke runs are engineering checks, not the equal-budget quality comparison. No finite objective is manufactured for a run without an incumbent.
