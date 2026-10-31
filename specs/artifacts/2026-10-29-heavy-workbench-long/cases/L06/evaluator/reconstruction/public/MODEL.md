# Mathematical and operating semantics

The supplied MPS gives all variables, domains, objective coefficients, row senses
and right-hand sides. Its complete deterministic minimization problem is the
single mathematical object. The raw data and model PDF explain its operations;
they are not a second hidden model.

Class flow includes fixed initial multi-vessel source injections, one-period
waiting arcs, time-feasible loading-to-discharge/return voyages, and artificial
terminal exit arcs. Initial source arcs pay the destination port fee. A terminal
exit arc performs the full class-capacity service at its origin, consumes a berth
there, and receives the stated terminal adjustment. It does not imply a real
future destination or demand delivered beyond the horizon.

Each port's inventory balance includes the signed production/consumption rate,
full cargo service of departures (including terminal exits), and signed alpha.
Inventories and berths obey the stated bounds. Alpha is allowed priced slack:
lost production at loading ports and shortfall at consumption ports. Do not add
an unprovided zero-shortage requirement or restrict alpha to full/empty storage.
A nonoptimal feasible plan can contain unnecessary slack; its presence is not
proof of unavoidable physical loss.

Economic cost includes voyage/return costs, initial port fees, discounted alpha
penalties and terminal adjustments. Do not apply one discount rule to every
coefficient or replace finite MPS costs with rounded displayed distances.

Class flow can be decomposed into anonymous paths. Any valid decomposition and
path IDs are accepted if all positive arc counts and initial vessels are covered,
steps join in class/port/time, and each path runs from a source to an exit.
Anonymous paths are not unique original named-vessel assignments.

Numerical feasibility uses absolute1e-6 for domains/integrality and per-row
1e-6+1e-9*abs(rhs); objective/ordinary operating reconciliation uses1e-6+1e-9*abs(expected).
Inventory residuals use1e-6+1e-9*abs(the original row rhs), the same row
feasibility rule. A numerical feasible plan is not an exact rational
optimality proof. LP relaxations, restricted-neighborhood bounds and their
optimal statuses must be distinguished from full integer-model certificates.
