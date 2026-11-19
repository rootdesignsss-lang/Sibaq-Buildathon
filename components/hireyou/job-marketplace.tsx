"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUpRight, Search } from "lucide-react";
import { getEmployerProfile } from "@/lib/jobs";
import type { JobListing } from "@/lib/jobs";

const categoryImages: Record<string, string> = {
  Design: "photo-1558655146-9f40138edfeb",
  Engineering: "photo-1559028006-448665bd7c7f",
  Product: "photo-1553877522-43269d4ea984",
  Marketing: "photo-1533750349088-cd871a92f312",
  Data: "photo-1551288049-bebda4e38f71",
  default: "photo-1521737711867-e3b97375f902",
};

function formatDeadline(deadline: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(deadline));
}

export function JobMarketplace({
  jobs,
  loadError,
}: {
  jobs: JobListing[];
  loadError?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All work");

  const categories = useMemo(
    () => ["All work", ...new Set(jobs.map((job) => job.category))],
    [jobs],
  );
  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesCategory = category === "All work" || job.category === category;
      const searchable = `${job.title} ${job.company_name} ${job.description} ${job.category}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [category, jobs, query]);

  return (
    <main className="market-shell">
      <header className="market-header">
        <Link href="/" className="market-brand">HIREYOU<span>.</span></Link>
        <nav aria-label="Marketplace navigation">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Your workspace</Link>
          <Link href="/auth" className="market-nav-cta">Join HIREYOU <ArrowUpRight size={15} /></Link>
        </nav>
      </header>

      <section className="market-hero">
        <div className="market-hero-copy">
          <p className="market-eyebrow">The work is the interview</p>
          <h1>FIND WORK<br />THAT <span>FITS.</span></h1>
          <p>Explore real openings, take a short job-specific work sample, and let your skills make the introduction.</p>
          <a href="#open-roles" className="market-scroll-link">Explore open roles <ArrowDown size={16} /></a>
        </div>
        <motion.div
          className="market-hero-image"
          role="img"
          aria-label="A team working together at a modern workspace"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <span>Less screening.<br /><strong>More showing.</strong></span>
        </motion.div>
      </section>

      <section className="market-listing-section" id="open-roles">
        <div className="market-listing-heading">
          <div>
            <p className="market-eyebrow">Made for what you can do</p>
            <h2>Open opportunities</h2>
          </div>
          <p>Each role includes a small, relevant task. No CV required to get started.</p>
        </div>

        <div className="market-controls">
          <label className="market-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search roles, companies, skills"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search jobs"
            />
          </label>
          <div className="market-categories" aria-label="Filter by work area">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={category === item}
                className={category === item ? "is-active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {loadError ? (
          <div className="market-state market-error" role="alert">
            <h3>We couldn&apos;t load the opportunities.</h3>
            <p>{loadError}</p>
            <Link href="/auth">Return to your workspace <ArrowRight size={15} /></Link>
          </div>
        ) : filteredJobs.length > 0 ? (
          <div className="market-job-grid">
            {filteredJobs.map((job, index) => {
              const image = categoryImages[job.category] ?? categoryImages.default;
              const employer = getEmployerProfile(job.employer);
              return (
                <motion.article
                  key={job.id}
                  className="market-job-card"
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.12 }}
                  transition={{ duration: 0.5, delay: (index % 3) * 0.08 }}
                  whileHover={{ y: -6 }}
                >
                  <Link href={`/challenges/${job.id}`} className="market-job-link">
                    <div
                      className="market-job-image"
                      role="img"
                      aria-label={`${job.category} work at ${job.company_name}`}
                      style={{
                        backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.03),rgba(0,0,0,.45)),url(https://images.unsplash.com/${image}?auto=format&fit=crop&w=900&q=85)`,
                      }}
                    >
                      <span className="market-job-category">{job.category}</span>
                      <span className="market-job-arrow"><ArrowUpRight size={17} /></span>
                    </div>
                    <div className="market-job-content">
                      <div className="market-job-company">
                        {employer?.company_logo_url
                          ? <img src={employer.company_logo_url} alt="" />
                          : <span>{(job.company_name || "H").slice(0, 1).toUpperCase()}</span>}
                        <div>
                          <p className="market-company">{job.company_name || "Hiring team"} · {job.location}</p>
                          {(employer?.company_city || employer?.company_region) && (
                            <small>{[employer?.company_city, employer?.company_region].filter(Boolean).join(", ")}</small>
                          )}
                        </div>
                      </div>
                      <h3>{job.title}</h3>
                      <p className="market-job-description">{job.description}</p>
                      <div className="market-job-footer">
                        <span>{job.employment_type}</span>
                        <span>Apply by {formatDeadline(job.deadline)}</span>
                      </div>
                      <div className="market-task-teaser">
                        <span>{job.task_config.tasks?.length ?? 1} TASK{(job.task_config.tasks?.length ?? 1) === 1 ? "" : "S"}</span>
                        <strong>{job.task_title}</strong>
                        <span className="market-task-cta">See the task <ArrowRight size={14} /></span>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <div className="market-state">
            <h3>{jobs.length ? "No roles match that search." : "The next opportunity starts here."}</h3>
            <p>
              {jobs.length
                ? "Try another search or choose a different work area."
                : "Employers can create the first role from their workspace. Check back soon."}
            </p>
            {jobs.length > 0 && (
              <button type="button" onClick={() => { setQuery(""); setCategory("All work"); }}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </section>

      <footer className="market-footer">
        <Link href="/" className="market-brand">HIREYOU<span>.</span></Link>
        <p>Let the work speak for itself.</p>
      </footer>
    </main>
  );
}
