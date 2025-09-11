import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildSymmetricGetter,
  getCandidateName,
  getCanonicalPairKey,
  getLastName,
  useSortedCandidates,
  useSortedCandidatesByFrequency,
} from "./utils";

const mockCandidates = [
  {
    election_id: "test",
    contest_id: "test",
    district_id: "test",
    seat_count: 3,
    candidate_id: 3,
    candidate_name: "Charlie Wilson",
  },
  {
    election_id: "test",
    contest_id: "test",
    district_id: "test",
    seat_count: 3,
    candidate_id: 1,
    candidate_name: "Alice Smith",
  },
  {
    election_id: "test",
    contest_id: "test",
    district_id: "test",
    seat_count: 3,
    candidate_id: 2,
    candidate_name: "Bob Johnson",
  },
];

describe("useSortedCandidates", () => {
  it("sorts candidates by name when candidates provided", () => {
    const { result } = renderHook(() =>
      useSortedCandidates(mockCandidates, []),
    );

    // Should be sorted by name: Alice, Bob, Charlie
    expect(result.current).toEqual([1, 2, 3]);
  });

  it("uses fallback IDs when no candidates provided", () => {
    const { result } = renderHook(() =>
      useSortedCandidates(undefined, [3, 1, 2]),
    );

    // Should be sorted numerically: 1, 2, 3
    expect(result.current).toEqual([1, 2, 3]);
  });

  it("uses fallback IDs when empty candidates array provided", () => {
    const { result } = renderHook(() => useSortedCandidates([], [3, 1, 2]));

    expect(result.current).toEqual([1, 2, 3]);
  });
});

describe("getCandidateName", () => {
  it("returns candidate name when found", () => {
    const name = getCandidateName(2, mockCandidates);
    expect(name).toBe("Bob Johnson");
  });

  it("returns candidate ID as string when not found", () => {
    const name = getCandidateName(99, mockCandidates);
    expect(name).toBe("99");
  });

  it("returns candidate ID as string when no candidates provided", () => {
    const name = getCandidateName(2, undefined);
    expect(name).toBe("2");
  });
});

describe("getLastName", () => {
  it("extracts last name from full name", () => {
    const lastName = getLastName(1, mockCandidates);
    expect(lastName).toBe("Smith");
  });

  it("returns full name if no spaces", () => {
    const singleNameCandidate = [
      {
        election_id: "test",
        contest_id: "test",
        district_id: "test",
        seat_count: 3,
        candidate_id: 1,
        candidate_name: "Madonna",
      },
    ];
    const lastName = getLastName(1, singleNameCandidate);
    expect(lastName).toBe("Madonna");
  });

  it("returns candidate ID when not found", () => {
    const lastName = getLastName(99, mockCandidates);
    expect(lastName).toBe("99");
  });
});

describe("buildSymmetricGetter", () => {
  it("builds symmetric matrix with diagonal zeros", () => {
    const pairMap = new Map([
      ["1-2", { cooccurrence_frac: 0.5 }],
      ["1-3", { cooccurrence_frac: 0.3 }],
      ["2-3", { cooccurrence_frac: 0.7 }],
    ]);

    const result = buildSymmetricGetter(pairMap, getCanonicalPairKey);

    // Check symmetry
    expect(result["1-2"]).toBe(0.5);
    expect(result["2-1"]).toBe(0.5);
    expect(result["1-3"]).toBe(0.3);
    expect(result["3-1"]).toBe(0.3);
    expect(result["2-3"]).toBe(0.7);
    expect(result["3-2"]).toBe(0.7);

    // Check diagonal zeros
    expect(result["1-1"]).toBe(0);
    expect(result["2-2"]).toBe(0);
    expect(result["3-3"]).toBe(0);
  });

  it("handles missing pairs with zero values", () => {
    const pairMap = new Map([["1-2", { cooccurrence_frac: 0.5 }]]);

    const result = buildSymmetricGetter(pairMap, getCanonicalPairKey);

    expect(result["1-2"]).toBe(0.5);
    expect(result["2-1"]).toBe(0.5);
    expect(result["1-1"]).toBe(0);
    expect(result["2-2"]).toBe(0);
  });
});

describe("getCanonicalPairKey", () => {
  it("orders candidates lexicographically", () => {
    expect(getCanonicalPairKey(2, 1)).toBe("1-2");
    expect(getCanonicalPairKey(1, 2)).toBe("1-2");
    expect(getCanonicalPairKey(3, 1)).toBe("1-3");
    expect(getCanonicalPairKey(1, 3)).toBe("1-3");
  });

  it("handles equal candidates", () => {
    expect(getCanonicalPairKey(2, 2)).toBe("2-2");
  });
});

describe("useSortedCandidatesByFrequency", () => {
  const mockJaccardData = [
    {
      election_id: "test",
      contest_id: "test",
      district_id: "test",
      seat_count: 3,
      candidate_a: 1,
      candidate_b: 2,
      pair_count: 100,
      presence_a: 150, // Alice appears on 150 ballots
      presence_b: 200, // Bob appears on 200 ballots
      union_count: 250,
      jaccard: 0.4,
    },
    {
      election_id: "test",
      contest_id: "test",
      district_id: "test",
      seat_count: 3,
      candidate_a: 1,
      candidate_b: 3,
      pair_count: 80,
      presence_a: 150, // Alice: 150 ballots
      presence_b: 120, // Charlie: 120 ballots
      union_count: 190,
      jaccard: 0.42,
    },
    {
      election_id: "test",
      contest_id: "test",
      district_id: "test",
      seat_count: 3,
      candidate_a: 2,
      candidate_b: 3,
      pair_count: 90,
      presence_a: 200, // Bob: 200 ballots
      presence_b: 120, // Charlie: 120 ballots
      union_count: 230,
      jaccard: 0.39,
    },
  ];

  const mockAffinityData = [
    {
      election_id: "test",
      contest_id: "test",
      district_id: "test",
      seat_count: 3,
      candidate_a: 1,
      candidate_b: 2,
      cooccurrence_count: 100,
      cooccurrence_frac: 0.5,
    },
    {
      election_id: "test",
      contest_id: "test",
      district_id: "test",
      seat_count: 3,
      candidate_a: 1,
      candidate_b: 3,
      cooccurrence_count: 80,
      cooccurrence_frac: 0.4,
    },
  ];

  it("sorts candidates by ballot frequency from Jaccard data (descending)", () => {
    const { result } = renderHook(() =>
      useSortedCandidatesByFrequency(mockJaccardData, mockCandidates, []),
    );

    // Should be sorted by presence: Bob (200), Alice (150), Charlie (120)
    expect(result.current).toEqual([2, 1, 3]);
  });

  it("sorts candidates by estimated frequency from Raw affinity data", () => {
    const { result } = renderHook(() =>
      useSortedCandidatesByFrequency(mockAffinityData, mockCandidates, []),
    );

    // For Raw data, we estimate frequency - candidate 1 and 2 both have max pair count 100
    // Should fall back to alphabetical: Alice (1), Bob (2), then Charlie (3) if present
    expect(result.current).toEqual([1, 2, 3]);
  });

  it("uses candidate name as tiebreaker when frequencies are equal", () => {
    const equalFreqData = [
      {
        election_id: "test",
        contest_id: "test",
        district_id: "test",
        seat_count: 3,
        candidate_a: 1,
        candidate_b: 2,
        pair_count: 100,
        presence_a: 150, // Same frequency
        presence_b: 150, // Same frequency
        union_count: 200,
        jaccard: 0.5,
      },
    ];

    const { result } = renderHook(() =>
      useSortedCandidatesByFrequency(equalFreqData, mockCandidates, []),
    );

    // With equal frequencies (150 each), should sort alphabetically: Alice (1), Bob (2)
    expect(result.current).toEqual([1, 2]);
  });

  it("uses fallback IDs when no affinity data provided", () => {
    const { result } = renderHook(() =>
      useSortedCandidatesByFrequency(undefined, mockCandidates, [3, 1, 2]),
    );

    // Should use candidates directly, sorted by frequency (none available) then by name
    expect(result.current).toEqual([1, 2, 3]);
  });

  it("handles empty affinity data", () => {
    const { result } = renderHook(() =>
      useSortedCandidatesByFrequency([], mockCandidates, []),
    );

    // Should fall back to alphabetical by name: Alice (1), Bob (2), Charlie (3)
    expect(result.current).toEqual([1, 2, 3]);
  });
});
