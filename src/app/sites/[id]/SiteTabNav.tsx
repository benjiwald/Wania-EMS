"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

interface Tab {
  key: string;
  label: string;
  param: string;
}

const TABS: Tab[] = [
  { key: "overview", label: "Übersicht",      param: "overview" },
  { key: "setup",    label: "Inbetriebnahme", param: "setup" },
  { key: "logs",     label: "Protokoll",      param: "logs" },
];

function TabNavInner() {
  const pathname  = usePathname();
  const params    = useSearchParams();
  const activeTab = params.get("tab") ?? "overview";

  return (
    <nav className="flex gap-1 border-b border-border/50 mb-8">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Link
            key={tab.key}
            href={`${pathname}?tab=${tab.param}`}
            className={[
              "px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
              isActive
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-b-2 border-transparent",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function SiteTabNav({ siteId: _siteId }: { siteId: string }) {
  return (
    <Suspense fallback={null}>
      <TabNavInner />
    </Suspense>
  );
}
