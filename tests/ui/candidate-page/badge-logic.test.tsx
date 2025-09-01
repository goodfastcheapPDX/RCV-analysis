import { render } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from "vitest";
import CandidatePage from "@/app/e/[electionId]/c/[contestId]/cand/[candidateId]/page";
import {
  createContestFixture,
  createElectionFixture,
} from "@/contracts/manifest";
import {
  loadCandidatesForContest,
  loadStvForContest,
} from "@/lib/manifest/loaders";
import { createCandidatesOutputFixture } from "@/packages/contracts/slices/ingest_cvr/index.contract";
import {
  createStvRoundsOutputFixture,
  createStvRoundsStatsFixture,
} from "@/packages/contracts/slices/stv_rounds/index.contract";

// Mock the environment to use test data
vi.mock("@/lib/env", () => ({
  getDataEnv: () => "test",
}));

// Mock the loaders
vi.mock("@/lib/manifest/loaders", () => ({
  loadCandidatesForContest: vi.fn(),
  loadStvForContest: vi.fn(),
}));

// Mock the child components
vi.mock("@/components/candidate/Tabs", () => ({
  CandidateTabs: ({ candidateName }: { candidateName: string }) => (
    <div data-testid="candidate-tabs">Tabs for {candidateName}</div>
  ),
}));

const mockCandidatesData = [
  createCandidatesOutputFixture({
    candidate_id: 1,
    candidate_name: "Winner Smith",
  }),
  createCandidatesOutputFixture({
    candidate_id: 2,
    candidate_name: "Dropout Jones",
  }),
  createCandidatesOutputFixture({
    candidate_id: 3,
    candidate_name: "Regular Brown",
  }),
];

const mockContestData = createContestFixture({
  title: "Test Contest",
});

const mockElectionData = createElectionFixture({
  title: "Test Election",
  contests: [mockContestData],
});

describe("Candidate Badge Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (
      loadCandidatesForContest as MockedFunction<
        typeof loadCandidatesForContest
      >
    ).mockResolvedValue({
      data: mockCandidatesData,
      contest: mockContestData,
      election: mockElectionData,
    });
  });

  it("should show elected badge for elected candidate", async () => {
    const mockStvData = [
      {
        election_id: "portland-20241105-gen",
        contest_id: "d2-3seat",
        district_id: "d2",
        seat_count: 3,
        candidate_name: "Winner Smith",
        round: 1,
        votes: 1000,
        status: "elected" as const,
      },
      {
        election_id: "portland-20241105-gen",
        contest_id: "d2-3seat",
        district_id: "d2",
        seat_count: 3,
        candidate_name: "Dropout Jones",
        round: 1,
        votes: 500,
        status: "eliminated" as const,
      },
    ];

    (
      loadStvForContest as MockedFunction<typeof loadStvForContest>
    ).mockResolvedValue({
      roundsData: mockStvData,
      metaData: [],
      stats: {
        number_of_rounds: 1,
        winners: ["Winner Smith"],
        seats: 3,
        first_round_quota: 134.0,
        precision: 1e-6,
      },
      contest: mockContestData,
      election: mockElectionData,
    });

    const component = await CandidatePage({
      params: Promise.resolve({
        electionId: "test-election",
        contestId: "d2-3seat",
        candidateId: "1",
      }),
    });

    const { container } = render(component);

    expect(container.textContent).toContain("Winner Smith");
    expect(container.textContent).toContain("Elected");
    expect(
      container.querySelector('[class*="bg-green-600"]'),
    ).toBeInTheDocument();
  });

  it("should show eliminated badge for eliminated candidate", async () => {
    const mockStvData = [
      {
        election_id: "portland-20241105-gen",
        contest_id: "d2-3seat",
        district_id: "d2",
        seat_count: 3,
        candidate_name: "Winner Smith",
        round: 1,
        votes: 1000,
        status: "elected" as const,
      },
      {
        election_id: "portland-20241105-gen",
        contest_id: "d2-3seat",
        district_id: "d2",
        seat_count: 3,
        candidate_name: "Dropout Jones",
        round: 1,
        votes: 500,
        status: "eliminated" as const,
      },
    ];

    (
      loadStvForContest as MockedFunction<typeof loadStvForContest>
    ).mockResolvedValue({
      roundsData: mockStvData,
      metaData: [],
      stats: {
        number_of_rounds: 1,
        winners: ["Winner Smith"],
        seats: 3,
        first_round_quota: 134.0,
        precision: 1e-6,
      },
      contest: mockContestData,
      election: mockElectionData,
    });

    const component = await CandidatePage({
      params: Promise.resolve({
        electionId: "test-election",
        contestId: "d2-3seat",
        candidateId: "2",
      }),
    });

    const { container } = render(component);

    expect(container.textContent).toContain("Dropout Jones");
    expect(container.textContent).toContain("Eliminated");
    // Look for destructive variant badge
    expect(
      container.querySelector('[class*="destructive"]'),
    ).toBeInTheDocument();
  });

  it("should show no badge for regular candidate", async () => {
    const mockStvData = [
      {
        election_id: "portland-20241105-gen",
        contest_id: "d2-3seat",
        district_id: "d2",
        seat_count: 3,
        candidate_name: "Winner Smith",
        round: 1,
        votes: 1000,
        status: "elected" as const,
      },
      {
        election_id: "portland-20241105-gen",
        contest_id: "d2-3seat",
        district_id: "d2",
        seat_count: 3,
        candidate_name: "Dropout Jones",
        round: 1,
        votes: 500,
        status: "eliminated" as const,
      },
      {
        election_id: "portland-20241105-gen",
        contest_id: "d2-3seat",
        district_id: "d2",
        seat_count: 3,
        candidate_name: "Regular Brown",
        round: 1,
        votes: 750,
        status: "standing" as const,
      },
    ];

    (
      loadStvForContest as MockedFunction<typeof loadStvForContest>
    ).mockResolvedValue({
      roundsData: mockStvData,
      metaData: [],
      stats: {
        number_of_rounds: 1,
        winners: ["Winner Smith"],
        seats: 3,
        first_round_quota: 134.0,
        precision: 1e-6,
      },
      contest: mockContestData,
      election: mockElectionData,
    });

    const component = await CandidatePage({
      params: Promise.resolve({
        electionId: "test-election",
        contestId: "d2-3seat",
        candidateId: "3",
      }),
    });

    const { container } = render(component);

    expect(container.textContent).toContain("Regular Brown");
    // Should not contain "Elected" or "Eliminated" badges
    expect(container.textContent).not.toContain("Elected");
    expect(container.textContent).not.toContain("Eliminated");
  });

  it("should handle missing STV data gracefully (no badges)", async () => {
    (
      loadStvForContest as MockedFunction<typeof loadStvForContest>
    ).mockRejectedValue(new Error("STV data not available"));

    const component = await CandidatePage({
      params: Promise.resolve({
        electionId: "test-election",
        contestId: "d2-3seat",
        candidateId: "1",
      }),
    });

    const { container } = render(component);

    expect(container.textContent).toContain("Winner Smith");
    // Should not show any badges when STV data is unavailable
    expect(container.textContent).not.toContain("Elected");
    expect(container.textContent).not.toContain("Eliminated");
  });
});
