import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstChoiceBreakdownView } from "@/packages/contracts/slices/first_choice_breakdown/view";
import { StvRoundsView } from "@/packages/contracts/slices/stv_rounds/view";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockFirstChoiceData = [
  {
    candidate_name: "John Doe",
    first_choice_votes: 1000,
    pct: 25.5,
    election_id: "portland-20241105-gen" as const,
    contest_id: "d2-3seat" as const,
    district_id: "d2" as const,
    seat_count: 3,
  },
  {
    candidate_name: "Jane Smith",
    first_choice_votes: 800,
    pct: 20.4,
    election_id: "portland-20241105-gen" as const,
    contest_id: "d2-3seat" as const,
    district_id: "d2" as const,
    seat_count: 3,
  },
];

const mockCandidatesData = [
  {
    candidate_id: 1,
    candidate_name: "John Doe",
    election_id: "portland-20241105-gen" as const,
    contest_id: "d2-3seat" as const,
    district_id: "d2" as const,
    seat_count: 3,
  },
  {
    candidate_id: 2,
    candidate_name: "Jane Smith",
    election_id: "portland-20241105-gen" as const,
    contest_id: "d2-3seat" as const,
    district_id: "d2" as const,
    seat_count: 3,
  },
];

const mockStvRoundsData = [
  {
    candidate_name: "John Doe",
    round: 1,
    votes: 1000,
    status: "elected" as const,
    election_id: "portland-20241105-gen" as const,
    contest_id: "d2-3seat" as const,
    district_id: "d2" as const,
    seat_count: 3,
  },
  {
    candidate_name: "Jane Smith",
    round: 1,
    votes: 800,
    status: "standing" as const,
    election_id: "portland-20241105-gen" as const,
    contest_id: "d2-3seat" as const,
    district_id: "d2" as const,
    seat_count: 3,
  },
];

const mockStvMetaData: never[] = [];

const mockStvStats = {
  number_of_rounds: 2,
  winners: ["John Doe"],
  seats: 3,
  first_round_quota: 1000,
  precision: 0.000001,
};

describe("Candidate Link Integration", () => {
  it("should render candidate links in FirstChoiceBreakdownView", () => {
    render(
      <FirstChoiceBreakdownView
        data={mockFirstChoiceData}
        candidates={mockCandidatesData}
        electionId="test-election"
        contestId="test-contest"
      />,
    );

    // Check that candidate links are present in the footer
    const links = screen.getAllByRole("link");
    const johnDoeLink = links.find((link) => link.textContent === "John Doe");

    expect(johnDoeLink).toBeInTheDocument();
    expect(johnDoeLink).toHaveAttribute(
      "href",
      "/e/test-election/c/test-contest/cand/1",
    );
  });

  it("should render candidate names without links when routing props missing", () => {
    const { container } = render(
      <FirstChoiceBreakdownView data={mockFirstChoiceData} />,
    );

    // Should render candidate names as plain text when no routing props provided
    const johnDoeElements = screen.getAllByText("John Doe");
    expect(johnDoeElements.length).toBeGreaterThan(0);

    // No candidate links should exist when routing props are missing
    expect(
      container.querySelector('a[href*="/cand/"]'),
    ).not.toBeInTheDocument();

    // Check that at least one John Doe element is a span (not a link)
    const spanElements = johnDoeElements.filter((el) => el.tagName === "SPAN");
    expect(spanElements.length).toBeGreaterThan(0);
  });

  it("should render candidate links in StvRoundsView", () => {
    const { container } = render(
      <StvRoundsView
        roundsData={mockStvRoundsData}
        metaData={mockStvMetaData}
        stats={mockStvStats}
        candidates={mockCandidatesData}
        electionId="test-election"
        contestId="test-contest"
      />,
    );

    // Check that candidate links exist with correct hrefs
    const johnDoeLink = container.querySelector(
      'a[href="/e/test-election/c/test-contest/cand/1"]',
    );
    expect(johnDoeLink).toBeInTheDocument();
    expect(johnDoeLink?.textContent).toBe("John Doe");

    const janeSmithLink = container.querySelector(
      'a[href="/e/test-election/c/test-contest/cand/2"]',
    );
    expect(janeSmithLink).toBeInTheDocument();
    expect(janeSmithLink?.textContent).toBe("Jane Smith");
  });

  it("should render candidate names without links when no candidates data", () => {
    const { container } = render(
      <StvRoundsView
        roundsData={mockStvRoundsData}
        metaData={mockStvMetaData}
        stats={mockStvStats}
        electionId="test-election"
        contestId="test-contest"
      />,
    );

    // Should render candidate names as plain spans when no candidates provided
    const johnDoeElements = screen.getAllByText("John Doe");
    expect(johnDoeElements.length).toBeGreaterThan(0);

    const janeSmithElements = screen.getAllByText("Jane Smith");
    expect(janeSmithElements.length).toBeGreaterThan(0);

    // Names should not be links - check that no links exist to candidate pages
    expect(
      container.querySelector('a[href*="/cand/"]'),
    ).not.toBeInTheDocument();
  });

  it("should handle candidate ID mapping correctly", () => {
    const candidatesWithDifferentIds = [
      {
        candidate_id: 101,
        candidate_name: "John Doe",
        election_id: "portland-20241105-gen" as const,
        contest_id: "d2-3seat" as const,
        district_id: "d2" as const,
        seat_count: 3,
      },
      {
        candidate_id: 202,
        candidate_name: "Jane Smith",
        election_id: "portland-20241105-gen" as const,
        contest_id: "d2-3seat" as const,
        district_id: "d2" as const,
        seat_count: 3,
      },
    ];

    const { container } = render(
      <FirstChoiceBreakdownView
        data={mockFirstChoiceData}
        candidates={candidatesWithDifferentIds}
        electionId="test-election"
        contestId="test-contest"
      />,
    );

    // Look for the link in the footer specifically
    const footerLink = container.querySelector(
      'a[href="/e/test-election/c/test-contest/cand/101"]',
    );
    expect(footerLink).toBeInTheDocument();
    expect(footerLink?.textContent).toBe("John Doe");
  });
});
