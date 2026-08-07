# TradingView World Economy Frontend Replica Benchmark

Build a maintainable frontend replica of the public anonymous page:

https://www.tradingview.com/markets/world-economy/

Use OpenCorvus frontend-research and frontend-design as sibling inputs before requirements and architecture. The generated project must prioritize extracted source materials over hand-written visual approximation. Do not implement a generic TradingView-like page from memory.

Acceptance target:

- Functional fidelity must be at least 95% for the visible anonymous-page workflows and information architecture.
- Visual fidelity must be at least 95% against the supplied reference screenshot, including layout, spacing, typography, colors, borders, tables, charts/maps, navigation, footer, and responsive behavior.
- The implementation must be human-readable and maintainable: semantic components, typed data modules, and scoped styles. It must not be a screenshot replay, iframe wrapper, hidden coverage layer, or copied private bundle execution.
- Use extracted assets, text, class/style evidence, map/SVG/table data, and source-region contracts wherever available.
- Replace any generated raw page regions with actual semantic components when possible, while preserving the extracted visual source as the evidence base.

Functional surface to preserve:

- Top TradingView navigation/header and page chrome in anonymous state.
- Breadcrumbs and page title for Markets / World Economy.
- World economy tab/navigation structure and selected overview content.
- Economic trend surfaces: map/chart-like visual regions, country/economy tables, metric cards, calendar/news/FAQ-style sections that are visible on the source page.
- Footer navigation, legal/provider text, and dense link groups.
- Basic interactions: navigation links render as links, tabs/buttons have visible hover/focus states, scroll layout is stable, and responsive desktop/tablet/mobile layouts remain coherent.

Verification requirements:

- Run the project build/typecheck/test commands.
- Run visual comparison against the benchmark reference screenshot.
- Treat any visual score below 0.95 or any missing visible source section as a failed acceptance that must be repaired before acceptance.
