"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ArrowRight, LayoutGrid, ChevronLeft, ChevronRight, ChevronDown, Filter, Eye, EyeOff } from "lucide-react";
import { useParams } from "next/navigation";
import { templatesCatalog, templateCatalogCategories } from "@/data/templates";
import { siteRoutes, getTemplateHref, getStartWithMaxwellHref } from "@/lib/site-config";

const LOCALES = ["en", "es", "fr", "de"];


export function TemplatesContent() {
  const params = useParams();
  const paramLocale = typeof params?.locale === "string" ? params.locale : null;
  const locale = paramLocale && LOCALES.includes(paramLocale) ? paramLocale : "en";
  const lp = (href: string) => `/${locale}${href}`;

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const [query, setQuery] = useState("");
  const catsRef = useRef<HTMLDivElement>(null);
  const [catsScrolled, setCatsScrolled] = useState(false);
  const [catsAtEnd, setCatsAtEnd] = useState(false);

  useEffect(() => {
    const el = catsRef.current;
    if (!el) return;
    const onScroll = () => {
      setCatsScrolled(el.scrollLeft > 4);
      setCatsAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollCats = (dir: "left" | "right") => {
    catsRef.current?.scrollBy({ left: dir === "right" ? 260 : -260, behavior: "smooth" });
  };

  const categoryReps = useMemo(
    () =>
      templateCatalogCategories.map((category) => {
        const rep = templatesCatalog.find((tpl) => tpl.category === category);
        return { category, image: rep?.image ?? "" };
      }),
    [],
  );

  const filtered = useMemo(() => {
    let list = activeFilter
      ? templatesCatalog.filter((tpl) => tpl.category === activeFilter)
      : templatesCatalog;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (tpl) =>
          tpl.name.toLowerCase().includes(q) ||
          tpl.category.toLowerCase().includes(q) ||
          tpl.summary.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeFilter, query]);

  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="tpl-hero">
        <div className="tpl-wrap">
          <div className="tpl-hero-inner">
            <h1 className="tpl-display">
              Starting points for{" "}
              <span style={{ color: "var(--text-secondary)" }}>real software.</span>
            </h1>
            <p className="tpl-lead tpl-hero-lead">
              Each template is a pre-defined scope for a common software type — ready to adapt to
              your business and delivered as production code you own.
            </p>
            <label className="tpl-search">
              <Search size={16} aria-hidden />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates…"
              />
            </label>
          </div>
        </div>
      </section>

      {/* ── browse by category ────────────────────────────────────────────── */}
      <section className="tpl-section" style={{ paddingTop: 0, paddingBottom: 32 }}>
        <div className="tpl-wrap">
          <div className="tpl-sechead">
            <h2 className="tpl-h2">Pick a starting point</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {activeFilter && (
                <button
                  onClick={() => setActiveFilter(null)}
                  className="tpl-btn tpl-btn-ghost"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <LayoutGrid size={14} />
                  Show all
                </button>
              )}
              {!showAllCats && (
                <div className="tpl-cats-nav">
                  <button className="tpl-cats-arrow" onClick={() => scrollCats("left")} aria-label="Scroll left">
                    <ChevronLeft size={16} />
                  </button>
                  <button className="tpl-cats-arrow" onClick={() => scrollCats("right")} aria-label="Scroll right">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {!showAllCats ? (
            <div className={`tpl-cats-wrap${catsScrolled ? " show-left" : ""}${!catsAtEnd ? " show-right" : ""}`}>
              <div className="tpl-cats" ref={catsRef}>
                {categoryReps.map((c) => {
                  const active = activeFilter === c.category;
                  return (
                    <button
                      key={c.category}
                      className={`tpl-cat-btn${active ? " active" : ""}`}
                      onClick={() => setActiveFilter(active ? null : c.category)}
                    >
                      <div className="tpl-cat-inner">
                        <div className="tpl-cat-img">
                          {c.image ? (
                            <Image src={c.image} alt={c.category} fill sizes="340px" />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "var(--bg-secondary)" }} />
                          )}
                        </div>
                        <div className="tpl-cat-name">{c.category}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="tpl-cats-expanded">
              {templateCatalogCategories.map((cat) => {
                const rep = categoryReps.find((c) => c.category === cat);
                const active = activeFilter === cat;
                return (
                  <button
                    key={cat}
                    className={`tpl-cat-btn${active ? " active" : ""}`}
                    onClick={() => { setActiveFilter(active ? null : cat); setShowAllCats(false); }}
                  >
                    <div className="tpl-cat-inner">
                      <div className="tpl-cat-img">
                        {rep?.image ? (
                          <Image src={rep.image} alt={cat} fill sizes="340px" />
                        ) : (
                          <div style={{ width: "100%", height: "100%", background: "var(--bg-secondary)" }} />
                        )}
                      </div>
                      <div className="tpl-cat-name">{cat}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="tpl-browse-all-row">
            <button className="tpl-browse-all" onClick={() => setShowAllCats((v) => !v)}>
              {showAllCats ? <Eye size={14} color="#0056FD" /> : <EyeOff size={14} color="#0056FD" />} View All <ChevronDown size={14} style={{ transition: "transform .25s", transform: showAllCats ? "rotate(180deg)" : "none" }} />
            </button>
          </div>
        </div>
      </section>

      {/* ── templates grid ────────────────────────────────────────────────── */}
      <div className="tpl-divider" />
      <section className="tpl-section" style={{ paddingTop: 0 }}>
        <div className="tpl-wrap">
          <div className="tpl-grid-head">
            <h2 className="tpl-h2" style={{ fontSize: 16, fontWeight: 500 }}>
              {activeFilter ?? "All Templates"}
            </h2>
            <div className="tpl-filter-wrap">
              <button className="tpl-filter-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
                <Filter size={13} strokeWidth={2} color="#0056FD" />
                Filters <ChevronDown size={13} strokeWidth={2} style={{ transition: "transform .2s", transform: showFilters ? "rotate(180deg)" : "none" }} />
              </button>
              {showFilters && (
                <div className="tpl-filter-drop">
                  <button className={`tpl-filter-opt${!activeFilter ? " active" : ""}`} onClick={() => { setActiveFilter(null); setShowFilters(false); }}>All</button>
                  {templateCatalogCategories.map((cat) => (
                    <button key={cat} className={`tpl-filter-opt${activeFilter === cat ? " active" : ""}`} onClick={() => { setActiveFilter(cat); setShowFilters(false); }}>{cat}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="tpl-grid">
              {filtered.map((template) => (
                <Link
                  key={template.slug}
                  href={lp(getTemplateHref(template.slug))}
                  className="tpl-tcard"
                >
                  <div className="tpl-tcard-img">
                    <Image
                      src={template.image}
                      alt={template.name}
                      fill
                      sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className=""
                    />
                  </div>
                  <div className="tpl-tcard-info">
                    <div className="tpl-tcard-name">{template.name}</div>
                    <div className="tpl-tcard-cat">{template.category}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="tpl-empty">No templates match &ldquo;{query}&rdquo;.</div>
          )}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="tpl-section" style={{ paddingTop: 0 }}>
        <div className="tpl-wrap">
          <div className="tpl-cta">
            <h2 className="tpl-h2" style={{ maxWidth: "20ch", margin: "0 auto" }}>
              Don&apos;t see what you need?
            </h2>
            <p className="tpl-lead" style={{ maxWidth: "46ch", margin: "14px auto 0" }}>
              Start with Maxwell and describe what you want to build. We&apos;ll scope it and ship
              it as real, human-reviewed software you own.
            </p>
            <div className="tpl-cta-actions">
              <Link href={lp(getStartWithMaxwellHref())} className="tpl-btn tpl-btn-primary">
                Start with Maxwell <ArrowRight size={15} />
              </Link>
              <Link href={lp(siteRoutes.services)} className="tpl-btn tpl-btn-secondary">
                View services
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
