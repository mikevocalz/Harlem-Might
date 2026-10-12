import type { Metadata } from "next";
import { Suspense } from "react";
import { cachedWalks } from "@/lib/cached-content";
import { WalksScreen } from "@acme/app/features/site/walks/WalksScreen.tsx";

export const metadata: Metadata = {
  title: "Walks",
  description:
    "Walking routes through Harlem that connect places into one story.",
};

export default function WalksPage() {
  return (
    <Suspense fallback={<WalksScreen result={undefined} />}>
      <WalksContent />
    </Suspense>
  );
}

async function WalksContent() {
  return <WalksScreen result={await cachedWalks()} />;
}
