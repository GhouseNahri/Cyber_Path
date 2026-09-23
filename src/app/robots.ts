import type { MetadataRoute } from "next";

/** Crawler rules: the marketing/auth surfaces are indexable; everything
 *  behind the auth gate (the actual learning app) is not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup", "/portfolio/"],
        disallow: [
          "/roadmap",
          "/session",
          "/history",
          "/skills",
          "/library",
          "/analytics",
          "/career",
          "/projects",
          "/labs",
          "/github",
          "/settings",
          "/onboarding",
          "/forgot-password",
          "/reset-password",
          "/api",
        ],
      },
    ],
  };
}
