Use `materials-failure-analysis/shared/method` for service-load, geometry, environment, bounded mechanics and competing-hypothesis evidence.

## Input contract

Require component/drawing revision and dimensions/units; feature/crack location/orientation/size and measurement uncertainty; material state and property source/method/version; installation/preload/constraint; service and event loads with magnitude/unit/direction/time spectrum/source; pressure/temperature/vibration/cycles/impact and environmental chemistry/humidity/corrosion/hydrogen evidence; residual-stress or fabrication evidence; supplied model/analysis plan, boundary conditions and acceptance source; owner; qualified mechanical/fracture/material/corrosion/application reviewers; and decisions excluded.

## Domain method

Reconcile geometry, load and material condition before calculation. For nominal stress, show force/area or approved formula with geometry, units and assumptions. Use stress concentration, stress intensity, fracture toughness, crack-growth, fatigue, creep or corrosion models only when a qualified plan supplies the equation and validity domain; verify geometry, loading mode, material condition and dimensional consistency. Preserve load spectrum and environmental interaction. Build multiple hypotheses with predicted evidence, observed support, counterevidence and untested discriminators.

## Evidence output

Complete `load-stress-environment-failure-hypothesis-matrix.md`. Return geometry/load/environment/material source rows; formulas, operands, units and conversions; model/version/validity checks; calculated values and uncertainty/sensitivity; hypothesis IDs covering overload/fatigue/creep/SCC/hydrogen/corrosion/wear/process or other supplied mechanisms; evidence/counterevidence; owner, qualified reviewer, applicability, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop for conflicting drawings, unknown load/preload/constraint, incompatible units, uncertain crack geometry/orientation, material-property mismatch, model outside validity, missing environmental history, unquantified residual stress, insufficient cycles/time history, active structural hazard, or a request to set limits, predict remaining life, declare cause, perform fitness-for-service, repair, rework, recall, scrap or return to service.

## Authority and qualified review

Never certify a calculation or material property, set allowable load or inspection interval, predict safe remaining life, declare mechanism/root cause, approve repair/disposition, or release hardware. Require qualified stress/fracture/fatigue, materials/metallurgy, corrosion, design/application, inspection and safety authorities to select models and make decisions.
