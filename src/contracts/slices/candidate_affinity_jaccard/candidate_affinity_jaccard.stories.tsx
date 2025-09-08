import type { Meta, StoryObj } from "@storybook/react";
import {
  createOutputFixture,
  createStatsFixture,
  type Output,
  type Stats,
} from "./index.contract";
import { CandidateAffinityJaccardView } from "./view";

const meta = {
  title: "Slices/CandidateAffinityJaccard",
  component: CandidateAffinityJaccardView,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CandidateAffinityJaccardView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock candidates data for meaningful names
const mockCandidates = [
  {
    candidate_id: 1,
    candidate_name: "ALICE HARDESTY",
    election_id: "test",
    contest_id: "test",
    district_id: "d2",
    seat_count: 3,
  },
  {
    candidate_id: 2,
    candidate_name: "CANDACE AVALOS",
    election_id: "test",
    contest_id: "test",
    district_id: "d2",
    seat_count: 3,
  },
  {
    candidate_id: 3,
    candidate_name: "OLIVIA CLARK",
    election_id: "test",
    contest_id: "test",
    district_id: "d2",
    seat_count: 3,
  },
  {
    candidate_id: 4,
    candidate_name: "STEVE NOVICK",
    election_id: "test",
    contest_id: "test",
    district_id: "d2",
    seat_count: 3,
  },
  {
    candidate_id: 5,
    candidate_name: "TIFFANY KOYAMA LANE",
    election_id: "test",
    contest_id: "test",
    district_id: "d2",
    seat_count: 3,
  },
  {
    candidate_id: 6,
    candidate_name: "DAN RYAN",
    election_id: "test",
    contest_id: "test",
    district_id: "d2",
    seat_count: 3,
  },
];

// Sample Jaccard data with realistic values
const sampleJaccardData: Output[] = [
  createOutputFixture({
    candidate_a: 1,
    candidate_b: 2,
    pair_count: 450,
    presence_a: 800,
    presence_b: 750,
    union_count: 1100,
    jaccard: 0.409, // 450/1100
  }),
  createOutputFixture({
    candidate_a: 1,
    candidate_b: 3,
    pair_count: 380,
    presence_a: 800,
    presence_b: 650,
    union_count: 1070,
    jaccard: 0.355, // 380/1070
  }),
  createOutputFixture({
    candidate_a: 1,
    candidate_b: 4,
    pair_count: 320,
    presence_a: 800,
    presence_b: 600,
    union_count: 1080,
    jaccard: 0.296, // 320/1080
  }),
  createOutputFixture({
    candidate_a: 1,
    candidate_b: 5,
    pair_count: 280,
    presence_a: 800,
    presence_b: 500,
    union_count: 1020,
    jaccard: 0.275, // 280/1020
  }),
  createOutputFixture({
    candidate_a: 1,
    candidate_b: 6,
    pair_count: 250,
    presence_a: 800,
    presence_b: 450,
    union_count: 1000,
    jaccard: 0.25, // 250/1000
  }),
  createOutputFixture({
    candidate_a: 2,
    candidate_b: 3,
    pair_count: 420,
    presence_a: 750,
    presence_b: 650,
    union_count: 980,
    jaccard: 0.429, // 420/980
  }),
  createOutputFixture({
    candidate_a: 2,
    candidate_b: 4,
    pair_count: 350,
    presence_a: 750,
    presence_b: 600,
    union_count: 1000,
    jaccard: 0.35, // 350/1000
  }),
  createOutputFixture({
    candidate_a: 2,
    candidate_b: 5,
    pair_count: 300,
    presence_a: 750,
    presence_b: 500,
    union_count: 950,
    jaccard: 0.316, // 300/950
  }),
  createOutputFixture({
    candidate_a: 2,
    candidate_b: 6,
    pair_count: 220,
    presence_a: 750,
    presence_b: 450,
    union_count: 980,
    jaccard: 0.224, // 220/980
  }),
  createOutputFixture({
    candidate_a: 3,
    candidate_b: 4,
    pair_count: 290,
    presence_a: 650,
    presence_b: 600,
    union_count: 960,
    jaccard: 0.302, // 290/960
  }),
  createOutputFixture({
    candidate_a: 3,
    candidate_b: 5,
    pair_count: 270,
    presence_a: 650,
    presence_b: 500,
    union_count: 880,
    jaccard: 0.307, // 270/880
  }),
  createOutputFixture({
    candidate_a: 3,
    candidate_b: 6,
    pair_count: 200,
    presence_a: 650,
    presence_b: 450,
    union_count: 900,
    jaccard: 0.222, // 200/900
  }),
  createOutputFixture({
    candidate_a: 4,
    candidate_b: 5,
    pair_count: 250,
    presence_a: 600,
    presence_b: 500,
    union_count: 850,
    jaccard: 0.294, // 250/850
  }),
  createOutputFixture({
    candidate_a: 4,
    candidate_b: 6,
    pair_count: 180,
    presence_a: 600,
    presence_b: 450,
    union_count: 870,
    jaccard: 0.207, // 180/870
  }),
  createOutputFixture({
    candidate_a: 5,
    candidate_b: 6,
    pair_count: 150,
    presence_a: 500,
    presence_b: 450,
    union_count: 800,
    jaccard: 0.188, // 150/800
  }),
];

const sampleStats: Stats = createStatsFixture({
  total_ballots_considered: 1200,
  unique_pairs: 15, // C(6,2) = 15
  max_jaccard: 0.429,
  zero_union_pairs: 0,
  compute_ms: 145,
});

// High similarity data for threshold testing
const highSimilarityData: Output[] = sampleJaccardData.map((item, index) => ({
  ...item,
  jaccard: Math.max(0.1, item.jaccard + (index % 3) * 0.2),
}));

const highSimilarityStats: Stats = {
  ...sampleStats,
  max_jaccard: Math.max(...highSimilarityData.map((d) => d.jaccard)),
};

export const Default: Story = {
  args: {
    jaccardData: sampleJaccardData,
    stats: sampleStats,
    candidates: mockCandidates,
    electionId: "portland-20241105-gen",
    contestId: "d2-3seat",
  },
};

export const WithThreshold: Story = {
  args: {
    jaccardData: sampleJaccardData,
    stats: sampleStats,
    candidates: mockCandidates,
    electionId: "portland-20241105-gen",
    contestId: "d2-3seat",
  },
  name: "Threshold = 0.05",
  parameters: {
    docs: {
      description: {
        story:
          "Shows the matrix with a minimum Jaccard threshold of 0.05, filtering out low-similarity pairs.",
      },
    },
  },
};

export const TopKPairs: Story = {
  args: {
    jaccardData: sampleJaccardData,
    stats: sampleStats,
    candidates: mockCandidates,
    electionId: "portland-20241105-gen",
    contestId: "d2-3seat",
  },
  name: "Top-K = 10",
  parameters: {
    docs: {
      description: {
        story:
          "Shows only the top 10 pairs by Jaccard similarity, useful for focusing on the strongest connections.",
      },
    },
  },
};

export const HighSimilarityComparison: Story = {
  args: {
    jaccardData: highSimilarityData,
    stats: highSimilarityStats,
    candidates: mockCandidates,
    electionId: "portland-20241105-gen",
    contestId: "d2-3seat",
  },
  name: "High Similarity Dataset",
  parameters: {
    docs: {
      description: {
        story:
          "Example with higher Jaccard values to demonstrate the visualization with strong candidate affinities. This shows how the heatmap appears when candidates have overlapping voter bases.",
      },
    },
  },
};

export const MinimalData: Story = {
  args: {
    jaccardData: sampleJaccardData.slice(0, 3), // Only first 3 pairs
    stats: createStatsFixture({
      total_ballots_considered: 500,
      unique_pairs: 3,
      max_jaccard: 0.429,
      zero_union_pairs: 0,
      compute_ms: 85,
    }),
    candidates: mockCandidates.slice(0, 3), // Only first 3 candidates
    electionId: "test-election",
    contestId: "test-contest",
  },
  name: "Minimal Dataset",
  parameters: {
    docs: {
      description: {
        story:
          "Shows the matrix with minimal data (3 candidates, 3 pairs) to demonstrate behavior with small datasets.",
      },
    },
  },
};
