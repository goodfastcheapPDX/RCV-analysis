"use client";

import { Info } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Output as TransferMatrixOutput } from "@/contracts/slices/transfer_matrix/index.contract";

interface TransferMatrixCardProps {
  candidateName: string;
  data: TransferMatrixOutput[];
}

export function TransferMatrixCard({
  candidateName,
  data,
}: TransferMatrixCardProps) {
  // Separate transfers into incoming and outgoing
  const { incomingTransfers, outgoingTransfers } = useMemo(() => {
    const incoming = data.filter(
      (row) => row.to_candidate_name === candidateName,
    );
    const outgoing = data.filter(
      (row) => row.from_candidate_name === candidateName,
    );

    return {
      incomingTransfers: incoming.sort((a, b) => a.round - b.round),
      outgoingTransfers: outgoing.sort((a, b) => a.round - b.round),
    };
  }, [data, candidateName]);

  const hasTransfers =
    incomingTransfers.length > 0 || outgoingTransfers.length > 0;

  // Helper function to format vote counts
  const formatVotes = (count: number) => {
    return count.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  // Helper function to format transfer reason
  const formatReason = (reason: string) => {
    return reason === "elimination" ? "Elimination" : "Surplus";
  };

  // Empty state
  if (!hasTransfers) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Vote Transfers</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Shows how votes transferred to and from this candidate
                      during the STV elimination process. Includes both
                      elimination transfers and surplus distributions.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge variant="outline" className="text-xs">
              transfer_matrix
            </Badge>
          </div>
          <CardDescription>
            Breakdown of vote transfers involving {candidateName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-[280px] flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
            <div className="text-center space-y-4 p-8">
              <div className="text-lg font-semibold text-muted-foreground">
                No Transfer Data
              </div>
              <div className="text-sm text-muted-foreground max-w-md">
                This candidate had no vote transfers during the election
                process. This could indicate they were never eliminated or
                elected.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Vote Transfers</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Shows how votes transferred to and from this candidate
                    during the STV elimination process. Includes both
                    elimination transfers and surplus distributions.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="outline" className="text-xs">
            transfer_matrix
          </Badge>
        </div>
        <CardDescription>
          Breakdown of vote transfers involving {candidateName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Incoming Transfers */}
        {incomingTransfers.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              Votes Received ({incomingTransfers.length} transfers)
            </h3>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Round</TableHead>
                    <TableHead>From Candidate</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right w-24">Votes</TableHead>
                    <TableHead className="text-right w-20">Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomingTransfers.map((transfer) => (
                    <TableRow
                      key={`in-${transfer.round}-${transfer.from_candidate_name}-${transfer.transfer_reason}`}
                    >
                      <TableCell className="font-medium">
                        {transfer.round}
                      </TableCell>
                      <TableCell>{transfer.from_candidate_name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transfer.transfer_reason === "elimination"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {formatReason(transfer.transfer_reason)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatVotes(transfer.vote_count)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {(transfer.transfer_weight * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Outgoing Transfers */}
        {outgoingTransfers.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              Votes Transferred ({outgoingTransfers.length} transfers)
            </h3>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Round</TableHead>
                    <TableHead>To Candidate</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right w-24">Votes</TableHead>
                    <TableHead className="text-right w-20">Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outgoingTransfers.map((transfer) => (
                    <TableRow
                      key={`out-${transfer.round}-${transfer.to_candidate_name || "exhausted"}-${transfer.transfer_reason}`}
                    >
                      <TableCell className="font-medium">
                        {transfer.round}
                      </TableCell>
                      <TableCell>
                        {transfer.to_candidate_name || (
                          <span className="text-muted-foreground italic">
                            Exhausted
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transfer.transfer_reason === "elimination"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {formatReason(transfer.transfer_reason)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatVotes(transfer.vote_count)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {(transfer.transfer_weight * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
