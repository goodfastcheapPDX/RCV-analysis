import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CandidateAffinityJaccardView } from "./CandidateAffinityJaccardView";

const mockData = [
  {
    election_id: "test",
    contest_id: "test",
    district_id: "test",
    seat_count: 3,
    candidate_a: 1,
    candidate_b: 2,
    cooccurrence_count: 10,
    cooccurrence_frac: 0.5,
    jaccard: 0.4,
    pair_count: 10,
    union_count: 20,
    presence_a: 15,
    presence_b: 15,
  },
];

const mockStats = {
  total_ballots_considered: 20,
  unique_pairs: 1,
  max_jaccard: 0.4,
  zero_union_pairs: 0,
  compute_ms: 100,
};

describe("CandidateAffinityJaccardView", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <CandidateAffinityJaccardView
        jaccardData={mockData}
        stats={mockStats}
        candidates={[]}
      />,
    );
    expect(container).toBeTruthy();
  });
});
