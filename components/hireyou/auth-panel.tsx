"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export function AuthPanel() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [role, setRole] = useState<"candidate" | "employer">("candidate");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const interestOptions = ["Design", "Engineering", "Product", "Marketing", "Data", "Operations"];

  const toggleInterest = (interest: string) => {
    setInterests((selected) =>
      selected.includes(interest)
        ? selected.filter((item) => item !== interest)
        : selected.length < 5
          ? [...selected, interest]
          : selected,
    );
  };

  if (!supabase) {
    return (
      <div className="rounded-3xl border border-[#b7fb09]/25 bg-[#b7fb09]/5 p-6 text-sm text-[#edffb0] shadow-sm">
        Configure your Supabase credentials in <code>.env.local</code> to enable authentication.
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("Authenticating...");

    try {
      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }
      } else {
        if (role === "candidate" && interests.length === 0) {
          throw new Error("Choose at least one area of work you are interested in.");
        }
        if (role === "employer" && !companyName.trim()) {
          throw new Error("Enter your company name to create an employer account.");
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name: fullName,
              bio: bio.trim(),
              interests,
              company_name: companyName.trim(),
              role,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (signUpData.session) {
          router.push("/dashboard");
          router.refresh();
          return;
        }

        setStatus(
          "Your account has been saved. Confirm your email once using the link we sent, then return here to sign in with the same email and password whenever you visit.",
        );
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const destination =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : "/dashboard";
      router.push(destination);
      router.refresh();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Could not complete authentication.";
      setError(message);
      setStatus("");
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setStatus("Sending reset email...");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (resetError) {
        throw resetError;
      }

      setStatus("Password reset instructions were sent to your email.");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Password reset request failed.";
      setError(message);
      setStatus("");
    }
  };

  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#111210]/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-5 flex rounded-full border border-white/10 bg-white/5 p-1">
        {(["sign-in", "sign-up"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === value ? "bg-[#c7f54b] text-black" : "text-slate-300"
            }`}
          >
            {value === "sign-in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="mb-5 flex gap-2">
        {(["candidate", "employer"] as const).map((candidateRole) => (
          <button
            key={candidateRole}
            type="button"
            onClick={() => setRole(candidateRole)}
            className={`flex-1 rounded-full border px-3 py-2 text-sm capitalize transition ${
              role === candidateRole
                ? "border-[#c7f54b] bg-[#c7f54b]/10 text-[#e5ff9b]"
                : "border-white/10 bg-transparent text-slate-300"
            }`}
          >
            {candidateRole === "candidate" ? "Looking for work" : "Hiring for my company"}
          </button>
        ))}
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "sign-up" && (
          <>
            <label className="block text-sm">
              <span className="mb-2 block text-slate-300">Full name</span>
              <input
                required
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-[#c7f54b]"
                placeholder="Alex Morgan"
              />
            </label>
            {role === "candidate" ? (
              <>
                <label className="block text-sm">
                  <span className="mb-2 block text-slate-300">A little about you</span>
                  <textarea
                    value={bio}
                    maxLength={600}
                    onChange={(event) => setBio(event.target.value)}
                    className="min-h-24 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#c7f54b]"
                    placeholder="What kind of work do you love doing?"
                  />
                </label>
                <fieldset>
                  <legend className="mb-2 text-sm text-slate-300">Areas you want to work in</legend>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((interest) => {
                      const selected = interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleInterest(interest)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${
                            selected
                              ? "border-[#c7f54b] bg-[#c7f54b]/15 text-[#efffbd]"
                              : "border-white/10 text-slate-300 hover:border-white/30"
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </>
            ) : (
              <label className="block text-sm">
                <span className="mb-2 block text-slate-300">Company name</span>
                <input
                  required
                  maxLength={120}
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#c7f54b]"
                  placeholder="Your company"
                />
              </label>
            )}
          </>
        )}

        <label className="block text-sm">
          <span className="mb-2 block text-slate-300">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#c7f54b]"
            placeholder="you@example.com"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-2 block text-slate-300">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#c7f54b]"
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-2xl bg-[#c7f54b] px-4 py-3 text-base font-semibold text-black shadow-lg shadow-[#c7f54b]/20 transition hover:brightness-110"
        >
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-300">
        <button type="button" onClick={handlePasswordReset} className="underline-offset-4 hover:underline">
          Reset password
        </button>
        {mode === "sign-in" && (
          <span className="text-slate-500">
            {role === "candidate" ? "Candidate" : "Employer"} sign in
          </span>
        )}
      </div>

      {error && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {status && <p className="mt-4 text-sm text-emerald-300">{status}</p>}
    </div>
  );
}
