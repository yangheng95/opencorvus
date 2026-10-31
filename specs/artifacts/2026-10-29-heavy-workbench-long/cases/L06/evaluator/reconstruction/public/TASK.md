# Maritime inventory-routing research and operating delivery

Use the supplied complete mathematical models and original operating data to
produce a better maritime inventory-routing optimizer, actual operating plans,
and an evidence-based research report. This is an optimization research task,
not a claim to reproduce a named official benchmark score or real company logs.
The source is the public MIRPLIB Group2 model and data.

Three development instances are supplied at 120 model periods: a single-class
fleet and two multi-class fleets. A later source-only execution uses two new
multi-class inputs of the declared family. Your programme receives the entire
assigned MPS and raw data before solving; no hidden future demand or physical
rule is introduced. The development raw files describe 360 periods, whereas the
assigned MPS explicitly defines the first 120. Follow the provided MPS.

Deliver a general programme accepting an assigned model/raw/name/output and
declared numerical optimization profile. Mature solvers and domain methods are allowed.
Research may use multiple meaningful experiments; preserve parameters, failures,
actual feasible-incumbent events and all claims about bounds. Do not repeat work,
wait, disable mature algorithms, enlarge instances or write extra prose to consume
time. There is no minimum duration and no user-imposed total agent token or wall-clock limit.

The research questions are: which route, class interaction and port-inventory
choices drive the economic penalty; does a proposed method improve on a mature
general optimizer under an explicitly comparable numerical allocation; and which
conclusions do the actual experiments support? A correct but expensive plan is
valid and retains its expensive objective. Engineering completion is not a high
optimization-quality score.

Primary quality is each assigned input's actual full economic objective, lower
is better. Report meaningful method comparisons, actual operating implications,
uncertainty and limits. Ratios to a disclosed feasible reference are descriptive
and may be below 1; there is no clipping into an author's 100 points, post-result
1% pass line, or requirement that nobody can reach an optimum. Scientific content
is separately reviewed from real source, numbers and figures, not keyword counts.

Provide the outputs in OUTPUTS.md and the native runtime details in RUNTIME.md.
Your final handoff must identify actual files and reproducible commands. Figures
must be based on actual data. Unsupported global optimality, universal real-world
operating guarantees or invented execution history are errors.

## New-input family

The hidden execution instances retain the supplied multi-class fleet, geometry,
capacities, berth limits, travel-time matrices and prices. Demand profiles use
one fixed cyclic recipe: for each consumption port choose period in {19,23,29}
and a phase before generation; multiply the development rate at each t by
1+0.08*sin(2*pi*(t+phase)/period), round with floor(value+0.5), and keep it
nonnegative. Production at the one loading port is total demand at each period.
The assigned raw arrays and corresponding full MPS are supplied to the programme.
The choice is registered before execution, not selected by achieved cost.
Previously disclosed development inputs are not relabeled unseen tests.

This restricted family is not a claim of broad industrial generalization.
We measure actual delivered quality; unknown-input performance and useful work
must be observed before calling this a mature heavy-task benchmark.

## Input sources

Original model and data: https://mirplib.scl.gatech.edu/index.php/instances
The supplied Group2_MIP_Model.pdf states the model. MPS is the complete finite
mathematical object, including the exact coefficient values used for evaluation.
Optional method literature may be consulted with honest source attribution;
no particular author algorithm is required.

## Identical resource boundary for both systems

Instance facts are only the supplied problem files and the assigned per-run
raw/MPS. Generic algorithm literature, library documentation and declared mature
solver/runtime dependencies are allowed and should be attributed. The source
URLs above record provenance, not permission to import additional instance
answers. Do not retrieve/import published incumbent/MST/route vectors, external
instance answer/bound tables, old task or candidate outputs, private reference
or evaluator files, other projects, or external solving/answer services.
Preexisting/incidental exposure must be disclosed; this protocol does not claim
pristine pretraining or operating-system isolation.

Your own development results remain legitimate evidence and may inform method
design. The final assigned-input execution receives captured source and declared
generic dependencies plus that complete assigned problem. It must recompute the
assigned plan under the numerical profile; old instance vectors/answer caches
are not substituted as extra runtime inputs. Mature optimization algorithms
and meaningful development experiments remain allowed.
