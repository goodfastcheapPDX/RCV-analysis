## Current Task: Transfer Flow Matrix (Vote Transfers)

### Objective
Construct a comprehensive per-round transfer matrix and corresponding UI that visualizes how votes shift between candidates throughout the STV tabulation process.

### Data Slice
- **Input**: Existing `stv_rounds.parquet`, `stv_meta.parquet`, `ballots_long.parquet`
- **Contract**: Define Zod schema following existing patterns (IdentitySchema extension)
- **Process**:
  - For each round:
    - Identify eliminated/elected status from `stv_meta.parquet`
    - Compute vote transfers from each source candidate to each recipient (including exhausted)
    - Capture transfer reason metadata (elimination vs winner surplus)
  - Output: `transfer_matrix.parquet` with columns like:
    - `round`, `from_candidate_id`, `to_candidate_id`, `vote_count`, `transfer_reason`
- **Integration**: Add compute function to `scripts/build-all-districts.ts` after STV rounds

### Validation Strategy
- **Golden Dataset**: Build concrete test cases with known transfer patterns
- **Cross-validation**: Compare against manual STV calculations where possible
- **Structural Validation**: Ensure vote conservation (transfers sum correctly)
- **Edge Cases**: Handle exhausted votes, ties, surplus distributions

### UI Implementation
- **Framework**: Recharts with shadcn support
- **Sankey Diagram**: Use Recharts Sankey for round-to-round flow visualization
- **Matrix View**: Color-coded transfer counts with hover details
- **Integration**: Extend existing round stepper UI patterns

### UX Considerations
- Hover tooltips showing transfer counts and percentages
- Optional filtering for small-volume transfers (< threshold)
- Clear visual treatment of exhausted votes
- Performance optimization for large datasets

### Why This?
- Bridges backend round data to intuitive visual storytelling.
- Aligns with planned roadmap—fills a crucial analytic gap.
- Enhances transparency and trust through clarity.

### Timeline Estimate
- Backend + validation: 1–2 weeks.
- UI: 1–2 weeks (depending on tooling and complexity).
- Total: ~2–4 weeks.

