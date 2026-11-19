import Link from "next/link";
import { AuthPanel } from "@/components/hireyou/auth-panel";

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-[#080908] px-4 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#c7f54b]">HIREYOU</p>
            <h1 className="mt-3 text-4xl font-semibold">Access your workspace</h1>
          </div>
          <Link href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-[#c7f54b] hover:text-white">
            Home
          </Link>
        </div>
        <div className="mx-auto max-w-xl">
          <AuthPanel />
        </div>
      </div>
    </main>
  );
}
