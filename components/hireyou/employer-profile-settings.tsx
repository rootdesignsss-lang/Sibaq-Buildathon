"use client";

import { FormEvent, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import type { CandidateProfile } from "@/lib/jobs";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const maxLogoSize = 5 * 1024 * 1024;
const allowedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function EmployerProfileSettings({
  profile,
  onSaved,
}: {
  profile: CandidateProfile;
  onSaved: (companyName: string) => void;
}) {
  const supabase = getSupabaseBrowserClient();
  const [companyName, setCompanyName] = useState(profile.company_name);
  const [companyBio, setCompanyBio] = useState(profile.company_bio ?? "");
  const [companyCity, setCompanyCity] = useState(profile.company_city ?? "");
  const [companyRegion, setCompanyRegion] = useState(profile.company_region ?? "");
  const [companyWebsite, setCompanyWebsite] = useState(profile.company_website ?? "");
  const [companyLogoUrl, setCompanyLogoUrl] = useState(profile.company_logo_url ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase is not connected. Check your .env.local settings.");
      return;
    }

    const normalizedWebsite = companyWebsite.trim();
    if (normalizedWebsite) {
      try {
        const parsed = new URL(normalizedWebsite);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Unsupported protocol");
      } catch {
        setError("Enter a valid company website starting with http:// or https://.");
        return;
      }
    }
    if (logoFile && (!allowedLogoTypes.has(logoFile.type) || logoFile.size > maxLogoSize)) {
      setError("Choose a PNG, JPEG, or WebP logo up to 5 MB.");
      return;
    }

    setBusy(true);
    setStatus("");
    setError("");
    let uploadedPath = "";
    let nextLogoUrl = companyLogoUrl;

    if (logoFile) {
      const extension = logoFile.type === "image/png" ? "png" : logoFile.type === "image/webp" ? "webp" : "jpg";
      uploadedPath = `${profile.user_id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(uploadedPath, logoFile, { contentType: logoFile.type, upsert: false });

      if (uploadError) {
        setError(`The company logo could not be uploaded: ${uploadError.message}`);
        setBusy(false);
        return;
      }
      nextLogoUrl = supabase.storage.from("company-logos").getPublicUrl(uploadedPath).data.publicUrl;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        company_name: companyName.trim(),
        company_bio: companyBio.trim(),
        company_logo_url: nextLogoUrl,
        company_city: companyCity.trim(),
        company_region: companyRegion.trim(),
        company_website: normalizedWebsite,
      })
      .eq("user_id", profile.user_id);

    if (updateError) {
      const cleanup = uploadedPath
        ? await supabase.storage.from("company-logos").remove([uploadedPath])
        : { error: null };
      setError(
        `Your company profile could not be saved: ${updateError.message}.`
        + (cleanup.error ? " The new logo may remain in storage." : ""),
      );
    } else {
      setCompanyLogoUrl(nextLogoUrl);
      setLogoFile(null);
      onSaved(companyName.trim());
      const { error: jobsUpdateError } = await supabase
        .from("job_vacancies")
        .update({ company_name: companyName.trim() })
        .eq("employer_id", profile.user_id);
      setStatus(
        jobsUpdateError
          ? "Company profile saved, but existing job names could not be refreshed. Please retry or contact support."
          : "Company profile saved. Company name, logo, city, and region appear with your open roles.",
      );
      if (jobsUpdateError) setError(`Your profile is saved, but job listings could not be updated: ${jobsUpdateError.message}`);
    }
    setBusy(false);
  };

  return (
    <form className="employer-profile-form" onSubmit={saveProfile}>
      <p className="workspace-company-note">Complete your public company profile. Only city and region are shown as your location.</p>
      {companyLogoUrl && (
        <div className="employer-logo-preview">
          {/* This public image URL is supplied by the employer's Supabase Storage bucket. */}
          <img src={companyLogoUrl} alt={`${companyName || "Company"} logo`} />
          <span>Current company logo</span>
        </div>
      )}
      <label>
        Company name
        <input required maxLength={120} value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
      </label>
      <label>
        About the company
        <textarea maxLength={1200} rows={4} value={companyBio} onChange={(event) => setCompanyBio(event.target.value)} placeholder="What does your team do, and what is it like to work there?" />
      </label>
      <div className="composer-fields">
        <label>
          City
          <input maxLength={100} value={companyCity} onChange={(event) => setCompanyCity(event.target.value)} placeholder="Kochi" />
        </label>
        <label>
          State / region
          <input maxLength={100} value={companyRegion} onChange={(event) => setCompanyRegion(event.target.value)} placeholder="Kerala" />
        </label>
        <label>
          Website
          <input type="url" maxLength={300} value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} placeholder="https://company.example" />
        </label>
      </div>
      <label className="employer-logo-input">
        <span><ImagePlus size={16} /> Company logo · PNG, JPEG, or WebP · 5 MB max</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setLogoFile(event.currentTarget.files?.[0] ?? null)}
        />
      </label>
      {logoFile && <p className="composer-hint">Selected: {logoFile.name}</p>}
      {error && <p className="job-inline-error" role="alert">{error}</p>}
      {status && <p className="job-inline-success" role="status">{status}</p>}
      <button className="job-apply-button" type="submit" disabled={busy}>
        {busy ? "Saving profile…" : "Save company profile"} <Save size={16} />
      </button>
    </form>
  );
}
