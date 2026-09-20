import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { getLibrary } from "@/lib/resources/queries";
import type { LibraryFilters, ResourceItem, LibraryFacets } from "@/lib/resources/types";
import { LibraryFilterBar } from "./LibraryFilterBar";
import { ResourceList } from "@/components/resources/ResourceList";

export const metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string): string | null => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : null;
  };

  const filters: LibraryFilters = {
    topic: one("topic"),
    type: one("type"),
    difficulty: one("difficulty"),
    free: one("free") === "free" ? true : one("free") === "paid" ? false : null,
    official: one("official") === "1",
    status: ((): LibraryFilters["status"] => {
      const s = one("status");
      return s === "saved" || s === "done" || s === "not_started" ? s : "all";
    })(),
  };

  const library = await getLibrary();

  return (
    <div className="space-y-6">
      <section aria-labelledby="library-heading" className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Resource library</p>
        <h1 id="library-heading" className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Curated sources, <span className="text-gradient">tracked</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          Every link is attributed to its provider with an honest verification state — nothing here is presented as
          verified when it isn&apos;t.
        </p>
      </section>

      {!library.ok ? (
        <Card>
          <CardHeader title="Library unavailable" subtitle="Migrations not applied" />
          <EmptyState
            title="The resources table isn't seeded yet"
            body="Run migration 0005 in the Supabase SQL Editor (or ask me to apply it via the connector) and the library comes alive."
          />
        </Card>
      ) : (
        <LibraryView items={library.items} facets={library.facets} filters={filters} />
      )}
    </div>
  );
}

function applyFilters(items: ResourceItem[], filters: LibraryFilters): ResourceItem[] {
  return items.filter((r) => {
    if (filters.topic && r.topic_slug !== filters.topic) return false;
    if (filters.type && r.type !== filters.type) return false;
    if (filters.difficulty && r.difficulty !== filters.difficulty) return false;
    if (filters.free === true && !r.is_free) return false;
    if (filters.free === false && r.is_free) return false;
    if (filters.official && !r.is_official) return false;
    if (filters.status === "saved" && r.user_status !== "saved") return false;
    if (filters.status === "done" && r.user_status !== "done") return false;
    if (filters.status === "not_started" && r.user_status !== null) return false;
    return true;
  });
}

function LibraryView({
  items,
  facets,
  filters,
}: {
  items: ResourceItem[];
  facets: LibraryFacets;
  filters: LibraryFilters;
}) {
  const visible = applyFilters(items, filters);
  const activeCount =
    (filters.topic ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.difficulty ? 1 : 0) +
    (filters.free !== null ? 1 : 0) +
    (filters.official ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0);

  return (
    <div className="space-y-5">
      <LibraryFilterBar facets={facets} current={filters} resultCount={visible.length} total={items.length} />

      {items.length === 0 ? (
        <Card>
          <CardHeader title="No resources seeded" subtitle="Empty library" />
          <EmptyState
            title="The library is empty"
            body="Migration 0005 seeds 22 curated resources across the seeded phases. Apply it and this page fills up."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`${visible.length} resource${visible.length === 1 ? "" : "s"}`}
            subtitle={activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} active` : "No filters — showing everything"}
            action={<Badge tone="neutral">{items.length} total</Badge>}
          />
          <ResourceList items={visible} />
        </Card>
      )}
    </div>
  );
}
