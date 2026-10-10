import type { Metadata } from "next";
import { Suspense } from "react";
import { cachedStories } from "@/lib/cached-content";
import { MightsText } from "@acme/ui/mights";
import { StoriesScreen } from "@acme/app/features/site/stories/StoriesScreen.tsx";
import { ContentLoader } from "@acme/app/features/site/content/ContentLoader.tsx";

export const metadata: Metadata = {
  title: "Stories",
  description:
    "The history behind Harlem blocks, attached to the places where it happened.",
};

// Suspense like /walks: the cached read can miss at build time (no database in CI), and
// Next refuses to prerender a page that awaits it outside a boundary.
export default function StoriesPage() {
  return (
    <Suspense
      fallback={<ContentLoader label="Checking for published stories" />}
    >
      <StoriesContent />
    </Suspense>
  );
}

async function StoriesContent() {
  return <StoriesScreen result={await cachedStories()} />;
}
