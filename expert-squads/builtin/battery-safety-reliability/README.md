# Battery Safety Reliability

This package prepares traceable battery safety and reliability evidence for qualified review. Independent roots reconcile cell/module/pack configuration and intended envelope, reconstruct already-authorized historical abuse and thermal-runaway evidence, and analyze comparable failure populations before a review owner joins the record.

It is distinct from automotive functional safety, energy/utility planning, aircraft maintenance reliability, chemical process safety, generic manufacturing quality and semiconductor yield. It specializes in electrochemical battery identity, state of charge/state of health, test context, thermal events, propagation/barriers and reliability evidence without operating a battery or test facility.

Every scheduler and worker uses only `battery-safety-reliability/shared/method`. Five assets preserve configuration, source/version/date, sample and instrumentation identity, units, clocks, operating/test context, population and censoring, assumptions, uncertainty, owner, qualified reviewer, applicability, status, decision-not-made and stop/escalation.

No output provides live charge, discharge, short-circuit, heating, crushing, penetration or fire instructions; changes BMS/protection settings; handles a damaged battery; directs emergency or transport action; certifies, releases or claims safety. Those decisions remain with qualified battery, electrochemical, electrical, thermal, mechanical, fire, reliability, test, hazardous-goods, certification and application authorities.
