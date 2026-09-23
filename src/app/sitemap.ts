import type { MetadataRoute } from "next";

/** Sitemap of genuinely public surfaces only. Portfolio pages belong here
 *  in principle, but they are opt-in per user and private by default —
 *  so no portfolio URLs are fabricated. Update `base` when the app lands
 *  on a production domain. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "http://localhost:3000";
  const now = new Date();
  return [
    { url: `${base}/`, changeFrequency: "weekly" as const, priority: 1, lastModified: now },
    { url: `${base}/login`, changeFrequency: "yearly" as const, priority: 0.3, lastModified: now },
    { url: `${base}/signup`, changeFrequency: "yearly" as const, priority: 0.5, lastModified: now },
  ];
}
