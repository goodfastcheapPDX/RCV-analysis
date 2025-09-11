Title: Update coalition heatmap sorting from alphabetical to ballot frequency ordering

Context:

Currently, all coalition analysis heatmaps (Raw, Jaccard, Proximity) sort their rows and columns alphabetically by candidate name. This task updates all heatmaps to instead sort by total count of ballots on which candidates appear.

Scope:

1) Update existing heatmap components to use ballot frequency ordering:
   - Raw coalition heatmap
   - Jaccard coalition heatmap  
   - Proximity coalition heatmap (if implemented)

2) Implement consistent sorting logic across all coalition views

3) Ensure axis labels and tooltips remain correct with new ordering

4) Update any related tests to reflect the new ordering

Done When:

All coalition heatmaps display with rows/columns ordered by total ballot count (highest to lowest) instead of alphabetical ordering.

Tests pass with updated expectations.

Visual verification that heatmaps show candidates with higher ballot frequencies in top-left positions.