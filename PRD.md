# Ranked-Choice Voting Analysis Platform - Product Requirements Document

## Vision
Build a comprehensive web application for analyzing ranked-choice voting elections using a static-first architecture. The platform will transform raw election data (CSV) into rich interactive visualizations that help users understand voting patterns, candidate relationships, and election outcomes.

## Problem Statement
Ranked-choice voting (RCV) elections generate complex data that's difficult to analyze without specialized tools. Stakeholders need:
- Clear understanding of how votes transfer between candidates
- Insights into voter coalition patterns 
- Validation of official election results
- Educational tools to explain RCV mechanics

## Solution Approach: CSV → Static JSON → Interactive Frontend

### Core Architecture Philosophy
1. **Static-First Pipeline**: Pre-process all election data into optimized JSON files
2. **Vertical Slice Development**: Build complete features (data + UI) one at a time
3. **Domain Learning Through Visualization**: Use frontend interactions to validate algorithms
4. **Performance Through Pre-computation**: Sub-100ms page loads via static data

## Product Features (Vertical Slices)

### Slice 1: Election Dashboard
**Purpose**: High-level election overview and results validation
**User Value**: Quick understanding of election outcomes
**Data Requirements**:
- Winner information with vote counts
- Total ballots processed
- Key election statistics
- First-choice preference breakdown

### Slice 2: Vote Transfer Visualization  
**Purpose**: Interactive STV round-by-round progression
**User Value**: Understanding how votes flow between candidates
**Data Requirements**:
- Round-by-round vote totals
- Transfer patterns between candidates
- Elimination/winner determination logic
- Ballot journey tracking

### Slice 3: Coalition Analysis
**Purpose**: Candidate relationship mapping and voter behavior patterns
**User Value**: Insights into political alliances and voter preferences
**Data Requirements**:
- Candidate-pair affinity scores
- Network centrality metrics
- Coalition strength calculations
- Transfer prediction models

### Slice 4: Candidate Deep Dive
**Purpose**: Individual candidate analytics and supporter profiling
**User Value**: Comprehensive candidate performance analysis
**Data Requirements**:
- Individual candidate vote progression
- Supporter demographic patterns
- Transfer efficiency metrics
- Similarity matching with other candidates

### Slice 5: Ballot Explorer
**Purpose**: Individual ballot analysis and pattern discovery
**User Value**: Understanding voter behavior at the ballot level
**Data Requirements**:
- Individual ballot progression through rounds
- Ballot completion patterns
- Ranking distribution analysis
- Ballot clustering algorithms

## Technical Architecture

### Data Processing Pipeline (TypeScript)
```
Raw CSV → Parse & Normalize → Mathematical Analysis → Static JSON Export
```

**Components Needed**:
- CVR (Cast Vote Record) parser
- STV (Single Transferable Vote) tabulation engine
- Coalition analysis algorithms
- Statistical computation modules
- JSON serialization system

### Frontend Application (Next.js)
```
Static JSON → Server Components → Interactive Client Components → User Interface
```

**Technology Stack**:
- Next.js 14+ with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- D3.js for network visualizations
- Plotly.js for statistical charts
- Framer Motion for interactions

### Static Data Structure
```
/data/processed/
├── election-summary.json       # Dashboard data
├── stv-tabulation.json        # Round-by-round results
├── vote-transfers.json        # Transfer flow data
├── coalition-network.json     # Candidate relationships
├── candidates/
│   ├── [id]/profile.json     # Individual candidate data
│   └── enhanced-list.json    # All candidates with metrics
└── ballots/
    ├── patterns.json         # Voting behavior analysis
    └── journeys.json         # Individual ballot tracking
```

## Domain-Specific Mathematical Requirements

### STV Algorithm Implementation
- **Droop Quota Calculation**: `floor(votes/(seats+1)) + 1`
- **Vote Transfer Logic**: Surplus redistribution with fractional weights
- **Elimination Strategy**: Lowest vote total candidates removed first
- **Winner Determination**: Candidates reaching quota threshold

### Coalition Analysis Mathematics
- **Affinity Scoring**: Jaccard similarity with proximity weighting
- **Network Centrality**: Degree, betweenness, and eigenvector centrality
- **Transfer Prediction**: Historical pattern-based modeling
- **Coalition Strength**: Multi-factor weighted scoring system

### Statistical Computations
- **Ballot Completion Analysis**: Ranking depth distribution
- **Preference Correlation**: Candidate co-occurrence patterns
- **Voter Segmentation**: K-means clustering on preference vectors
- **Transfer Efficiency**: Actual vs predicted transfer rates

## Development Strategy: Vertical Slice Approach

### Why Vertical Slices?
- **Domain Learning**: Each complete feature validates election math understanding
- **Rapid Feedback**: Working UI reveals algorithm correctness immediately  
- **Risk Mitigation**: Complex election math validated through visual interaction
- **Incremental Value**: Each slice delivers standalone user value

### Slice Development Process
1. **Mathematical Research**: Understand the election theory
2. **Algorithm Implementation**: Build computational logic in TypeScript
3. **Data Generation**: Create static JSON for the feature
4. **Frontend Development**: Build interactive visualization
5. **Domain Validation**: Verify results match election theory expectations

### Success Criteria Per Slice
- **Dashboard**: Official winners correctly identified
- **Vote Transfers**: Transfer patterns match manual calculation samples
- **Coalition**: Network metrics align with political intuition
- **Candidates**: Individual analytics tell coherent candidate stories
- **Ballots**: Pattern analysis reveals meaningful voter behaviors

### Validation and Testing Approaches
🔍 **Location**: `/tests/golden/micro/`
- Hand-computed micro-election datasets
- Mathematical invariant validation
- Algorithm correctness verification
- Regression testing methodology

## Success Metrics

### Technical Performance
- Page load times under 100ms with static JSON
- Full TypeScript type coverage for election data
- Mobile-responsive visualizations

### Domain Accuracy
- Election winners match official results (100% accuracy)
- Transfer calculations align with manual verification
- Coalition metrics produce politically sensible results
- Statistical computations validated against known datasets

### User Experience
- Intuitive navigation between analysis views
- Clear explanations of RCV mechanics
- Interactive exploration capabilities
- Educational value for non-experts

This PRD establishes a foundation for building a comprehensive RCV analysis platform from scratch, while identifying specific code and strategies to cannibalize from the existing implementation.