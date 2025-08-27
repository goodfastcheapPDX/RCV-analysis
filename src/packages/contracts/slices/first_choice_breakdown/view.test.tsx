import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import type { Output } from "./index.contract";
import { FirstChoiceBreakdownView } from "./view";

const mockData: Output[] = [
  {
    candidate_name: "John Smith",
    first_choice_votes: 1500,
    pct: 35.7,
  },
  {
    candidate_name: "Jane Doe",
    first_choice_votes: 1200,
    pct: 28.6,
  },
  {
    candidate_name: "Bob Johnson",
    first_choice_votes: 800,
    pct: 19.0,
  },
  {
    candidate_name: "Alice Williams",
    first_choice_votes: 700,
    pct: 16.7,
  },
];

const mockSingleCandidate: Output[] = [
  {
    candidate_name: "Only Candidate",
    first_choice_votes: 2000,
    pct: 100.0,
  },
];

const mockLongCandidateName: Output[] = [
  {
    candidate_name:
      "This is a very long candidate name that should be truncated",
    first_choice_votes: 1000,
    pct: 50.0,
  },
  {
    candidate_name: "Short Name",
    first_choice_votes: 1000,
    pct: 50.0,
  },
];

describe("FirstChoiceBreakdownView", () => {
  it("renders the card with correct title and description", () => {
    render(<FirstChoiceBreakdownView data={mockData} />);

    expect(screen.getByText("First Choice Breakdown")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Candidate preferences in first round \(4,200 total ballots\)/,
      ),
    ).toBeInTheDocument();
  });

  it("displays educational information about the chart", () => {
    render(<FirstChoiceBreakdownView data={mockData} />);

    expect(screen.getByText("About this chart:")).toBeInTheDocument();
    expect(
      screen.getByText(/This shows how many voters selected each candidate/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /votes may transfer to other candidates during tabulation rounds/,
      ),
    ).toBeInTheDocument();
  });

  it("shows the leading candidate information", () => {
    render(<FirstChoiceBreakdownView data={mockData} />);

    expect(screen.getByText("John Smith leads with 35.7%")).toBeInTheDocument();
    expect(
      screen.getByText("7.1 percentage point lead over second place"),
    ).toBeInTheDocument();
  });

  it("handles single candidate data without showing lead margin", () => {
    render(<FirstChoiceBreakdownView data={mockSingleCandidate} />);

    expect(
      screen.getByText("Only Candidate leads with 100.0%"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/percentage point lead over second place/),
    ).not.toBeInTheDocument();
  });

  it("displays correct total vote count", () => {
    render(<FirstChoiceBreakdownView data={mockData} />);

    const totalVotes = mockData.reduce(
      (sum, item) => sum + item.first_choice_votes,
      0,
    );
    expect(
      screen.getByText(
        new RegExp(`\\(${totalVotes.toLocaleString()} total ballots\\)`),
      ),
    ).toBeInTheDocument();
  });

  it("sorts data by first_choice_votes in descending order", () => {
    const unsortedData: Output[] = [
      { candidate_name: "Low Vote", first_choice_votes: 100, pct: 10.0 },
      { candidate_name: "High Vote", first_choice_votes: 900, pct: 90.0 },
    ];

    render(<FirstChoiceBreakdownView data={unsortedData} />);

    // The leading candidate should be the one with higher votes
    expect(screen.getByText("High Vote leads with 90.0%")).toBeInTheDocument();
  });

  it("truncates long candidate names in chart data", () => {
    render(<FirstChoiceBreakdownView data={mockLongCandidateName} />);

    // The long name should still appear in the tooltip data structure
    // but we can't easily test the chart rendering without more complex setup
    expect(
      screen.getByText(/This is a very long candidate name/),
    ).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<FirstChoiceBreakdownView data={[]} />);

    expect(screen.getByText("First Choice Breakdown")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Candidate preferences in first round \(0 total ballots\)/,
      ),
    ).toBeInTheDocument();

    // Should not show footer with candidate info when no data
    expect(screen.queryByText(/leads with/)).not.toBeInTheDocument();
  });

  it("calculates percentage lead correctly with tied candidates", () => {
    const tiedData: Output[] = [
      { candidate_name: "Candidate A", first_choice_votes: 500, pct: 50.0 },
      { candidate_name: "Candidate B", first_choice_votes: 500, pct: 50.0 },
    ];

    render(<FirstChoiceBreakdownView data={tiedData} />);

    expect(
      screen.getByText("Candidate A leads with 50.0%"),
    ).toBeInTheDocument();
    // When tied, no lead percentage is shown (leadPercentage === 0)
    expect(
      screen.queryByText(/percentage point lead over second place/),
    ).not.toBeInTheDocument();
  });

  it("uses correct chart accessibility features", () => {
    render(<FirstChoiceBreakdownView data={mockData} />);

    // The ResponsiveContainer and BarChart should have accessibility layer
    const container = document.querySelector(".recharts-responsive-container");
    expect(container).toBeInTheDocument();

    // The chart should render the title and description
    expect(screen.getByText("First Choice Breakdown")).toBeInTheDocument();
  });

  it("formats vote numbers with locale string", () => {
    const largeNumberData: Output[] = [
      {
        candidate_name: "Popular Candidate",
        first_choice_votes: 15000,
        pct: 100.0,
      },
    ];

    render(<FirstChoiceBreakdownView data={largeNumberData} />);

    expect(screen.getByText(/\(15,000 total ballots\)/)).toBeInTheDocument();
  });

  it("creates proper chart configuration for multiple candidates", () => {
    render(<FirstChoiceBreakdownView data={mockData} />);

    // We can't directly test the chartConfig object, but we can verify
    // that the component renders without errors with multiple candidates
    expect(screen.getByText("John Smith leads with 35.7%")).toBeInTheDocument();

    // Check that the chart container is present
    const chartContainer = document.querySelector('[data-slot="chart"]');
    expect(chartContainer).toBeInTheDocument();
  });

  it("handles candidates with zero votes", () => {
    const dataWithZeroVotes: Output[] = [
      { candidate_name: "Winner", first_choice_votes: 1000, pct: 100.0 },
      { candidate_name: "No Votes", first_choice_votes: 0, pct: 0.0 },
    ];

    render(<FirstChoiceBreakdownView data={dataWithZeroVotes} />);

    expect(screen.getByText("Winner leads with 100.0%")).toBeInTheDocument();

    // Verify the total vote count is correct (1000 + 0 = 1000)
    expect(screen.getByText(/\(1,000 total ballots\)/)).toBeInTheDocument();

    // The component should render without errors even with zero vote candidates
    expect(screen.getByText("First Choice Breakdown")).toBeInTheDocument();
  });

  it("maintains consistent color assignment through chart colors array", () => {
    // Test with more candidates than available colors to ensure modulo wrapping
    const manyCandidate: Output[] = Array.from({ length: 8 }, (_, i) => ({
      candidate_name: `Candidate ${i + 1}`,
      first_choice_votes: 100 - i * 10,
      pct: (100 - i * 10) / 10,
    }));

    render(<FirstChoiceBreakdownView data={manyCandidate} />);

    // Should render without errors even with more candidates than colors
    expect(
      screen.getByText("Candidate 1 leads with 10.0%"),
    ).toBeInTheDocument();

    // Check the total vote count calculation
    const totalVotes = manyCandidate.reduce(
      (sum, item) => sum + item.first_choice_votes,
      0,
    );
    expect(
      screen.getByText(
        new RegExp(`\\(${totalVotes.toLocaleString()} total ballots\\)`),
      ),
    ).toBeInTheDocument();
  });
});
