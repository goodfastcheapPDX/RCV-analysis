import type { Meta, StoryObj } from "@storybook/react";
import { selectCandidateRankDistribution } from "@/lib/slices/rankDistribution";
import { createOutputFixture } from "@/packages/contracts/slices/rank_distribution_by_candidate/index.contract";
import { RankDistributionCard } from "./RankDistributionCard";

const meta = {
  title: "Candidate/RankDistributionCard",
  component: RankDistributionCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    candidateName: {
      control: "text",
      description: "Name of the candidate",
    },
    candidateId: {
      control: "number",
      description: "ID of the candidate",
    },
    loading: {
      control: "boolean",
      description: "Loading state",
    },
    error: {
      control: "text",
      description: "Error message",
    },
  },
} satisfies Meta<typeof RankDistributionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Create realistic rank distribution data for testing
const createMockRankData = (
  candidateId: number,
  pattern: "HappyPath" | "ZeroRank" | "Sparse" | "SkewHead" | "SkewTail",
) => {
  const baseData = Array.from({ length: 6 }, (_, i) =>
    createOutputFixture({
      candidate_id: candidateId,
      rank_position: i + 1,
      count: 0,
      pct_all_ballots: 0,
      pct_among_rankers: 0,
    }),
  );

  switch (pattern) {
    case "HappyPath":
      // Realistic distribution with highest at rank 1, tapering off
      return [
        {
          ...baseData[0],
          count: 1250,
          pct_all_ballots: 0.35,
          pct_among_rankers: 0.42,
        },
        {
          ...baseData[1],
          count: 890,
          pct_all_ballots: 0.25,
          pct_among_rankers: 0.3,
        },
        {
          ...baseData[2],
          count: 534,
          pct_all_ballots: 0.15,
          pct_among_rankers: 0.18,
        },
        {
          ...baseData[3],
          count: 178,
          pct_all_ballots: 0.05,
          pct_among_rankers: 0.06,
        },
        {
          ...baseData[4],
          count: 89,
          pct_all_ballots: 0.025,
          pct_among_rankers: 0.03,
        },
        {
          ...baseData[5],
          count: 36,
          pct_all_ballots: 0.01,
          pct_among_rankers: 0.01,
        },
      ];

    case "ZeroRank":
      // All zeros - candidate never ranked
      return baseData;

    case "Sparse":
      // Only ranks 1, 3, 5 have data
      return [
        {
          ...baseData[0],
          count: 450,
          pct_all_ballots: 0.18,
          pct_among_rankers: 0.55,
        },
        { ...baseData[1], count: 0, pct_all_ballots: 0, pct_among_rankers: 0 },
        {
          ...baseData[2],
          count: 268,
          pct_all_ballots: 0.11,
          pct_among_rankers: 0.33,
        },
        { ...baseData[3], count: 0, pct_all_ballots: 0, pct_among_rankers: 0 },
        {
          ...baseData[4],
          count: 98,
          pct_all_ballots: 0.04,
          pct_among_rankers: 0.12,
        },
        { ...baseData[5], count: 0, pct_all_ballots: 0, pct_among_rankers: 0 },
      ];

    case "SkewHead":
      // Heavy concentration at rank 1
      return [
        {
          ...baseData[0],
          count: 2100,
          pct_all_ballots: 0.7,
          pct_among_rankers: 0.85,
        },
        {
          ...baseData[1],
          count: 150,
          pct_all_ballots: 0.05,
          pct_among_rankers: 0.06,
        },
        {
          ...baseData[2],
          count: 100,
          pct_all_ballots: 0.033,
          pct_among_rankers: 0.04,
        },
        {
          ...baseData[3],
          count: 75,
          pct_all_ballots: 0.025,
          pct_among_rankers: 0.03,
        },
        {
          ...baseData[4],
          count: 35,
          pct_all_ballots: 0.012,
          pct_among_rankers: 0.014,
        },
        {
          ...baseData[5],
          count: 10,
          pct_all_ballots: 0.003,
          pct_among_rankers: 0.004,
        },
      ];

    case "SkewTail":
      // Higher ranks dominate (compromise candidate)
      return [
        {
          ...baseData[0],
          count: 89,
          pct_all_ballots: 0.03,
          pct_among_rankers: 0.05,
        },
        {
          ...baseData[1],
          count: 178,
          pct_all_ballots: 0.06,
          pct_among_rankers: 0.1,
        },
        {
          ...baseData[2],
          count: 534,
          pct_all_ballots: 0.18,
          pct_among_rankers: 0.3,
        },
        {
          ...baseData[3],
          count: 712,
          pct_all_ballots: 0.24,
          pct_among_rankers: 0.4,
        },
        {
          ...baseData[4],
          count: 178,
          pct_all_ballots: 0.06,
          pct_among_rankers: 0.1,
        },
        {
          ...baseData[5],
          count: 89,
          pct_all_ballots: 0.03,
          pct_among_rankers: 0.05,
        },
      ];

    default:
      return baseData;
  }
};

// Happy path story with realistic data
export const Default: Story = {
  args: {
    candidateName: "ALICE HARDESTY",
    candidateId: 1,
    data: selectCandidateRankDistribution(
      createMockRankData(1, "HappyPath"),
      1,
    ),
    loading: false,
  },
};

// Zero-rank candidate (never ranked)
export const ZeroRank: Story = {
  args: {
    candidateName: "UNRANKED CANDIDATE",
    candidateId: 99,
    data: selectCandidateRankDistribution(
      createMockRankData(99, "ZeroRank"),
      99,
    ),
    loading: false,
  },
};

// Sparse ranks (gaps in ranking positions)
export const SparseRanks: Story = {
  args: {
    candidateName: "CANDACE AVALOS",
    candidateId: 2,
    data: selectCandidateRankDistribution(createMockRankData(2, "Sparse"), 2),
    loading: false,
  },
};

// First-rank heavy distribution
export const SkewedHead: Story = {
  args: {
    candidateName: "OLIVIA CLARK",
    candidateId: 3,
    data: selectCandidateRankDistribution(createMockRankData(3, "SkewHead"), 3),
    loading: false,
  },
};

// Higher-rank dominated (compromise candidate)
export const SkewedTail: Story = {
  args: {
    candidateName: "STEVE NOVICK",
    candidateId: 4,
    data: selectCandidateRankDistribution(createMockRankData(4, "SkewTail"), 4),
    loading: false,
  },
};

// Toggle modes - initialize with "% among rankers" metric
export const ToggleModes: Story = {
  args: {
    candidateName: "TIFFANY KOYAMA LANE",
    candidateId: 5,
    data: selectCandidateRankDistribution(
      createMockRankData(5, "HappyPath"),
      5,
    ),
    loading: false,
  },
  play: async ({ canvasElement }) => {
    console.log(canvasElement);
    // Note: In a real implementation, this would simulate clicking the toggle
    // For now, users can manually test the toggle in Storybook
  },
};

// Loading state
export const Loading: Story = {
  args: {
    candidateName: "LOADING CANDIDATE",
    candidateId: 6,
    loading: true,
  },
};

// Error state
export const ErrorCandidate: Story = {
  args: {
    candidateName: "ERROR CANDIDATE",
    candidateId: 7,
    error:
      "Rank distribution artifact not available for contest portland-20241105-gen/d2-3seat",
    onRetry: () => {
      console.log("Retry clicked");
    },
  },
};

// Long candidate name
export const LongCandidateName: Story = {
  args: {
    candidateName: "ALICE MARIE HARDESTY-JOHNSON-WILLIAMSON",
    candidateId: 8,
    data: selectCandidateRankDistribution(
      createMockRankData(8, "HappyPath"),
      8,
    ),
    loading: false,
  },
};

// Single rank data (edge case)
export const SingleRank: Story = {
  args: {
    candidateName: "SINGLE RANK",
    candidateId: 9,
    data: [
      {
        rank: 1,
        count: 1500,
        pct_all_ballots: 0.5,
        pct_among_rankers: 1.0,
      },
    ],
    loading: false,
  },
};
