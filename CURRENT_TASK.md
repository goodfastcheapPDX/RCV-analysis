Title: Round-stepper Chord Chart (per-round transfer emphasis)

Context:
- We have transfer_matrix per round in data/dev/portland-20241105-gen/d2-3seat/transfer_matrix/transfer_matrix.parquet
- We have stv_rounds data in data/dev/portland-20241105-gen/d2-3seat/stv/
- Goal: for each round, highlight transfer SOURCES and show directed flows to many recipients; node size = current stock.

Scope:
1) Page location: Add to src/app/e/[electionId]/c/[contestId]/ as new route
2) Data loading: Mirror existing patterns, use loader function + parquet->duckdb, create API route if needed
3) Data transformation in page component: Build chord chart data from transfer_matrix + stv_rounds:
   - Transform to nivo chord format (square matrix)
   - Include Exhausted as regular node in circle (like a candidate)
   - Support two matrix modes via toggle:
     * "All Candidates": Static N×N matrix (consistent positions, eliminated candidates as thin arcs)
     * "Active Only": Dynamic matrix per round (only active candidates + exhausted)
   - Test matrix transformation logic carefully for both modes
4) Component <RoundChordChart>:
   - implement using https://nivo.rocks/chord/
   - Use nivo interactivity APIs for source highlighting:
     * activeArcOpacity/inactiveArcOpacity for arc emphasis
     * activeRibbonOpacity/inactiveRibbonOpacity for ribbon emphasis
     * onArcMouseEnter/onArcClick for interaction handling

```tsx
// example code from the docs
import { ResponsiveChord } from '@nivo/chord'

const MyChord = ({ data /* see data tab */ }) => (
    <ResponsiveChord /* or Chord for fixed dimensions */
        data={data}
        keys={['John', 'Raoul', 'Jane', 'Marcel', 'Ibrahim']}
        margin={{ top: 60, right: 60, bottom: 90, left: 60 }}
        padAngle={0.06}
        activeArcOpacity={1}
        inactiveArcOpacity={0.15}
        activeRibbonOpacity={0.85}
        inactiveRibbonOpacity={0.15}
        legends={[
            {
                anchor: 'bottom',
                direction: 'row',
                translateY: 70,
                itemWidth: 80,
                itemHeight: 16,
                symbolShape: 'circle'
            }
        ]}
    />
)
```

   - Node arc size ∝ stock.
   - Highlight sources for selected round; dim others using opacity settings.
   - Custom round stepper + min-flow threshold slider (default 0.25, like sankey) + counts/% toggle + matrix mode toggle ("All Candidates" / "Active Only").
   - Reference existing STV round stepper patterns.
   - Responsive: shrink to fit even if illegible on small screens
5) Implementation phases:
   - Phase 1: Basic chord chart with static data (one round)
   - Phase 2: Add round navigation
   - Phase 3: Add threshold filtering and source highlighting

Guardrails:
- No changes to compute pipeline contracts; view-layer transform only.
- Performance: address when it becomes a problem, not preemptively.
- Visual clarity: pack candidates in, accept some clutter for comprehensive view.

Done When:
- Phase 1-3 complete with working chord chart showing per-round transfers
- Sources are visually emphasized; ribbons match round totals; node sizes match stocks.
- Invariants pass: conservation per round and edge sums match transfer totals.