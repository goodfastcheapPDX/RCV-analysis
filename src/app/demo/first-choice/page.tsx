"use client";
import { useEffect, useState } from "react";
import type { Output } from "@/packages/contracts/slices/first_choice_breakdown/index.contract";
import { FirstChoiceBreakdownView } from "@/packages/contracts/slices/first_choice_breakdown/view";
import { getFirstChoiceData } from "./data";

export default function FirstChoiceDemoPage() {
  const [data, setData] = useState<Output[]>([]);
  useEffect(() => {
    (async () => {
      const data = await getFirstChoiceData();
      setData(data);
    })();
  }, []);

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
