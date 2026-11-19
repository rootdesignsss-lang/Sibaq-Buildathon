import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080908] px-4 text-white">
      <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-[#c7f54b]">404</p>
        <h1 className="mt-4 text-4xl font-semibold">This page could not be found.</h1>
        <p className="mt-4 text-white/65">Return home or explore open roles to keep going.</p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/" className="rounded-full bg-[#c7f54b] px-4 py-2 font-medium text-black">
            Home
          </Link>
          <Link href="/challenges" className="rounded-full border border-white/10 px-4 py-2 font-medium text-white/80 hover:text-white">
            Find work
          </Link>
        </div>
      </div>
    </main>
  );
}
