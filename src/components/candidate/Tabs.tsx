"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Output as RankDistributionOutput } from "@/contracts/slices/rank_distribution_by_candidate/index.contract";
import { RankDistributionCard } from "./RankDistributionCard";

interface CandidateTabsProps {
  electionId: string;
  contestId: string;
  candidateId: string;
  candidateName: string;
  currentTab: string;
  rankDistributionData: RankDistributionOutput[];
}

export function CandidateTabs({
  electionId,
  contestId,
  candidateId,
  candidateName,
  currentTab,
  rankDistributionData,
}: CandidateTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value === "rank") {
      // Default tab - remove from URL
      params.delete("tab");
    } else {
      params.set("tab", value);
    }

    const queryString = params.toString();
    const newUrl = `/e/${electionId}/c/${contestId}/cand/${candidateId}${
      queryString ? `?${queryString}` : ""
    }`;

    router.push(newUrl);
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="rank">Rank Distribution</TabsTrigger>
        <TabsTrigger value="rounds">Rounds</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Candidate Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-lg font-semibold mb-2">
                Overview Coming Soon
              </div>
              <div className="text-sm">
                This section will contain summary statistics and key insights
                for {candidateName}.
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="rank" className="space-y-4">
        <RankDistributionCard
          candidateName={candidateName}
          data={rankDistributionData}
        />
      </TabsContent>

      <TabsContent value="rounds" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Round-by-Round Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-lg font-semibold mb-2">
                Rounds Analysis Coming Soon
              </div>
              <div className="text-sm">
                This section will show how {candidateName} performed in each
                round of the STV election, including vote transfers.
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
