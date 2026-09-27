# Run 02: first-block early stop with one unscored arm

## Recall and original outcome

User request: “重试四次臂bench”. [Run 02 registration](run-02-registration.json) fixed the original ten cases × TS/TE/MS/ME, `openai/gpt-5.6-luna`, independent worlds, static `.10` / one author-produced but pending-acceptance `.11`, the official scorer and existing full-block early stops. Source `8c7bc21c549ba6328dd5877cdec9c36237e894b7` was committed and pushed before launch. The sole fresh root is `.tmp/inspect-factorial-retry-20260928/run-02`; its controller was verified at PID 56712 with its full command line and creation time. All four real preflights reported usable authorization, Luna projected and actual streamed `gpt-5.6-luna`.

The original `matrix.json` ended `stopped_for_unscored`, `early_stop={kind:unscored,block:1,arms:[TE]}`. Only the first case, `hr.candidate_submittal_docs`/5034, ran. The controller's launcher exited 0 after that registered stop; it did not start blocks 2–10. The first-block original `.eval` files independently confirm these strict/partial scores:

| Case/block | TS, Task static | TE, Task evolved | MS, Mission static | ME, Mission evolved |
| --- | --- | --- | --- | --- |
| 1: HR candidate submissions / 5034 | 0 / 0 | null / null (Task no-activity timeout) | 0 / 0.5 | 0 / 0 |
| 2–10: remaining fixed cases | not started | not started | not started | not started |

The denominator is one scored TS, zero scored TE, one scored MS and one scored ME out of ten planned per arm. There is no complete Task evolution pair, Mission effect or four-arm interaction estimate. The one scored Mission evolution pair has partial `0 − 0.5 = −0.5`, strictly descriptive for this case; no ten-case average or improvement claim follows. Null remains null and is never folded into a zero or filled from a prior run.

The native-versus-official strict confusion matrix treats completed/accepted as a predicted success, failed/blocked as a predicted failure, and omits the unscored arm from all four cells:

| Arm | TP | FP | FN | TN | Unscored | Unstarted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TS | 0 | 0 | 0 | 1 | 0 | 9 |
| TE | 0 | 0 | 0 | 0 | 1 | 9 |
| MS | 0 | 0 | 0 | 1 | 0 | 9 |
| ME | 0 | 0 | 0 | 1 | 0 | 9 |

TS was natively `failed`; MS and ME natively `blocked`. TE's Inspect observation is `OpenCorvusTaskTimeout` with no official score. Its last business Tool request was a real `question` asking an operator to connect/authenticate the Meridian Recruitee OAuth account needed for direct portal submissions. The simulated environment reported that connection absent and the offers lookup returned HTTP 401. No operator decision or connection arrived in the sealed benchmark; after 300 seconds of actual inactivity, the adapter retained the timeout. The later `manage_task.fail_task` belongs to owned-activity cleanup and does not retroactively turn TE into a scored sample. This is the observed chain, not proof of a general scheduler defect or model improvement failure.

## Request, usage and cleanup evidence

| Arm | Streamed Luna HTTP 200 requests | Persisted usage rows | Recorded tokens | Native Tool requests | Official business events | Episode seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TS | 74 | 74 | 3,265,535 | 67 | 34 | 551.135 |
| TE | 79 | 79 | 4,031,860 | 72 | 36 | 941.997 |
| MS | 127 | 126 | 5,617,421 | 116 | 71 | 1,470.478 |
| ME | 98 | 98 | 3,860,273 | 90 | 49 | 731.752 |
| **Run 02** | **378** | **377** | **16,775,089** | **345** | **190** | **3,695.362 summed** |

The 377 native `provider_usage_event` rows are all `openai/gpt-5.6-luna` with billing status `priced`. Their token components sum to input 2,572,335; output 64,838; reasoning 16,188; cache read 14,121,728; cache write 0. The 127th MS HTTP 200 request lacks a matching persisted usage row; its tokens and external billing are unknown, not zero. Local `cost_usd=0` is not an invoice. The controller launched four hosts concurrently, so summed episode seconds are not wall-clock duration.

Separate sealed run 01 consumed eight streamed Luna HTTP 200 preflights, with eight persisted usage rows totaling 116,772 tokens (input 116,220; output 255; reasoning 297). Across both attempts there were **386 real HTTP 200 requests** and **385 persisted usage rows totaling 16,891,861 tokens**; the one missing row remains unknown. Both attempts' official worlds, original scores, errors and request audits are retained independently.

All four run-02 Host and closure receipts say `stopped`, each cleanup receipt has `active_after_cleanup=[]`, and direct file checks found no copied `auth.json` or `models.json` in any arm. The launcher reported exit 0 with a completed wait for its controller; the matrix terminal is the early stop, not forty completed episodes. There was no Provider model substitution, source drift, scorer edit or manual repair to any evaluated world. This attempt does not establish reliable business correction or evolution gain.
