import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RankDistributionCardProps {
  candidateName: string;
}

export function RankDistributionCard({
  candidateName,
}: RankDistributionCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Rank Distribution</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Shows how voters ranked this candidate across all ballot
                    positions. Helps identify whether voters saw this candidate
                    as a first choice, backup option, or compromise pick.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="outline" className="text-xs">
            rank_distribution_by_candidate
          </Badge>
        </div>
        <CardDescription>
          Visual breakdown of ranking patterns for {candidateName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="min-h-[300px] flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
          <div className="text-center space-y-4 p-8">
            <div className="text-lg font-semibold text-muted-foreground">
              Rank Distribution Visualization
            </div>
            <div className="text-sm text-muted-foreground max-w-md">
              This visualization will show how voters ranked {candidateName}{" "}
              across different ballot positions (1st choice, 2nd choice, etc.).
            </div>

            <Alert className="max-w-md mx-auto">
              <AlertDescription className="text-left">
                <strong>Expected Data Contract:</strong>
                <code className="block mt-2 text-xs bg-muted p-2 rounded">
                  {`{
  rank: number;
  count: number;
  pct_all_ballots: number;
  pct_among_rankers: number;
}[]`}
                </code>
              </AlertDescription>
            </Alert>

            <div className="text-xs text-muted-foreground">
              Placeholder component - visualization implementation coming soon
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
