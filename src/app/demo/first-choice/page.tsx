"use client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { Output } from "@/packages/contracts/slices/first_choice_breakdown/index.contract";
import { FirstChoiceBreakdownView } from "@/packages/contracts/slices/first_choice_breakdown/view";

export default function FirstChoiceDemoPage() {
  const [data, setData] = useState<Output[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/first-choice-data");

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const firstChoiceData: Output[] = await response.json();
        setData(firstChoiceData);
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
            <h1 className="text-3xl font-bold">First Choice Breakdown Demo</h1>
            <p className="text-gray-600 mt-2">
              Loading first-choice vote breakdown visualization...
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
            <h1 className="text-3xl font-bold">First Choice Breakdown Demo</h1>
            <p className="text-gray-600 mt-2">
              Visualization of candidate first-choice vote counts from
              ranked-choice voting data.
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
                npm run build:data && npm run build:data:firstchoice
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
            <h1 className="text-3xl font-bold">First Choice Breakdown Demo</h1>
            <p className="text-gray-600 mt-2">
              No first choice data available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">First Choice Breakdown Demo</h1>
          <p className="text-gray-600 mt-2">
            Visualization of candidate first-choice vote counts from
            ranked-choice voting data.
          </p>
        </div>

        <FirstChoiceBreakdownView data={data} />
      </div>
    </div>
  );
}
