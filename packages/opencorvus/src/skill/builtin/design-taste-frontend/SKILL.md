---
name: design-taste-frontend
description: Apply context-aware visual judgment to frontend product design and redesign work. Infer the design language from the accepted brief and evidence, use mature design systems, avoid generic generated-interface patterns, and finish through real rendered-page inspection.
---

# Design Taste for Frontend

Use this Skill to improve the visual judgment of a frontend design or redesign while preserving the active Task contract. It is an OpenCorvus adaptation of Leonxlnx's Taste Skill.

The accepted Product Requirements, active Expert Squad instructions, design-system authority, evidence, target platform, and explicit user constraints remain authoritative. This Skill refines design decisions inside those boundaries. It does not invent product scope, override a referenced design system, turn inspiration into parity authority, or broaden a desktop task into mobile delivery.

## 1. Read the design situation

Before producing markup, styles, or components, derive a short design read from current evidence:

- product or page job;
- primary audience and their decision context;
- information density and interaction complexity;
- existing brand, token, component, and asset authority;
- explicit visual references and what each reference is allowed to influence;
- accessibility, performance, regulatory, and platform constraints;
- greenfield, preserve-redesign, overhaul-redesign, or reference-parity mode as declared by the active Task.

State the design read in one concise sentence. If two materially different design directions remain equally plausible and the missing choice cannot be recovered from Task evidence, ask one focused question. Otherwise proceed.

For redesigns, first inventory the existing information architecture, navigation, conversion or work paths, content blocks, tokens, typography, spacing, component patterns, interaction states, accessibility behavior, and performance-sensitive surfaces. Preserve accepted structure and identity unless the Task explicitly replaces them.

## 2. Set the three contextual dials

Record three values on a one-to-ten scale for this delivery:

- `DESIGN_VARIANCE`: compositional experimentation and asymmetry;
- `MOTION_INTENSITY`: the amount and depth of purposeful motion;
- `VISUAL_DENSITY`: information and control density per viewport.

Infer the values from the design read rather than using a universal baseline. A financial workstation can require high density and restrained variance; an editorial campaign can require lower density and more expressive composition. The values describe a decision, not configuration that overrides the accepted design system.

Use the dials consistently across every surface in scope. Shared navigation, typography, color, spacing, radius, elevation, iconography, motion, and state treatment must form one system.

## 3. Choose the real foundation

Inspect the repository and accepted design authority before choosing implementation primitives.

- Reuse the product's current component library and tokens when they are authoritative.
- When the Task names a mature design system, use its official maintained package and primitives.
- When no system is prescribed, choose one maintained component foundation compatible with the existing stack and customize it through a coherent token layer.
- Verify dependencies in the repository before importing them.
- Keep one icon family and one component-system authority per delivery.
- Do not redraw standard controls, icons, focus behavior, dialogs, menus, or form primitives when the selected library already owns them.

Framework, styling, rendering, data, and state decisions come from the repository. This Skill does not force React, Next.js, Tailwind, a particular animation library, dark mode, or responsive scope.

## 4. Build a recognizable composition

Create hierarchy through proportion, alignment, grouping, contrast, rhythm, and negative space before adding decoration.

### Typography

- Give each surface one obvious primary reading path.
- Keep display text within a deliberate measure and line count appropriate to its role.
- Use an intentional type scale, line height, and weight system; inspect descenders, truncation, wrapping, and numeric alignment in the rendered result.
- Preserve brand typography when it is authoritative. Otherwise select type for audience, content density, language coverage, and legibility rather than novelty.
- Use emphasis within the same family unless the design language has a justified pairing.

### Color and material

- Derive color from brand or design-system authority. When no authority exists, choose one coherent neutral family and one purposeful accent relationship.
- Keep semantic colors stable across surfaces and states.
- Use elevation, borders, cards, translucency, gradients, and texture only when they communicate hierarchy or product meaning.
- Verify text, controls, focus indicators, charts, form states, and overlays against the real background.

### Layout and density

- Vary composition according to information meaning, not to manufacture novelty.
- Do not repeat the same card grid, split section, centered heading, eyebrow label, or left-right alternation across the entire experience.
- Use containers only when they express grouping or elevation. Prefer alignment, separators, and spacing when those carry the hierarchy.
- Dense products still need grouping and scan paths; spacious products still need enough evidence and imagery to feel complete.
- Size navigation, controls, tables, charts, and empty/loading/error states for their real content rather than demo copy.
- Keep desktop navigation and primary actions stable, legible, and unclipped at the accepted viewport.

### Content and assets

- Use approved real assets and actual product content available through Task evidence.
- Match asset aspect ratio, crop, resolution, and visual treatment to its exact region.
- Do not substitute generic company names, fake metrics, fabricated testimonials, decorative fake screenshots, or unlabeled placeholder blocks for required evidence.
- When required assets or content are unavailable, record the exact blocker instead of manufacturing a substitute.

## 5. Design complete interaction states

Every interactive component in scope needs a coherent normal, hover, active, focus, disabled, loading, empty, success, and error treatment when that state exists in the product contract.

- Keep labels stable for the same action across navigation, page content, dialogs, and footers.
- Keep primary actions visually dominant without duplicating the same intent.
- Place form labels, help, validation, and errors where users can associate them with the owning control.
- Preserve keyboard order, visible focus, semantic structure, and accessible names.
- Make charts, status colors, and icon-only actions understandable without relying on color alone.
- Keep state feedback adjacent to the action or data it describes.

## 6. Use motion with purpose

Motion must explain hierarchy, continuity, causality, progress, or spatial change.

- Match motion depth to `MOTION_INTENSITY` and the product context.
- Prefer compositor-friendly transform and opacity changes.
- Use the repository's established motion solution and clean up every listener, timeline, observer, and animation context.
- Keep continuous pointer or scroll values outside render-state update loops.
- Respect reduced-motion preferences and preserve the same information and actions in the reduced experience.
- Avoid perpetual decoration, competing animation systems, scroll hijacking without a product reason, and motion that delays primary work.

## 7. Remove generated-interface tells

Challenge any result that could have been produced from a generic template without reading the Task:

- default purple glow or mesh used without brand authority;
- a centered headline followed by equal cards on every surface;
- repeated small uppercase labels above every heading;
- arbitrary pills, glass panels, gradients, or shadows used as decoration;
- empty bento cells or filler regions created to complete a pattern;
- identical section composition repeated with different copy;
- oversized headings that destroy information density or push primary actions below the accepted viewport;
- random type-family changes, mixed radius systems, mixed icon families, or drifting accent colors;
- static success-only mockups without real product states;
- dense interfaces reduced to disconnected marketing cards.

Do not replace one cliché with another. Every correction must trace to audience, content, product behavior, design authority, or visible evidence.

## 8. Rendered pre-flight review

The design is unfinished until it has been opened as a real page at the Task's accepted desktop viewport and personally inspected.

1. Render the actual current implementation or design source through the repository's real preview path.
2. Exercise the primary navigation and every material state in scope.
3. Capture fresh Task-scoped screenshots for the relevant surfaces and states.
4. Inspect hierarchy, density, alignment, spacing, wrapping, clipping, contrast, asset quality, control states, focus, scroll behavior, motion, and cross-surface consistency.
5. Compare the result with the accepted Product Requirements and design authority, using references only for the influence explicitly granted by the Task.
6. Fix every confirmed visual defect and repeat the real-page inspection with fresh evidence.

Completion requires a coherent product-specific system, real content and states, and current rendered evidence. A build, typecheck, static source review, or clean console is supporting evidence, not visual acceptance.
