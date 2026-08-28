# Provider explicit-refresh real-page request evidence

## Isolated runtime

- Page: `http://127.0.0.1:4791/ui/`
- Runtime root: a newly created temporary `OPENCORVUS_HOME`
- Project root: a newly created temporary Project below that runtime root
- User database, credentials, application process and existing windows: not used
- UI interaction: in-app browser control against the real development-mode `/ui` page; no UI automation test or browser fixture ran

## Providers-panel open interval

The server's canonical request log was sampled from the Providers chunk request through the instant before the first explicit refresh click. Provider/config-family request starts were:

| UTC time | Method | Path |
| --- | --- | --- |
| 2026-08-26T23:17:46.683Z | GET | `/provider` |
| 2026-08-26T23:17:46.698Z | GET | `/provider/auth` |

Refresh-writer count in that bounded interval: **0**. There was no `POST /provider/refresh`, `POST /provider/models/refresh`, global catalog refresh or global model refresh.

The settled real page rendered **3 configured / 88 catalog** Providers with separate **Refresh providers** and **Refresh models** actions. The pre-action screenshot is `2026-08-27-provider-explicit-refresh-real-ui.png`.

## One explicit catalog-refresh action

The visible **Refresh providers** button was clicked exactly once. Provider/config-family request starts after that click were:

| UTC time | Method | Path |
| --- | --- | --- |
| 2026-08-26T23:18:52.471Z | POST | `/provider/refresh` |
| 2026-08-26T23:18:52.996Z | GET | `/provider` |
| 2026-08-26T23:18:53.003Z | GET | `/provider/auth` |

The catalog writer completed with HTTP **200** in **510 ms**. Exact catalog-writer count: **1**; model-writer count: **0**. The stable projection then reloaded and the visible page settled at **3 configured / 204 catalog** with **Providers · just now**. The post-action screenshot is `2026-08-27-provider-explicit-refresh-settled-real-ui.png`.

## Composer model-selector open interval

After the independent caller audit exposed a second open-time writer, the corrected production build was run against a second fresh temporary runtime and Project on the same isolated port. The real Composer model selector was opened exactly once. Provider/config-family request starts after that operator action were:

| UTC time | Method | Path |
| --- | --- | --- |
| 2026-08-26T23:29:03.652Z | GET | `/provider` |
| 2026-08-26T23:29:03.657Z | GET | `/provider/auth` |

Refresh-writer count in that bounded interval: **0**; stable-read count: **2**. There was no catalog writer and no live-model writer. The real popover displayed the current connected Provider groups, searchable model rows and the **Configure Provider…** action. Its screenshot is `2026-08-27-composer-model-selector-stable-read-real-ui.png`.

## Manual visual review

The two Providers screenshots show the real settings shell, selected Providers navigation item, Provider counts, independent refresh actions, Add action, search field and catalog rows. The Composer screenshot shows the real model selector anchored to the Composer, focused search field, bounded model list and configuration action. The content is readable and aligned, button labels are complete, and no clipping, overlap or unexpected transient refresh state is visible.
