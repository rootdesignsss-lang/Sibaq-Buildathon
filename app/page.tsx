"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Menu,
  X,
} from "lucide-react";
import {
  candidateBenefits,
  employerSignals,
} from "@/lib/site-data";

const reveal = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

const workSampleImages = [
  "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1559028006-448665bd7c7f?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1400&q=85",
];

const workSamples = [
  {
    category: "Product thinking",
    title: "Make the call",
    summary: "Prioritize a real product decision and explain the trade-offs you see.",
    tags: ["Prioritization", "Problem solving"],
  },
  {
    category: "Engineering",
    title: "Fix what matters",
    summary: "Work through a practical bug scenario and choose a clear, maintainable fix.",
    tags: ["Debugging", "Craft"],
  },
  {
    category: "Creative work",
    title: "Shape the idea",
    summary: "Respond to a creative brief with a thoughtful direction and strong rationale.",
    tags: ["Creative thinking", "Communication"],
  },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1450;
    const timer = window.setTimeout(() => setShowIntro(false), delay);
    return () => window.clearTimeout(timer);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <MotionConfig reducedMotion="user">
      <main className="site-shell">
      <AnimatePresence>
        {showIntro && (
          <motion.div
            className="intro-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            aria-label="HIREYOU loading"
            role="status"
          >
            <motion.div
              className="intro-logo-wrap"
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                src="/hireyou-logo.png"
                alt="HIREYOU"
                width={610}
                height={234}
                className="intro-logo"
                loading="eager"
              />
            </motion.div>
            <motion.div
              className="intro-progress"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.15, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <header className="site-header">
        <Link href="/" className="brand-mark" aria-label="HIREYOU home" onClick={closeMenu}>
          <Image
            src="/hireyou-logo.png"
            alt="HIREYOU"
            width={610}
            height={234}
            className="brand-logo"
            loading="eager"
          />
        </Link>

        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>

        <nav className={`site-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
          <a href="#work" onClick={closeMenu}>The work</a>
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
          <Link href="/challenges" onClick={closeMenu}>Find work</Link>
          <Link href="/dashboard" onClick={closeMenu}>Dashboard</Link>
          <Link href="/auth" className="nav-cta" onClick={closeMenu}>
            Get started <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <motion.p className="eyebrow lime" {...reveal}>
            Hiring, with proof.
          </motion.p>
          <motion.h1 {...reveal} transition={{ ...reveal.transition, delay: 0.08 }}>
            GOOD HIRES
            <br />
            AREN&apos;T A <span>GUESS.</span>
          </motion.h1>
          <motion.p
            className="hero-description"
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.16 }}
          >
            Real opportunities. Relevant work. A clearer way to find the people who can
            actually do the job.
          </motion.p>
          <motion.div
            className="hero-actions"
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.24 }}
          >
            <Link href="/challenges" className="button button-lime">
              Browse open work <ArrowRight size={17} />
            </Link>
            <a href="#how-it-works" className="text-link">
              See how it works <ArrowDown size={15} />
            </a>
          </motion.div>
          <motion.div
            className="hero-proof"
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.32 }}
          >
            <div className="proof-avatars" aria-hidden="true">
              {[
                "photo-1534528741775-53994a69daeb",
                "photo-1500648767791-00dcc994a43e",
                "photo-1531123897727-8f129e1688ce",
              ].map((photo) => (
                <span
                  key={photo}
                  className="proof-avatar"
                  style={{
                    backgroundImage: `url(https://images.unsplash.com/${photo}?auto=format&fit=crop&w=100&q=80)`,
                  }}
                />
              ))}
            </div>
            <span>Built around the work that gets you hired.</span>
          </motion.div>
        </div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="hero-photo"
            role="img"
            aria-label="Creative team collaborating around a design workspace"
            style={{
              backgroundImage:
                "linear-gradient(180deg, transparent 48%, rgba(0,0,0,.7)), url(https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=90)",
            }}
          >
            <span className="photo-caption">Talent looks different when you see the work.</span>
          </div>
          <motion.div
            className="floating-score"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="score-check"><Check size={17} /></span>
            <span><strong>Proof over promises</strong><small>Skills, seen in action</small></span>
          </motion.div>
          <div className="hero-index">01 <span>/</span> 04</div>
          <div className="hero-lime-shape" aria-hidden="true" />
        </motion.div>
      </section>

      <section className="trust-strip" aria-label="Hiring team types">
        <p>Built for teams across</p>
        <div className="trust-names">
          {["Product teams", "Remote-first teams", "Growing companies"].map((name, index) => (
            <span key={name}>
              {index === 0 && <span className="trust-symbol">✳</span>}
              {index === 1 && <span className="trust-symbol">◈</span>}
              {index === 2 && <span className="trust-symbol">↗</span>}
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="work-section section-pad" id="work">
        <motion.div className="section-heading" {...reveal}>
          <div>
            <p className="eyebrow lime">Not another portfolio exercise</p>
            <h2>Show how you<br /><span>think at work.</span></h2>
          </div>
          <p className="section-intro">
            Each hiring team creates a short work sample for its own role. These
            are examples of the practical decisions you might get to explore.
          </p>
        </motion.div>

        <div className="project-grid">
          {workSamples.map((sample, index) => (
            <motion.article
              key={sample.category}
              className={`project-card project-card-${index + 1}`}
              initial={{ opacity: 0, y: 34 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.18 }}
              transition={{ duration: 0.65, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -7 }}
            >
              <Link href="/challenges" className="project-link">
                <div
                  className="project-image"
                  role="img"
                  aria-label={`${sample.category} work sample`}
                  style={{ backgroundImage: `url(${workSampleImages[index % workSampleImages.length]})` }}
                >
                  <span className="project-number">0{index + 1}</span>
                  <span className="project-arrow"><ArrowUpRight size={18} /></span>
                </div>
                <div className="project-meta">
                  <div>
                    <p className="eyebrow">{sample.category}</p>
                    <h3>{sample.title}</h3>
                  </div>
                  <span>Role-based</span>
                </div>
                <p className="project-summary">{sample.summary}</p>
                <div className="tag-row">
                  {sample.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </Link>
            </motion.article>
          ))}
        </div>

        <div className="section-bottom-link">
          <Link href="/challenges" className="text-link">
            Browse open roles <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="statement-band">
        <motion.div {...reveal}>
          <p className="eyebrow">A better signal for everyone</p>
          <h2>LESS GUESSWORK.<br /><span>MORE GREAT WORK.</span></h2>
        </motion.div>
        <motion.p {...reveal} transition={{ ...reveal.transition, delay: 0.12 }}>
          Candidates get a fairer way to show what they can do. Employers get a
          stronger signal than a CV alone. Everyone gets a more human hiring
          experience.
        </motion.p>
      </section>

      <section className="how-section section-pad" id="how-it-works">
        <motion.div className="section-heading" {...reveal}>
          <div>
            <p className="eyebrow lime">Clear from the start</p>
            <h2>Good work.<br /><span>Good people.</span></h2>
          </div>
          <p className="section-intro">
            One thoughtful process brings proven skills and the right
            opportunity closer together.
          </p>
        </motion.div>

        <div className="steps-grid">
          {[
            ["01", "Choose a role", "Find an open position that fits your interests and the work you want to do."],
            ["02", "Show your thinking", "Submit your work and make your approach part of the story."],
            ["03", "Meet your next team", "Get discovered by employers looking for proven skills."],
          ].map(([number, title, description], index) => (
            <motion.div
              className="step-card"
              key={number}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, delay: index * 0.1 }}
            >
              <span className="step-number">{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="benefit-section section-pad">
        <motion.div
          className="benefit-image"
          role="img"
          aria-label="Team member presenting ideas in a creative meeting"
          style={{
            backgroundImage:
              "linear-gradient(180deg, transparent 40%, rgba(0,0,0,.6)), url(https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=85)",
          }}
          {...reveal}
        >
          <span className="eyebrow">People first. Proof always.</span>
        </motion.div>
        <motion.div className="benefit-copy" {...reveal} transition={{ ...reveal.transition, delay: 0.12 }}>
          <p className="eyebrow lime">Built for both sides</p>
          <h2>Make the<br /><span>work</span> count.</h2>
          <div className="benefit-columns">
            <div>
              <h3>For candidates</h3>
              <ul>
                {candidateBenefits.slice(0, 2).map((benefit) => (
                  <li key={benefit}><Check size={15} />{benefit}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>For employers</h3>
              <ul>
                {employerSignals.slice(0, 2).map((signal) => (
                  <li key={signal}><Check size={15} />{signal}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="roles-section section-pad" id="roles">
        <motion.div className="section-heading" {...reveal}>
          <div>
            <p className="eyebrow lime">A good next move</p>
            <h2>Find work that<br /><span>fits you.</span></h2>
          </div>
          <Link href="/challenges" className="text-link">
            Explore all open roles <ArrowRight size={16} />
          </Link>
        </motion.div>
        <div className="home-job-cta">
          <div className="home-job-image" role="img" aria-label="Colleagues working together on a project" />
          <div className="home-job-copy">
            <p className="eyebrow">Real openings. Relevant work samples.</p>
            <h3>No CV gatekeeping.<br />Just show your approach.</h3>
            <p>Explore roles from hiring teams, complete a short role-specific task, and let your result make the introduction.</p>
            <div className="home-job-actions">
              <Link href="/challenges" className="button button-lime">Browse opportunities <ArrowRight size={16} /></Link>
              <Link href="/auth" className="text-link">I&apos;m hiring <ArrowUpRight size={15} /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="closing-section section-pad">
        <motion.div className="closing-card" {...reveal}>
          <div>
            <p className="eyebrow">Your next chapter starts here</p>
            <h2>MAKE YOUR<br /><span>WORK SPEAK.</span></h2>
          </div>
          <Link href="/auth" className="button button-dark">
            Create your profile <ArrowUpRight size={17} />
          </Link>
          <span className="closing-star" aria-hidden="true">✳</span>
        </motion.div>
      </section>

      <footer className="site-footer">
        <Link href="/" className="brand-mark" aria-label="HIREYOU home">
          <Image src="/hireyou-logo.png" alt="HIREYOU" width={610} height={234} className="brand-logo" />
        </Link>
        <p>Better hiring starts with better proof.</p>
        <div className="footer-links">
          <Link href="/challenges">Find work</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/auth">Sign in</Link>
          <a
            href="https://www.linkedin.com/search/results/companies/?keywords=HIREYOU"
            target="_blank"
            rel="noreferrer"
          >
            Find us on LinkedIn <ArrowUpRight size={13} />
          </a>
        </div>
        <span className="copyright">© HIREYOU</span>
      </footer>
      </main>
    </MotionConfig>
  );
}
