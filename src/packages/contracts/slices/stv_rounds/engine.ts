import Decimal from "decimal.js";

type DecimalType = InstanceType<typeof Decimal>;

import type {
  RulesSchema,
  StvMetaOutput,
  StvRoundsOutput,
} from "./index.contract.js";

// Configure Decimal.js for high precision
Decimal.config({ precision: 40, rounding: 4 }); // ROUND_HALF_UP

export interface BallotData {
  BallotID: string;
  candidate_name: string;
  rank_position: number;
}

export interface StvResult {
  rounds: StvRoundsOutput[];
  meta: StvMetaOutput[];
  winners: string[];
}

interface Ballot {
  id: string;
  preferences: string[]; // ordered list of candidate names
}

interface CandidateVotes {
  candidate: string;
  votes: DecimalType;
  weight: DecimalType;
  status: "standing" | "elected" | "eliminated";
  ballots: Array<{ ballot: Ballot; weight: DecimalType }>;
}

interface RoundState {
  round: number;
  quota: DecimalType;
  candidates: Map<string, CandidateVotes>;
  exhausted: DecimalType;
  elected: string[];
  eliminated: string[];
}

/**
 * Pure TypeScript implementation of Single Transferable Vote using Gregory fractional method
 */
export function runSTV(
  ballotsData: BallotData[],
  rules: RulesSchema,
): StvResult {
  // Convert ballot data to internal format
  const ballots = prepareBallots(ballotsData);
  const allCandidates = extractCandidates(ballotsData);

  // Calculate Droop quota
  const totalValidBallots = new Decimal(ballots.length);
  const quota = calculateDroopQuota(totalValidBallots, rules.seats);

  // Initialize first round with first-choice votes
  const currentState = initializeFirstRound(ballots, allCandidates, quota);

  const rounds: StvRoundsOutput[] = [];
  const meta: StvMetaOutput[] = [];
  const winners: string[] = [];

  let roundNumber = 1;

  while (
    winners.length < rules.seats &&
    hasStandingCandidates(currentState.candidates)
  ) {
    // Check for candidates who reached quota
    const newlyElected = electCandidatesAtQuota(currentState, rules.precision);
    winners.push(...newlyElected);

    // Transfer surplus votes from newly elected candidates
    for (const candidate of newlyElected) {
      transferSurplus(currentState, candidate, rules.precision);
    }

    // If no one was elected, check if we should elect remaining candidates or eliminate
    if (newlyElected.length === 0) {
      const standingCandidates = Array.from(
        currentState.candidates.values(),
      ).filter((c) => c.status === "standing");
      const remainingSeats = rules.seats - winners.length;

      // If standing candidates == remaining seats, elect them all
      if (standingCandidates.length === remainingSeats) {
        for (const candidate of standingCandidates) {
          candidate.status = "elected";
          winners.push(candidate.candidate);
          currentState.elected.push(candidate.candidate);
        }
      } else {
        // Otherwise, eliminate the lowest candidate
        const toEliminate = findLowestCandidate(
          currentState.candidates,
          rules.tie_break,
        );
        if (toEliminate) {
          eliminateCandidate(currentState, toEliminate);
        }
      }
    }

    // Record current round state after all changes
    recordRoundResults(currentState, roundNumber, rounds, meta);

    // Break if we have enough winners
    if (winners.length >= rules.seats) {
      break;
    }

    roundNumber++;

    // Safety check to prevent infinite loops
    if (roundNumber > 100) {
      throw new Error("STV counting exceeded maximum rounds (100)");
    }
  }

  return {
    rounds,
    meta,
    winners: winners.slice(0, rules.seats).sort(), // Ensure we return exactly 'seats' winners, sorted
  };
}

function prepareBallots(ballotsData: BallotData[]): Ballot[] {
  const ballotMap = new Map<string, Map<number, string>>();

  // Group by ballot ID and rank position
  for (const row of ballotsData) {
    if (!ballotMap.has(row.BallotID)) {
      ballotMap.set(row.BallotID, new Map());
    }
    ballotMap.get(row.BallotID)?.set(row.rank_position, row.candidate_name);
  }

  // Convert to ordered preference lists
  const ballots: Ballot[] = [];
  for (const [ballotId, ranks] of ballotMap) {
    const preferences: string[] = [];
    const sortedRanks = Array.from(ranks.keys()).sort((a, b) => a - b);
    for (const rank of sortedRanks) {
      const candidate = ranks.get(rank);
      if (candidate) {
        preferences.push(candidate);
      }
    }
    ballots.push({ id: ballotId, preferences });
  }

  return ballots;
}

function extractCandidates(ballotsData: BallotData[]): string[] {
  const candidates = new Set<string>();
  for (const row of ballotsData) {
    candidates.add(row.candidate_name);
  }
  return Array.from(candidates).sort();
}

function calculateDroopQuota(
  totalBallots: DecimalType,
  seats: number,
): DecimalType {
  return totalBallots
    .dividedBy(seats + 1)
    .floor()
    .plus(1);
}

function initializeFirstRound(
  ballots: Ballot[],
  allCandidates: string[],
  quota: DecimalType,
): RoundState {
  const candidates = new Map<string, CandidateVotes>();

  // Initialize all candidates
  for (const candidate of allCandidates) {
    candidates.set(candidate, {
      candidate,
      votes: new Decimal(0),
      weight: new Decimal(1),
      status: "standing",
      ballots: [],
    });
  }

  let exhausted = new Decimal(0);

  // Distribute first-choice votes
  for (const ballot of ballots) {
    const firstChoice = getNextValidPreference(ballot, candidates);
    if (firstChoice) {
      const candidateVotes = candidates.get(firstChoice);
      if (candidateVotes) {
        candidateVotes.votes = candidateVotes.votes.plus(1);
        candidateVotes.ballots.push({ ballot, weight: new Decimal(1) });
      }
    } else {
      exhausted = exhausted.plus(1);
    }
  }

  return {
    round: 1,
    quota,
    candidates,
    exhausted,
    elected: [],
    eliminated: [],
  };
}

function getNextValidPreference(
  ballot: Ballot,
  candidates: Map<string, CandidateVotes>,
): string | null {
  for (const preference of ballot.preferences) {
    const candidate = candidates.get(preference);
    if (candidate && candidate.status === "standing") {
      return preference;
    }
  }
  return null;
}

function hasStandingCandidates(
  candidates: Map<string, CandidateVotes>,
): boolean {
  for (const candidate of candidates.values()) {
    if (candidate.status === "standing") {
      return true;
    }
  }
  return false;
}

function recordRoundResults(
  state: RoundState,
  roundNumber: number,
  rounds: StvRoundsOutput[],
  meta: StvMetaOutput[],
): void {
  // Record candidate results
  for (const candidate of state.candidates.values()) {
    rounds.push({
      round: roundNumber,
      candidate_name: candidate.candidate,
      votes: candidate.votes.toNumber(),
      status: candidate.status,
    });
  }

  // Record round metadata
  meta.push({
    round: roundNumber,
    quota: state.quota.toNumber(),
    exhausted: state.exhausted.toNumber(),
    elected_this_round:
      state.elected.length > 0 ? [...state.elected].sort() : null,
    eliminated_this_round:
      state.eliminated.length > 0 ? [...state.eliminated].sort() : null,
  });

  // Clear round-specific data
  state.elected = [];
  state.eliminated = [];
}

function electCandidatesAtQuota(
  state: RoundState,
  precision: number,
): string[] {
  const elected: string[] = [];
  const precisionDecimal = new Decimal(precision);

  for (const candidate of state.candidates.values()) {
    if (
      candidate.status === "standing" &&
      candidate.votes.gte(state.quota.minus(precisionDecimal))
    ) {
      candidate.status = "elected";
      elected.push(candidate.candidate);
      state.elected.push(candidate.candidate);
    }
  }

  return elected.sort();
}

function transferSurplus(
  state: RoundState,
  candidateName: string,
  precision: number,
): void {
  const candidate = state.candidates.get(candidateName);
  if (!candidate) return;
  const surplus = candidate.votes.minus(state.quota);
  const precisionDecimal = new Decimal(precision);

  if (surplus.lte(precisionDecimal)) {
    return; // No significant surplus to transfer
  }

  // Calculate transfer weight using Gregory method
  const transferWeight = surplus.dividedBy(candidate.votes);

  // Transfer surplus votes
  for (const { ballot, weight } of candidate.ballots) {
    const newWeight = weight.times(transferWeight);
    const nextPreference = getNextValidPreference(ballot, state.candidates);

    if (nextPreference) {
      const targetCandidate = state.candidates.get(nextPreference);
      if (targetCandidate) {
        targetCandidate.votes = targetCandidate.votes.plus(newWeight);
        targetCandidate.ballots.push({ ballot, weight: newWeight });
      }
    } else {
      state.exhausted = state.exhausted.plus(newWeight);
    }
  }

  // Reduce elected candidate's votes to quota
  candidate.votes = state.quota;
  candidate.ballots = []; // Clear ballots as they've been transferred
}

function findLowestCandidate(
  candidates: Map<string, CandidateVotes>,
  tieBreak: "lexicographic" | "random",
): string | null {
  const standing = Array.from(candidates.values()).filter(
    (c) => c.status === "standing",
  );

  if (standing.length === 0) {
    return null;
  }

  // Find minimum vote count
  const minVotes = standing.reduce(
    (min, candidate) => (candidate.votes.lt(min) ? candidate.votes : min),
    standing[0].votes,
  );

  // Find all candidates with minimum votes
  const lowest = standing.filter((c) => c.votes.equals(minVotes));

  if (lowest.length === 1) {
    return lowest[0].candidate;
  }

  // Handle ties with lexicographic ordering
  if (tieBreak === "lexicographic") {
    return lowest.sort((a, b) => a.candidate.localeCompare(b.candidate))[0]
      .candidate;
  }

  // For now, fallback to lexicographic even if random is specified
  return lowest.sort((a, b) => a.candidate.localeCompare(b.candidate))[0]
    .candidate;
}

function eliminateCandidate(state: RoundState, candidateName: string): void {
  const candidate = state.candidates.get(candidateName);
  if (!candidate) return;
  candidate.status = "eliminated";
  state.eliminated.push(candidateName);

  // Transfer all votes to next preferences
  for (const { ballot, weight } of candidate.ballots) {
    const nextPreference = getNextValidPreference(ballot, state.candidates);

    if (nextPreference) {
      const targetCandidate = state.candidates.get(nextPreference);
      if (targetCandidate) {
        targetCandidate.votes = targetCandidate.votes.plus(weight);
        targetCandidate.ballots.push({ ballot, weight });
      }
    } else {
      state.exhausted = state.exhausted.plus(weight);
    }
  }

  // Clear eliminated candidate's votes and ballots
  candidate.votes = new Decimal(0);
  candidate.ballots = [];
}
