import type { Output as TransferMatrixOutput } from "@/contracts/slices/transfer_matrix/index.contract";

export interface SankeyNode {
  id: string;
  name: string;
  round?: number;
  type: "candidate" | "exhausted";
  x: number;
  y: number;
  totalIncoming: number;
  totalOutgoing: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  round: number;
  reason: "elimination" | "surplus";
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  maxRound: number;
  totalVotes: number;
}

export function transformTransferMatrixToSankey(
  transfers: TransferMatrixOutput[],
  options: {
    width?: number;
    height?: number;
    nodeWidth?: number;
    padding?: number;
  } = {},
): SankeyData {
  const { width = 800, height = 600, nodeWidth = 15, padding = 50 } = options;

  // Create links from transfers
  const links: SankeyLink[] = transfers.map((transfer) => ({
    source: transfer.from_candidate_name,
    target: transfer.to_candidate_name || "EXHAUSTED",
    value: transfer.vote_count,
    round: transfer.round,
    reason: transfer.transfer_reason,
  }));

  // Find all unique candidates and their elimination rounds
  const candidateRounds = new Map<string, number>();
  const candidateIncoming = new Map<string, number>();
  const candidateOutgoing = new Map<string, number>();

  // Track when each candidate was eliminated (last round they appear as source)
  transfers.forEach((transfer) => {
    const from = transfer.from_candidate_name;
    const to = transfer.to_candidate_name || "EXHAUSTED";

    candidateRounds.set(
      from,
      Math.max(candidateRounds.get(from) || 0, transfer.round),
    );

    candidateOutgoing.set(
      from,
      (candidateOutgoing.get(from) || 0) + transfer.vote_count,
    );
    candidateIncoming.set(
      to,
      (candidateIncoming.get(to) || 0) + transfer.vote_count,
    );
  });

  // Add exhausted as final "candidate"
  const maxRound = Math.max(...transfers.map((t) => t.round));
  candidateRounds.set("EXHAUSTED", maxRound + 1);

  // Group candidates by elimination round for vertical positioning
  const roundGroups = new Map<number, string[]>();
  candidateRounds.forEach((round, candidate) => {
    if (!roundGroups.has(round)) {
      roundGroups.set(round, []);
    }
    const group = roundGroups.get(round);
    if (group) {
      group.push(candidate);
    }
  });

  // Calculate node positions
  const nodes: SankeyNode[] = [];
  const rounds = Array.from(roundGroups.keys()).sort((a, b) => a - b);
  const xStep = (width - 2 * padding - nodeWidth) / (rounds.length - 1);

  rounds.forEach((round, roundIndex) => {
    const candidates = roundGroups.get(round);
    if (!candidates) return;
    const yStep = (height - 2 * padding) / Math.max(candidates.length - 1, 1);

    candidates
      .sort((a, b) => {
        // Sort by total outgoing votes (descending) to put major candidates at top
        const aOut = candidateOutgoing.get(a) || 0;
        const bOut = candidateOutgoing.get(b) || 0;
        return bOut - aOut;
      })
      .forEach((candidate, candidateIndex) => {
        nodes.push({
          id: candidate,
          name: candidate === "EXHAUSTED" ? "Exhausted Votes" : candidate,
          round: candidate === "EXHAUSTED" ? undefined : round,
          type: candidate === "EXHAUSTED" ? "exhausted" : "candidate",
          x: padding + roundIndex * xStep,
          y:
            candidates.length === 1
              ? height / 2
              : padding + candidateIndex * yStep,
          totalIncoming: candidateIncoming.get(candidate) || 0,
          totalOutgoing: candidateOutgoing.get(candidate) || 0,
        });
      });
  });

  const totalVotes = links.reduce((sum, link) => sum + link.value, 0);

  return {
    nodes,
    links,
    maxRound,
    totalVotes,
  };
}

export function calculateLinkPath(
  sourceNode: SankeyNode,
  targetNode: SankeyNode,
  linkValue: number,
  maxValue: number,
  nodeWidth: number = 15,
): string {
  const sourceX = sourceNode.x + nodeWidth;
  const targetX = targetNode.x;
  const sourceY = sourceNode.y;
  const targetY = targetNode.y;

  // Calculate link thickness based on value (min 2px, max 20px)
  const thickness = Math.max(2, Math.min(20, (linkValue / maxValue) * 20));

  // Control point for smooth curves
  const controlX1 = sourceX + (targetX - sourceX) * 0.3;
  const controlX2 = sourceX + (targetX - sourceX) * 0.7;

  // Create smooth curved path
  return `M ${sourceX} ${sourceY - thickness / 2}
          C ${controlX1} ${sourceY - thickness / 2}, ${controlX2} ${targetY - thickness / 2}, ${targetX} ${targetY - thickness / 2}
          L ${targetX} ${targetY + thickness / 2}
          C ${controlX2} ${targetY + thickness / 2}, ${controlX1} ${sourceY + thickness / 2}, ${sourceX} ${sourceY + thickness / 2}
          Z`;
}

export function getTransferReasonColor(
  reason: "elimination" | "surplus",
): string {
  return reason === "elimination" ? "#ef4444" : "#3b82f6";
}

export function getTransferReasonOpacity(
  reason: "elimination" | "surplus",
): number {
  return reason === "elimination" ? 0.6 : 0.8;
}
