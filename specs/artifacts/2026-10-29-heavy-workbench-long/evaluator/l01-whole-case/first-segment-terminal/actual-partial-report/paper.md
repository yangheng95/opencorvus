# PINN optimizer study: actual bounded derived execution

## Scope and preregistration
This is a local derived study of Rathore et al., Challenges in Training PINNs: A Loss Landscape Perspective (ICML2024), not the original study or official PaperBench. Read plan.md, inputs/TASK.md and inputs/SOURCE.md for the exact raw-coordinate architecture, data, optimizer and known earlier feasibility context. All source/assets are captured before this output; the caller's actual native receipts bind their provenance. Full requested execution=False. This document reports actual completed, failed and unexecuted cells separately and does not infer scientific success from task completion.

## Mathematical and numerical methods
The raw [x,t] width100 three-hidden-layer tanh/linear-output network uses float64, prescribed Xavier initialization and the exact PDE plus concatenated-condition objective. Training consumes only residual coordinates and initial/boundary conditions, never the analytic future evaluation solution. Native Adam and one-iteration strong-Wolfe L-BFGS use the public parameters; shared11k Adam prefixes are explicit. Attempt/closure/accepted-update counts differ and remain visible. A first finite zero parameter change terminates stalled, not converged; exceptions remain real incomplete/error evidence. NNCG uses the actual shifted Nyström sketch, PCG explicit residual and Armijo sufficient descent. Delta stabilizes the projected factor, not the complete Hessian.

## Actual registered results
|Configuration|State|Accepted updates|Closures|HVPs|Train loss|Relative solution error|
|---|---|---:|---:|---:|---:|---:|
|convection-adam-s345-lr1e-04|incomplete|0|0|0|None|None|
|convection-lbfgs-s345-lrnone|max_updates|41000|83632|0|0.0017896764824236625|0.6116751009888883|
|convection-hybrid-s345-lr1e-04|incomplete|0|0|0|None|None|
|reaction-adam-s345-lr1e-03|incomplete|0|0|0|None|None|
|reaction-lbfgs-s345-lrnone|incomplete|0|0|0|None|None|
|reaction-hybrid-s345-lr1e-03|incomplete|0|0|0|None|None|
|wave-adam-s345-lr1e-03|incomplete|0|0|0|None|None|
|wave-lbfgs-s345-lrnone|incomplete|0|0|0|None|None|
|wave-hybrid-s345-lr1e-03|incomplete|0|0|0|None|None|
|convection-adam-s456-lr1e-04|incomplete|0|0|0|None|None|
|convection-lbfgs-s456-lrnone|incomplete|0|0|0|None|None|
|convection-hybrid-s456-lr1e-04|incomplete|0|0|0|None|None|
|convection-adam-s567-lr1e-04|incomplete|0|0|0|None|None|
|convection-lbfgs-s567-lrnone|incomplete|0|0|0|None|None|
|convection-hybrid-s567-lr1e-04|incomplete|0|0|0|None|None|
|convection-adam-s345-lr1e-03|incomplete|0|0|0|None|None|
|convection-hybrid-s345-lr1e-03|incomplete|0|0|0|None|None|
|convection-adam-s345-lr1e-02|incomplete|0|0|0|None|None|
|convection-hybrid-s345-lr1e-02|incomplete|0|0|0|None|None|
|convection-gd-continuation-0.0001|incomplete|0|0|0|None|None|
|convection-gd-continuation-0.001|incomplete|0|0|0|None|None|
|convection-nncg-continuation-0.01|incomplete|0|0|0|None|None|
|convection-nncg-continuation-0.1|incomplete|0|0|0|None|None|
|convection-nncg-continuation-1.0|incomplete|0|0|0|None|None|

## Same-final quality
Selection uses eligible terminal training loss only, exact-tie ID rule. The convection continuation-parent LR rule is separate. The pre-execution1% solution and0.01 residual/each-condition targets cannot be relaxed to fit these observations. Every component comes from one selected final, not a mixture. Small residual alone is insufficient: reaction initial error can amplify, and periodic/boundary defects are independent. No continuous-domain error certificate follows from the discrete public grid.
convection: {"config_id": "convection-lbfgs-s345-lrnone", "metrics": {"problem": "convection", "residual_points": 10000, "constraint_count": 358, "evaluation_points": 8385, "residual_loss": 3.983937762679793e-05, "constraint_loss": 0.0017498371047968645, "total_loss": 0.0017896764824236625, "residual_rmse": 0.00892629571847112, "evaluation_residual_loss": 7.497765147076943e-05, "evaluation_residual_rmse": 0.01224562382819017, "constraint_families": {"initial_value": {"count": 257, "loss": 2.4879232164934538e-05, "rmse": 0.007053967984749369}, "periodic_value": {"count": 101, "loss": 0.00613908634505831, "rmse": 0.11080691625578531}}, "l2re": 0.6116751009888883, "parameter_count": 20601}, "target_components": {"relative_solution": false, "evaluation_residual": false, "initial_value": true, "periodic_value": false}}

## Diagnostics and recovery
diagnostics contains actual selected scalar/finite-difference checks, parent full/residual/constraint Ritz estimates and same-system unpreconditioned/preconditioned solves when a complete execution provides that parent. Ritz residuals mark convergence; finite Krylov results are not the complete spectrum or a certified condition number. Recovery uses new real child PIDs and the actual500->600 Adam and100->120 selected L-BFGS saved optimizer/RNG; unavailable states or child failures are reported, never replaced by replaying a prefix. Physical shared computation, logical trajectories and postprocessing costs are distinct; phase wall times overlap inherited prefixes and cannot simply be summed.

## Independent representation and physical-prior controls
The same raw width100/tanh architecture can be compiled from initial/boundary facts and PDE structure using a linear fixed-feature fit. These actual network exports, fit matrices and metrics are stored under structure-controls. They are deliberately not eligible for the old randomized-optimizer selection and cannot prove that any Adam/L-BFGS/NNCG trajectory reproduced a solution. They distinguish representation capacity from the initialization/optimization restriction. Known future evaluation solutions are used only after fitting to evaluate the exported weights, never as fitting labels. No old scientific failure is relabeled as a successful optimizer result.
Not run in this partial execution.

## Interpretation and limits
Actual training and selected-field plots accompany this report. Cross-problem observations use seed345; only convection has paired345/456/567 and single-seed learning-rate sensitivity, so they are not19 independent statistical samples or proof of cross-problem seed robustness. All failed methods and unavailable dependencies remain in the denominator. The numerical values above, rather than an invented improvement claim, determine whether a method improved. Original Table2 convection NNCG3.63e-7 is an attributed paper value, not any result here. Current target failure is not compensated by truthful methodology. Author reference seconds and evaluator computation do not qualify effective candidate hours or statistical/professional maturity.

## Reproduction and evidence
Use the captured complete source/requirements, public inputs, run_study.py command and original native execution. A fresh output retrains; reading a supplied NPZ or redrawing these figures is only re-evaluation. The actual process/argv/environment appear in study-started, phase execution, attempts, recovery and caller-owned receipts. No Provider, credentials, real user process, UI or external service is involved. The present reference is not a scored fresh OpenCorvus/Codex candidate.
