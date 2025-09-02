import type { Meta, StoryObj } from "@storybook/react";
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
    data: {
      control: "object",
      description: "Array of rank distribution data",
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
    data: createMockRankData(1, "HappyPath"),
  },
};

// Zero-rank candidate (never ranked)
export const ZeroRank: Story = {
  args: {
    candidateName: "UNRANKED CANDIDATE",
    data: createMockRankData(99, "ZeroRank"),
  },
};

// Sparse ranks (gaps in ranking positions)
export const SparseRanks: Story = {
  args: {
    candidateName: "CANDACE AVALOS",
    data: createMockRankData(2, "Sparse"),
  },
};

// First-rank heavy distribution
export const SkewedHead: Story = {
  args: {
    candidateName: "OLIVIA CLARK",
    data: createMockRankData(3, "SkewHead"),
  },
};

// Higher-rank dominated (compromise candidate)
export const SkewedTail: Story = {
  args: {
    candidateName: "STEVE NOVICK",
    data: createMockRankData(4, "SkewTail"),
  },
};

// Toggle modes - initialize with "% among rankers" metric
export const ToggleModes: Story = {
  args: {
    candidateName: "TIFFANY KOYAMA LANE",
    data: createMockRankData(5, "HappyPath"),
  },
  play: async ({ canvasElement }) => {
    console.log(canvasElement);
    // Note: In a real implementation, this would simulate clicking the toggle
    // For now, users can manually test the toggle in Storybook
  },
};

// Long candidate name
export const LongCandidateName: Story = {
  args: {
    candidateName: "ALICE MARIE HARDESTY-JOHNSON-WILLIAMSON",
    data: createMockRankData(8, "HappyPath"),
  },
};

// Single rank data (edge case)
export const SingleRank: Story = {
  args: {
    candidateName: "SINGLE RANK",
    data: [
      createOutputFixture({
        candidate_id: 9,
        rank_position: 1,
        count: 1500,
        pct_all_ballots: 0.5,
        pct_among_rankers: 1.0,
      }),
    ],
  },
};
