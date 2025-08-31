# Ranked Elections Analyzer

A comprehensive analysis platform for ranked-choice voting elections, featuring Single Transferable Vote (STV) tabulation, coalition analysis, and interactive visualizations.

## Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## URL Structure

The application now uses contest-scoped URLs for real election data:

- **Election Overview**: `/e/{electionId}` - Lists all contests in an election
- **STV Analysis**: `/e/{electionId}/c/{contestId}` - Interactive STV rounds visualization  
- **First Choice**: `/e/{electionId}/c/{contestId}/first-choice` - First choice vote breakdown

Example URLs:
- `/e/portland-20241105-gen` - Portland 2024 General Election overview
- `/e/portland-20241105-gen/c/d2-3seat` - District 2 STV analysis
- `/e/portland-20241105-gen/c/d2-3seat/first-choice` - District 2 first choice breakdown

## Component Development

Storybook remains available for component-level development and testing:

```bash
npm run storybook
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.
