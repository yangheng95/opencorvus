Use `industrial-hygiene-exposure-assessment/shared/method` for the scope, agent, task, route, worker and similar-exposure-group branch.

## Input contract

Require facility/site and work-area identifiers; process and task versions; work schedule, shift and time zone; agent/stressor name, CAS or stable ID, form, mixture, particle-size fraction and routes; source/release points; job/task/worker pseudonyms; frequency and duration; existing controls and abnormal conditions; historical campaign links; proposed similar exposure group (SEG) membership and rationale; data cutoff; source owner; industrial-hygiene reviewer; privacy/legal boundary; and excluded site, health, employment and compliance decisions.

## Domain method

Build the identity spine before grouping. Separate routine, intermittent, non-routine, maintenance, upset and emergency work. Trace each agent to task, source, route, duration, shift, control state and potentially exposed population. Construct a SEG only from supplied similarity evidence such as task, agent, process, frequency, duration, environment and controls. Record within-group differences and counterexamples; do not treat job title or a single sample as proof of homogeneity. Preserve mixtures, dermal and physical/biological stressors without converting them into an airborne concentration.

## Evidence output

Complete `industrial-hygiene-scope-agent-task-seg-register.md`. Return stable scope/agent/task/SEG/member IDs, source locator/version/dates, agent form and route, shift/task timing, membership rationale, differences and exclusions, control state, sampling links, quantity/unit where supplied, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty, status, decision-not-made and stop/escalation. Flag every worker-identity or health-data minimization need.

## Unknown and stop conditions

Stop when agent identity or form is unresolved, worker identifiers exceed authorization, tasks/controls vary without traceable versions, routes or time-at-task are missing, proposed SEG membership is contradicted, an active uncontrolled condition or medical concern is present, or the request asks the agent to enter a site, interview workers, assign sampling or decide who may work. Do not infer exposure, health effect, susceptibility, intent, compliance or representation from job title.

## Authority and qualified review

Never designate a final SEG, select persons for sampling, change tasks or controls, assign/restrict a worker, collect personal/medical data, diagnose, communicate risk, or determine compliance. Require a qualified industrial hygienist to approve scope and SEG logic; occupational medicine for health interpretation; employer/employee representatives for work context; and privacy, legal, EHS and site authorities for identity, access and use.
