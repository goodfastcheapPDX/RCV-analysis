"use client";

import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShareLink } from "@/components/ShareLink";
import { Button } from "@/components/ui/button";
import * as N from "@/components/ui/navigation-menu";
import { Separator } from "@/components/ui/separator";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Brand and Navigation */}
        <N.NavigationMenu>
          <N.NavigationMenuList>
            <N.NavigationMenuLink asChild>
              <Link href="/">Ranked Elections</Link>
            </N.NavigationMenuLink>

            <N.NavigationMenuItem>
              <N.NavigationMenuLink asChild>
                <Link href="/e">Elections</Link>
              </N.NavigationMenuLink>
            </N.NavigationMenuItem>
            <N.NavigationMenuItem>
              <N.NavigationMenuLink asChild>
                <Link href="/learn" className="prose-a transition-colors">
                  Learn
                </Link>
              </N.NavigationMenuLink>
            </N.NavigationMenuItem>
            <N.NavigationMenuItem>
              <N.NavigationMenuLink asChild>
                <Link href="/about" className="prose-a transition-colors">
                  About
                </Link>
              </N.NavigationMenuLink>
            </N.NavigationMenuItem>
          </N.NavigationMenuList>
        </N.NavigationMenu>
      </header>

      {/* Breadcrumbs */}
      <div className="border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      <footer className="grid">
        <Separator className="my-4" />
        <div className="p-4">
          <p>Ranked Elections Analyzer</p>
          <p>
            Comprehensive analysis platform for ranked-choice voting elections
          </p>
        </div>

        <div className="grid p-4">
          <Button variant="link" asChild>
            <Link href="/about">About</Link>
          </Button>
          <Button variant="link" asChild>
            <Link href="/learn">Documentation</Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
