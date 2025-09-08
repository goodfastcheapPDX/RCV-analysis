import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildSymmetricGetter,
  getCandidateName,
  getCanonicalPairKey,
  getLastName,
  useSortedCandidates,
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
