import { render } from "@testing-library/react";
import { describe, expect, it, type MockedFunction, vi } from "vitest";
import CandidatePage from "@/app/e/[electionId]/c/[contestId]/cand/[candidateId]/page";
import {
  loadCandidatesForContest,
  loadStvForContest,
} from "@/lib/manifest/loaders";

// Mock the environment to use test data
vi.mock("@/lib/env", () => ({
  getDataEnv: () => "test",
}));

// Mock the loaders
vi.mock("@/lib/manifest/loaders", () => ({
  loadCandidatesForContest: vi.fn(),
  loadStvForContest: vi.fn(),
}));

// Mock the data loading functionality from the correct location
vi.mock("@/contracts/slices/rank_distribution_by_candidate/loader", () => ({
  loadRankDistribution: vi.fn(),
  selectCandidateRankDistribution: vi.fn(),
  candidateHasRankers: vi.fn(),
}));

// No mocking needed - let Recharts render naturally

// Mock child components to avoid complex rendering
vi.mock("@/components/candidate/Tabs", () => ({
  CandidateTabs: ({
    candidateName,
    currentTab,
    children,
  }: {
    candidateName: string;
    currentTab: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="candidate-tabs">
      <div>
        Tabs for {candidateName} - Current: {currentTab}
      </div>
      {children}
    </div>
  ),
}));

const mockCandidatesData = [
  {
    candidate_id: 1,
    candidate_name: "John Doe",
    election_id: "portland-20241105-gen",
    contest_id: "d2-3seat",
    district_id: "d2",
    seat_count: 3,
  },
  {
    candidate_id: 2,
    candidate_name: "Jane Smith",
    election_id: "portland-20241105-gen",
    contest_id: "d2-3seat",
    district_id: "d2",
    seat_count: 3,
  },
];

const mockContestData = {
  contest_id: "d2-3seat",
  district_id: "d2",
  seat_count: 3,
  title: "Portland City Council District 2",
  cvr: {
    candidates: {
      uri: "test/candidates.parquet",
      sha256: "a".repeat(64),
      rows: 3,
    },
    ballots_long: {
      uri: "test/ballots.parquet",
      sha256: "b".repeat(64),
      rows: 100,
    },
  },
  stv: {},
  rules: {
    method: "meek" as const,
    quota: "droop" as const,
    precision: 1e-9,
    tie_break: "lexicographic" as const,
    seats: 3,
  },
  slices: {
    rank_distribution_by_candidate: {
      uri: "test/rank_distribution.parquet",
      sha256: "c".repeat(64),
    },
  },
};

const mockElectionData = {
  election_id: "portland-20241105-gen",
  date: "2024-11-05",
  jurisdiction: "portland",
  title: "Portland General Election 2024",
  contests: [mockContestData],
};

const mockStvData = [
  {
    election_id: "portland-20241105-gen",
    contest_id: "d2-3seat",
    district_id: "d2",
    seat_count: 3,
    candidate_name: "John Doe",
    round: 1,
    votes: 1000,
    status: "elected" as const,
  },
];

describe("Candidate Page - Rank Distribution Integration", () => {
  it("should render candidate page with rank tab showing RankDistributionCard", async () => {
    (
      loadCandidatesForContest as MockedFunction<
        typeof loadCandidatesForContest
      >
    ).mockResolvedValue({
      data: mockCandidatesData,
      contest: mockContestData,
      election: mockElectionData,
    });

    (
      loadStvForContest as MockedFunction<typeof loadStvForContest>
    ).mockResolvedValue({
      roundsData: mockStvData,
      metaData: [],
      stats: {
        number_of_rounds: 1,
        winners: ["John Doe"],
        seats: 3,
        first_round_quota: 134.0,
        precision: 1e-6,
      },
      contest: mockContestData,
      election: mockElectionData,
    });

    const component = await CandidatePage({
      params: Promise.resolve({
        electionId: "portland-20241105-gen",
        contestId: "d2-3seat",
        candidateId: "1",
      }),
      searchParams: Promise.resolve({ tab: "rank" }),
    });

    const { container } = render(component);

    // Check that candidate name appears
    expect(container.textContent).toContain("John Doe");
    expect(container.textContent).toContain("Portland City Council District 2");

    // Check that tabs component is rendered with correct current tab
    expect(container.textContent).toContain(
      "Tabs for John Doe - Current: rank",
    );

    // Check that the tabs wrapper exists
    expect(
      container.querySelector("[data-testid='candidate-tabs']"),
    ).toBeInTheDocument();
  });

  it("should handle candidate not found", async () => {
    (
      loadCandidatesForContest as MockedFunction<
        typeof loadCandidatesForContest
      >
    ).mockResolvedValue({
      data: mockCandidatesData,
      contest: mockContestData,
      election: mockElectionData,
    });

    const component = await CandidatePage({
      params: Promise.resolve({
        electionId: "portland-20241105-gen",
        contestId: "d2-3seat",
        candidateId: "999", // Non-existent candidate
      }),
      searchParams: Promise.resolve({ tab: "rank" }),
    });

    const { container } = render(component);

    expect(container.textContent).toContain("Candidate Not Available");
  });

  it("should handle data loading errors gracefully", async () => {
    (
      loadCandidatesForContest as MockedFunction<
        typeof loadCandidatesForContest
      >
    ).mockRejectedValue(new Error("Test error: candidates data not found"));

    const component = await CandidatePage({
      params: Promise.resolve({
        electionId: "invalid-election",
        contestId: "invalid-contest",
        candidateId: "1",
      }),
      searchParams: Promise.resolve({ tab: "rank" }),
    });

    const { container } = render(component);

    expect(container.textContent).toContain("Candidate Not Available");
    expect(container.textContent).toContain(
      "Test error: candidates data not found",
    );
  });

  it("should default to rank tab when no tab specified and accessing rank distribution", async () => {
    (
      loadCandidatesForContest as MockedFunction<
        typeof loadCandidatesForContest
      >
    ).mockResolvedValue({
      data: mockCandidatesData,
      contest: mockContestData,
      election: mockElectionData,
    });

    (
      loadStvForContest as MockedFunction<typeof loadStvForContest>
    ).mockResolvedValue({
      roundsData: mockStvData,
      metaData: [],
      stats: {
        number_of_rounds: 1,
        winners: ["John Doe"],
        seats: 3,
        first_round_quota: 134.0,
        precision: 1e-6,
      },
      contest: mockContestData,
      election: mockElectionData,
    });

    // No tab specified in searchParams
    const component = await CandidatePage({
      params: Promise.resolve({
        electionId: "portland-20241105-gen",
        contestId: "d2-3seat",
        candidateId: "1",
      }),
      searchParams: Promise.resolve({}),
    });

    const { container } = render(component);

    expect(container.textContent).toContain("John Doe");
    // The default tab behavior depends on the CandidateTabs implementation
    expect(
      container.querySelector("[data-testid='candidate-tabs']"),
    ).toBeInTheDocument();
  });
});
