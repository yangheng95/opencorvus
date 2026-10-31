# Actual figure visual review

All six final PNGs were opened and visually inspected through the image-view tool after the nine native numerical runs finished. These are the final class-block operating figures and actual three-method comparisons, rather than promised plots or source-only string checks.

- comparison.png: all three methods and fleets, untruncated objective values, native bound marks and their scope label are visible. The 0.01 single-class difference is retained in the report even though rounded bar labels agree.
- convergence.png: actual native incumbent steps and logarithmic objective scale are legible; no invented interpolation is present. One-second SCIP event-clock granularity and high-resolution timing records are explained in the report.
- economics.png: sailing, return, initial fees and inventory penalties are visibly separated. Small negative terminal adjustments remain in the CSVs and are explicitly excluded from the positive stack.
- inventory.png: all 360/360/480 port-period trajectories are represented, with storage capacities, service points and priced alpha. Labels and axes are visible; unused fourth-port panels for the two three-port inputs are intentionally empty.
- class-service.png: actual class/port physical quantities are readable. Text color is selected from the actual background luminance; each panel starts its color scale at zero. Terminal service is named explicitly.
- paths.png: all 16 anonymous paths of the final three-class plan are visible, with initial sources, waiting, full loaded voyages, empty returns and terminal markers. Route labels, model-time axis and legend are legible.

Initial visual review caught UTF-8 separators/arrows rendered as mojibake and white heatmap numbers with insufficient contrast. Figure source was corrected to plain ASCII separators/arrows and luminance-based text colors. The final images were regenerated from the completed experiment data and viewed again. No UI automation tests, screenshot baselines or pixel-difference gates were created or run. Image decoding alone was not treated as visual review.
