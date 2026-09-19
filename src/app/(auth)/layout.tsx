import { BrandMark } from "@/components/shell/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Centered, focused layout for auth pages — no app chrome. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mb-8">
        <BrandMark />
      </div>
      {children}
    </main>
  );
}
