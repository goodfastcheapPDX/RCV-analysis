Title: Build visual representation for first_choice_breakdown data

Context:
- first_choice_breakdown slice already exists with validated data structure
- Need to create an interactive visualization that displays candidate first-choice vote counts and percentages
- Data shows first-choice preferences across all candidates in the election
- Visualization should help users understand which candidates had the most initial support
- Using shadcn/ui bar charts: https://ui.shadcn.com/charts/bar#charts

Scope:
1. Create view.tsx component in src/packages/contracts/slices/first_choice_breakdown/
   - Bar chart using shadcn/ui chart components
   - Show candidate names vs first-choice vote counts
   - Include percentage labels on bars
   - Sort candidates by vote count (descending)
   - Responsive design for mobile/desktop
2. Create Storybook story file first_choice_breakdown.story.tsx
   - Simple story showing the visualization
   - No Live vs Static comparison for now
   - Focus on demonstrating the chart functionality
3. Implement any missing view infrastructure if needed
4. Add basic styling consistent with project design patterns

Guardrails:
- Do not modify the existing contract or compute functionality
- Do not create new data processing logic - use existing validated output
- Keep visualization simple and focused on first-choice data only
- No edits outside the slice folder and Storybook registration

Done When:
- view.tsx renders a clear bar chart of first-choice breakdown data using shadcn/ui
- Storybook story displays the visualization 
- Chart is responsive and properly styled
- No console errors or TypeScript issues

Output:
- Functional React component displaying first-choice vote breakdown using shadcn/ui bar charts
- Storybook story demonstrating the visualization
- Clean, readable code following project conventions