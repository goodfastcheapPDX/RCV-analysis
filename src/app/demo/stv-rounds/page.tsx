"use client";
import { useEffect, useState } from "react";
import { StvRoundsView } from "@/packages/contracts/slices/stv_rounds/view";
import type { StvData } from "./data";
import { getStvData } from "./data";

export default function StvRoundsDemoPage() {
  const [data, setData] = useState<StvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const stvData = await getStvData();
        setData(stvData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">STV Rounds Demo</h1>
            <p className="text-gray-600 mt-2">
              Loading Single Transferable Vote round-by-round visualization...
            </p>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">STV Rounds Demo</h1>
            <p className="text-gray-600 mt-2">
              Single Transferable Vote round-by-round visualization
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-red-800 font-medium mb-2">
              Error Loading Data
            </h3>
            <p className="text-red-700 text-sm mb-4">{error}</p>
            <p className="text-red-600 text-xs">
              Make sure to run the data build commands first:
              <br />
              <code className="bg-red-100 px-2 py-1 rounded mt-1 inline-block">
                npm run build:data && npm run build:data:stv
              </code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">STV Rounds Demo</h1>
            <p className="text-gray-600 mt-2">No STV data available.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">STV Rounds Demo</h1>
          <p className="text-gray-600 mt-2">
            Interactive visualization of Single Transferable Vote election
            rounds. Watch how votes transfer between candidates as the election
            progresses.
          </p>
        </div>

        <StvRoundsView
          roundsData={data.roundsData}
          metaData={data.metaData}
          stats={data.stats}
        />
      </div>
    </div>
  );
}
