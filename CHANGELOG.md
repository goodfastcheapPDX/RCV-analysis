# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **rank_distribution_by_candidate slice (v1.0.0)** - New analysis slice that produces candidate×rank distribution data
  - Outputs count and percentage metrics for how often each candidate appears at each rank position
  - Generates dense grid ensuring all candidates appear for every rank (1..max_rank) with zero-count rows for consistency
  - Includes two normalized percentages: `pct_all_ballots` (count/total_ballots) and `pct_among_rankers` (count/ballots_that_ranked_candidate)
  - Contract-first implementation with mandatory runtime validation via Zod schemas
  - Comprehensive test suite with golden micro dataset and mathematical invariants
  - Supports static-first architecture with one artifact per contest for efficient predicate pushdown