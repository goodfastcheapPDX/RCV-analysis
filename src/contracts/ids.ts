import { z } from "zod";

// Core ID types for the multi-election system
export type ElectionId = `${string}-${string}-${string}`; // e.g. "portland-20241105-gen"
export type ContestId = `${string}-${number}seat`; // e.g. "d2-3seat"
export type DistrictId = `d${number}`; // e.g. "d2"

// Zod schemas for validation
export const ElectionIdSchema = z
  .string()
  .regex(
    /^[a-z]+-\d{8}-[a-z]+$/,
    "ElectionId must follow pattern: jurisdiction-YYYYMMDD-type",
  );
export const ContestIdSchema = z
  .string()
  .regex(/^d\d+-\d+seat$/, "ContestId must follow pattern: dN-Nseat");
export const DistrictIdSchema = z
  .string()
  .regex(/^d\d+$/, "DistrictId must follow pattern: dN");

// ID generation functions
export function electionIdFrom(options: {
  jurisdiction: "portland";
  date: string; // ISO format YYYY-MM-DD
  kind: "gen" | "spec" | "primary";
}): ElectionId {
  const dateFormatted = options.date.replaceAll("-", "");
  return `${options.jurisdiction}-${dateFormatted}-${options.kind}` as ElectionId;
}

export function contestIdFrom(options: {
  districtId: DistrictId;
  seatCount: number;
}): ContestId {
  return `${options.districtId}-${options.seatCount}seat` as ContestId;
}

// Common identity object used across all slices
export const IdentitySchema = z.object({
  election_id: ElectionIdSchema,
  contest_id: ContestIdSchema,
  district_id: DistrictIdSchema,
  seat_count: z.number().int().positive(),
});

export type Identity = z.infer<typeof IdentitySchema>;

// Utility to create identity from IDs
export function createIdentity(
  electionId: ElectionId,
  contestId: ContestId,
  districtId: DistrictId,
  seatCount: number,
): Identity {
  return {
    election_id: electionId,
    contest_id: contestId,
    district_id: districtId,
    seat_count: seatCount,
  };
}
