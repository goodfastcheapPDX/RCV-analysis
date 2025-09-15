"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logError, loggers } from "@/lib/logger";

export function ShareLink() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      // Copy the current URL with all query parameters
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);

      setCopied(true);
      toast.success("Link copied to clipboard!");

      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logError(loggers.ui, error, { context: "Failed to copy link" });
      toast.error("Failed to copy link");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      className="gap-2 -foreground hover:text-primary"
      aria-label="Share current page"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          <span className="hidden sm:inline-block">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline-block">Share</span>
        </>
      )}
    </Button>
  );
}
