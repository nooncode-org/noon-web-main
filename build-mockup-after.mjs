// Builds the NORR "after" mockup as a self-contained HTML content fragment
// (styles + markup + script, no doctype/html/head/body — the Artifact wrapper
// adds those). Inlines optimized product photos + Switzer (display/body — closest
// free cousin to the Suisse Int'l-style reference) + Geist Mono (functional
// labels/prices) as base64 data URIs so it has ZERO external requests (Artifact
// CSP). Switzer is Fontshare's Free Font EULA — commercial + web-embed OK.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OPT = path.resolve("design/mockup-assets/opt");
const SWITZER = path.resolve("design/mockup-assets/fonts-switzer");
const GEIST_MONO = path.resolve("node_modules/geist/dist/fonts/geist-mono");

const uri = async (file, mime) =>
  `data:${mime};base64,${(await readFile(file)).toString("base64")}`;

const names = [
  "clock-light", "clock-walnut", "lamp-sage", "lamp-scene", "lamp-studio", "armchair-spindle",
  "ottoman", "throw-basket", "chair-sage", "side-table-round", "pedestal-black",
  "vessel-oak", "vase-ceramic", "dining-table", "chair-cord",
];
const IMG = {};
for (const n of names) IMG[n] = await uri(path.join(OPT, `${n}.jpg`), "image/jpeg");

const fLight = await uri(path.join(SWITZER, "Switzer-Light.woff2"), "font/woff2");
const fReg = await uri(path.join(SWITZER, "Switzer-Regular.woff2"), "font/woff2");
const fMed = await uri(path.join(SWITZER, "Switzer-Medium.woff2"), "font/woff2");
const fSemi = await uri(path.join(SWITZER, "Switzer-Semibold.woff2"), "font/woff2");
const fBold = await uri(path.join(SWITZER, "Switzer-Bold.woff2"), "font/woff2");
const fMono = await uri(path.join(GEIST_MONO, "GeistMono-Regular.woff2"), "font/woff2");

const PRODUCTS = [
  { img: "armchair-spindle", cat: "Seating", name: "Sonoma Armchair", variant: "Oak / Oat", price: 445 },
  { img: "chair-sage", cat: "Seating", name: "Arc Dining Chair", variant: "Sage", price: 365 },
  { img: "dining-table", cat: "Tables", name: "Linden Dining Table", variant: "Oak", price: 1240 },
  { img: "chair-cord", cat: "Seating", name: "Cord Dining Chair", variant: "Natural", price: 325 },
  { img: "side-table-round", cat: "Tables", name: "Pebble Side Table", variant: "Oak", price: 245 },
  { img: "ottoman", cat: "Seating", name: "Sonoma Footstool", variant: "Oat", price: 215 },
  { img: "clock-light", cat: "Objects", name: "Meridian Wall Clock", variant: "Ash", price: 118 },
  { img: "clock-walnut", cat: "Objects", name: "Meridian Wall Clock", variant: "Walnut", price: 132 },
  { img: "vase-ceramic", cat: "Objects", name: "Dune Vase", variant: "Sand", price: 54, tag: "New" },
  { img: "vessel-oak", cat: "Objects", name: "Oak Vessel", variant: "Natural", price: 42 },
  { img: "throw-basket", cat: "Textiles", name: "Rib-Knit Throw", variant: "Mist", price: 85 },
  { img: "pedestal-black", cat: "Tables", name: "Post Drinks Table", variant: "Black", price: 135 },
];

// object-position's X axis has NO effect when the box is wider (landscape) than
// the square source: object-fit:cover already matches the scaled image's width
// to the box exactly, so there's zero horizontal slack to reposition within —
// verified live (0% vs 50% vs 100% render identically). Where the product isn't
// centered in its own square source photo, `xform` compensates with a measured
// CSS transform (scale for overflow buffer + translateX to recenter the subject;
// values derived from pixel-sampling each source's actual content bounds).
const CATEGORIES = [
  { name: "Seating", img: "chair-cord", pos: "center 53.7%", px: -6, pscale: 1.1, desc: "Armchairs and dining chairs, built for how you actually sit." },
  { name: "Tables", img: "dining-table", pos: "60% 55%", desc: "Dining and side tables in solid oak, built to outlast trends." },
  { name: "Objects", img: "vase-ceramic", pos: "50% 52.9%", px: -15, pscale: 1.15, desc: "Vases, clocks and small pieces that finish a room." },
];

const QUOTES = [
  { q: "The oak has aged beautifully — it looks better than the day it arrived.", n: "Marta L.", loc: "Copenhagen" },
  { q: "Everything came considered, from the packaging to the finish. Rare now.", n: "Devon R.", loc: "Portland" },
  { q: "I bought the lamp for the desk and ended up furnishing the whole room.", n: "Aiko T.", loc: "Kyoto" },
];

const money = (n) => "$" + n.toLocaleString("en-US");

const cards = PRODUCTS.map((p, i) => `
      <article class="card reveal" style="--d:${i * 0.04}s">
        <div class="card-media">
          <img src="${IMG[p.img]}" alt="${p.name} — ${p.variant}" loading="lazy" />
          ${p.tag ? `<span class="card-tag">${p.tag}</span>` : ""}
        </div>
        <div class="card-info">
          <div class="card-line">
            <span class="card-cat">${p.cat}</span>
            <span class="card-price">${money(p.price)}</span>
          </div>
          <h3 class="card-name">${p.name} <span>— ${p.variant}</span></h3>
        </div>
      </article>`).join("");

const catTiles = CATEGORIES.map((c) => `
      <a href="#" class="cat-card">
        <div class="cat-photo"><img src="${IMG[c.img]}" alt="${c.name}" style="object-position:${c.pos};${c.px ? ` --px:${c.px}px; --pscale:${c.pscale};` : ""}" loading="lazy" /></div>
        <div class="cat-text">
          <h3>${c.name}</h3>
          <p>${c.desc}</p>
          <span class="cat-link">View Collection <svg width="15" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></svg></span>
        </div>
      </a>`).join("");

const quotes = QUOTES.map((t, i) => `
      <figure class="quote">
        <span class="q-num">${i + 1}</span>
        <blockquote>&ldquo;${t.q}&rdquo;</blockquote>
        <figcaption><span class="q-name">${t.n}</span><span class="q-loc">${t.loc}</span></figcaption>
      </figure>`).join("");

// real, recognizable (simplified) payment-brand marks — inline SVG, each its
// own small badge, matching the brand's real colors/wordmark style.
const PAY_SVGS = {
  Visa: `<svg width="40" height="24" viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="24" rx="3" fill="#fff"/><text x="20" y="16" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="11" fill="#1A1F71" text-anchor="middle">VISA</text></svg>`,
  Mastercard: `<svg width="40" height="24" viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="24" rx="3" fill="#fff"/><circle cx="17" cy="12" r="7" fill="#EB001B"/><circle cx="23" cy="12" r="7" fill="#F79E1B"/><path d="M20 6.5a7 7 0 0 1 0 11 7 7 0 0 1 0-11Z" fill="#FF5F00"/></svg>`,
  Amex: `<svg width="40" height="24" viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="24" rx="3" fill="#2557D6"/><text x="20" y="15.5" font-family="Arial,sans-serif" font-weight="700" font-size="8.5" fill="#fff" text-anchor="middle" letter-spacing="0.5">AMEX</text></svg>`,
  PayPal: `<svg width="46" height="24" viewBox="0 0 46 24" xmlns="http://www.w3.org/2000/svg"><rect width="46" height="24" rx="3" fill="#fff"/><text x="23" y="16" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="10.5" text-anchor="middle"><tspan fill="#003087">Pay</tspan><tspan fill="#009cde">Pal</tspan></text></svg>`,
  "Apple Pay": `<svg width="48" height="24" viewBox="0 0 48 24" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="24" rx="3" fill="#fff"/><g transform="translate(9,6.5)" fill="#000"><path d="M5.6 1.9c.4-.5.6-1.1.6-1.8-.6 0-1.3.4-1.7.9-.4.4-.7 1.1-.6 1.7.6 0 1.3-.3 1.7-.8Z"/><path d="M6.4 2.9c-.9-.1-1.7.5-2.1.5s-1.1-.5-1.8-.5c-.9 0-1.8.5-2.2 1.4-1 1.7-.3 4.2.7 5.6.5.7 1 1.5 1.7 1.5.7 0 1-.4 1.8-.4s1.1.4 1.8.4c.8 0 1.2-.7 1.7-1.4.5-.8.7-1.5.7-1.6 0 0-1.4-.5-1.4-2.1 0-1.3 1.1-1.9 1.1-2-.6-.9-1.6-1-1.9-1Z"/></g><text x="31" y="16" font-family="Arial,sans-serif" font-weight="600" font-size="9" fill="#000" text-anchor="middle">Pay</text></svg>`,
};
const pay = Object.entries(PAY_SVGS)
  .map(([name, svg]) => `<span class="pay-mark" aria-label="${name}" title="${name}">${svg}</span>`).join("");

// thin-line nav icons (feather/lucide-style, 18px, currentColor) — matches the
// reference header's minimal icon language
const ICON = {
  search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  account: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>`,
  bag: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`,
  menu: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>`,
  chevron: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>`,
};

const html = `<title>NORR — Objects for a quieter home</title>
<style>
  @font-face{font-family:'Switzer';font-weight:300;font-style:normal;font-display:swap;src:url(${fLight}) format('woff2')}
  @font-face{font-family:'Switzer';font-weight:400;font-style:normal;font-display:swap;src:url(${fReg}) format('woff2')}
  @font-face{font-family:'Switzer';font-weight:500;font-style:normal;font-display:swap;src:url(${fMed}) format('woff2')}
  @font-face{font-family:'Switzer';font-weight:600;font-style:normal;font-display:swap;src:url(${fSemi}) format('woff2')}
  @font-face{font-family:'Switzer';font-weight:700;font-style:normal;font-display:swap;src:url(${fBold}) format('woff2')}
  @font-face{font-family:'GeistMono';font-weight:400;font-style:normal;font-display:swap;src:url(${fMono}) format('woff2')}

  /* thin, quiet scrollbar (default OS scrollbars read heavy against this flat
     design) — targets the real document scroller, not .norr itself. */
  html{scrollbar-width:thin; scrollbar-color:#c7c4b8 transparent;}
  ::-webkit-scrollbar{width:9px; height:9px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:#c7c4b8; border-radius:99px; border:2px solid #fff;}
  ::-webkit-scrollbar-thumb:hover{background:#a5a297;}

  .norr{
    --paper:#ffffff; --ink:#232420; --muted:#8c8a7e; --line:#e4e1d8;
    --card:#f2f2f2; --sage:#75855f;
    --sans:'Switzer',system-ui,sans-serif; --mono:'GeistMono',ui-monospace,monospace;
    --wrap:1220px;
    background:var(--paper); color:var(--ink); font-family:var(--sans);
    font-weight:400; line-height:1.6; -webkit-font-smoothing:antialiased;
    font-size:15px; letter-spacing:-0.006em; position:relative;
  }
  .norr *{box-sizing:border-box; margin:0; padding:0;}
  .norr img{max-width:100%; display:block;}
  .norr button{font:inherit; color:inherit; cursor:pointer; border:0; background:none;}
  .norr ::selection{background:var(--sage); color:var(--paper);}
  .wrap{max-width:var(--wrap); margin:0 auto; padding:0 28px;}

  /* side frame accent — a thin bar at each viewport edge that carries the
     hero's tone slightly past it, ending around the first product row (NOT a
     full-page fixed overlay — it scrolls with the page and simply stops where
     its box ends). */
  .page-frame{position:absolute; top:0; left:0; right:0; height:1350px; z-index:55; pointer-events:none;}
  .page-frame::before, .page-frame::after{
    content:''; position:absolute; top:0; bottom:0; width:26px; background:#f6f6f6;
  }
  .page-frame::before{left:0;} .page-frame::after{right:0;}
  .label{font-family:var(--mono); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--muted);}

  /* nav — centered logo, pills+links left, icon actions right (3-col grid so the
     logo stays true-center regardless of left/right content width) */
  .nav{position:sticky; top:0; z-index:50; background:#f6f6f6;
    border-bottom:1px solid transparent; transition:border-color .3s;}
  .nav.scrolled{border-bottom-color:var(--line);}
  .nav-in{max-width:var(--wrap); margin:0 auto; padding:16px 28px; display:grid;
    grid-template-columns:1fr auto 1fr; align-items:center; gap:14px;}
  .nav-left{justify-self:start; display:flex; align-items:center;}
  .nav-links{display:flex; gap:20px;}
  .nav-links a{font-size:13.8px; font-weight:500; color:var(--ink); text-decoration:none; opacity:.58; transition:opacity .2s;}
  .nav-links a:hover{opacity:1;}
  .brand{justify-self:center; font-size:20px; font-weight:700; letter-spacing:-0.01em;}
  .nav-right{justify-self:end; display:flex; align-items:center; gap:2px;}
  .icon-btn{width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center;
    border-radius:50%; color:var(--ink); position:relative; transition:background .2s;}
  .icon-btn:hover{background:var(--card);}

  /* hero — single-product spotlight (reference: giant ghosted wordmark behind a
     large product shot anchored to the hero's own bottom edge, short product
     title, small "shop this product" link, 01/02 pagination). */
  .hero{position:relative; overflow:hidden; padding-top:clamp(16px,3vw,36px); background:#f6f6f6;}
  .hero-in{position:relative; z-index:1; display:grid; grid-template-columns:0.85fr 1.15fr;
    gap:clamp(16px,3vw,40px); align-items:end;}
  .hero-text{padding-bottom:clamp(40px,6vw,72px);}
  .hero h1{font-weight:600; font-size:clamp(33px,4.4vw,50px); line-height:1.05; letter-spacing:-0.02em;}
  .hero-shop{margin-top:22px; display:inline-flex; align-items:center; gap:10px; font-size:13.5px;
    color:var(--ink); text-decoration:none;}
  .hero-shop .ar{display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px;
    flex-shrink:0; background:#fff; border:1px solid var(--line); border-radius:999px;
    transition:border-color .2s, box-shadow .2s, transform .2s;}
  .hero-shop:hover .ar{border-color:var(--ink); box-shadow:0 2px 10px rgba(0,0,0,.06); transform:translateX(3px);}
  .hero-media{position:relative; height:clamp(300px,38vw,460px); overflow:hidden; display:flex;
    align-items:flex-end; justify-content:center;}
  .hero-media img{position:absolute; bottom:-145px; right:85px; max-height:130%; width:auto; max-width:96%;
    object-fit:contain; opacity:0; transition:opacity .7s ease; transform:scaleX(-1);}
  .hero-media img.on{opacity:1;}
  /* overlaid on the hero itself (not a flow row after hero-media) — this lets
     hero-media's own bottom edge BE the hero's true bottom edge, so the lamp's
     crop lines up with the section limit instead of stopping short of it. */
  .hero-dots{position:absolute; z-index:2; right:28px; bottom:16px; display:flex; align-items:center; gap:10px;}
  .dot{width:26px; height:2px; background:var(--line); position:relative; border-radius:2px; cursor:pointer;}
  .dot::before{content:''; position:absolute; top:-9px; bottom:-9px; left:0; right:0;}
  .dot b{position:absolute; inset:0; width:0; background:var(--ink); transition:width .4s;}
  .dot.on b{width:100%;}

  /* category tiles — evocative close-crop photo bleeding into each tile,
     separate cards; the photo is its own inset box (margin from the top+right
     edges, flush only to the bottom) — NOT a full-bleed background, no fade. */
  .cats2{padding:clamp(48px,6vw,80px) 0 clamp(12px,2vw,22px);}
  .cats2-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:18px; justify-items:center;}
  .cat-card{position:relative; display:block; overflow:hidden; min-height:192px; width:100%; max-width:393px;
    background:#f2f2f2; border-radius:4px; padding:19px 18px; text-decoration:none; color:var(--ink);}
  .cat-text{position:relative; z-index:2; max-width:54%;}
  .cat-text h3{font-size:clamp(17px,1.6vw,19px); font-weight:600; letter-spacing:-0.01em; margin-bottom:6px;}
  .cat-text p{font-size:12px; line-height:1.45; color:#6f6d62; max-width:18ch; margin-bottom:10px;}
  .cat-link{display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:500;}
  .cat-link svg{transition:transform .2s;}
  .cat-card:hover .cat-link svg{transform:translateX(4px);}
  .cat-photo{position:absolute; top:30px; right:20px; bottom:0; left:44%; border-radius:4px; overflow:hidden;}
  .cat-photo img{width:100%; height:100%; object-fit:cover; transition:transform .6s ease;
    --px:0px; --pscale:1; transform:translateX(var(--px)) scaleX(var(--pscale));}
  .cat-card:hover .cat-photo img{transform:translateX(var(--px)) scaleX(var(--pscale)) scale(1.045);}

  /* collection */
  .coll{padding:clamp(36px,4.5vw,56px) 0 clamp(12px,2vw,22px);}
  .coll-head{text-align:center; margin-bottom:44px;}
  .coll-head h2{font-weight:500; font-size:clamp(22px,2.6vw,28px); letter-spacing:-0.01em;}
  .grid{display:grid; grid-template-columns:repeat(4,1fr); gap:38px 30px;}
  .coll-more{text-align:center; margin-top:48px;}
  .viewall-btn{display:inline-flex; align-items:center; justify-content:center; padding:13px 32px;
    border:1px solid var(--line); border-radius:999px; font-size:13.5px; font-weight:500;
    color:var(--ink); text-decoration:none; background:transparent;
    transition:border-color .2s, box-shadow .2s;}
  .viewall-btn:hover{border-color:var(--ink); box-shadow:0 2px 10px rgba(0,0,0,.06);}
  .card{display:flex; flex-direction:column;}
  .card-media{position:relative; aspect-ratio:1/1; background:var(--card); border-radius:4px; overflow:hidden;}
  .card-media img{width:100%; height:100%; object-fit:cover; transition:transform .6s ease;}
  .card:hover .card-media img{transform:scale(1.045);}
  .card-tag{position:absolute; top:12px; left:12px; font-family:var(--mono); font-size:10px; letter-spacing:.1em;
    text-transform:uppercase; background:var(--paper); color:var(--ink); padding:4px 8px; border-radius:2px;
    box-shadow:0 1px 5px rgba(0,0,0,.12);}
  .card-info{padding-top:15px;}
  .card-line{display:flex; align-items:baseline; justify-content:space-between; gap:12px;}
  .card-cat{font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted);}
  .card-price{font-family:var(--mono); font-size:13px; font-variant-numeric:tabular-nums;}
  .card-name{font-size:15px; font-weight:400; margin-top:7px; letter-spacing:-0.01em;}
  .card-name span{color:var(--muted);}

  /* testimonials */
  .voices{border-top:1px solid var(--line); padding:clamp(48px,6vw,80px) 0 clamp(12px,2vw,22px);}
  .voices-title{text-align:center; margin-bottom:52px; font-weight:500;
    font-size:clamp(22px,2.6vw,28px); letter-spacing:-0.01em;}
  .voices-row{display:flex; align-items:center; gap:20px; max-width:1000px; margin:0 auto;}
  .voices-arrow{flex-shrink:0; width:36px; height:36px; display:inline-flex; align-items:center;
    justify-content:center; border:1px solid var(--line); border-radius:999px; color:var(--ink);
    background:#fff; transition:border-color .2s, box-shadow .2s;}
  .voices-arrow:hover{border-color:var(--ink); box-shadow:0 2px 10px rgba(0,0,0,.06);}
  .voices-grid{flex:1; min-width:0; display:grid; grid-template-columns:repeat(3,1fr); gap:48px;}
  .q-num{display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px;
    margin-bottom:18px; border-radius:999px; background:var(--sage); color:#fff;
    font-family:var(--mono); font-size:11px;}
  .quote blockquote{font-weight:300; font-size:15px; line-height:1.5; letter-spacing:-0.015em; color:var(--muted);
    text-wrap:balance;}
  .quote figcaption{margin-top:22px; display:flex; flex-direction:column; gap:3px;}
  .q-name{font-size:13.5px; font-weight:600;}
  .q-loc{font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);}

  /* footer */
  .foot{background:var(--ink); color:#d8d5cb; padding:clamp(48px,6vw,80px) 0 40px;}
  .foot a{color:#d8d5cb; text-decoration:none; opacity:.72; transition:opacity .2s;}
  .foot a:hover{opacity:1;}
  .foot-top{display:grid; grid-template-columns:1.4fr 1fr 1fr 1fr; gap:40px; padding-bottom:56px;
    border-bottom:1px solid #3a3a34;}
  .foot-brand{font-size:20px; font-weight:700; letter-spacing:-0.01em; color:#f4f2ec;}
  .foot-news{margin-top:22px; max-width:34ch; color:#a5a297; font-size:14px;}
  .news-form{margin-top:18px; display:flex; border-bottom:1px solid #55554d; max-width:320px;}
  .news-form input{flex:1; background:none; border:0; color:#f4f2ec; font:inherit; font-size:14px; padding:8px 0; outline:none;}
  .news-form input::placeholder{color:#7c7a70;}
  .news-form button{color:#f4f2ec; padding:8px 4px; font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase;}
  .foot-col h4{font-family:var(--mono); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#8a887d; margin-bottom:18px; font-weight:400;}
  .foot-col ul{list-style:none; display:flex; flex-direction:column; gap:11px; font-size:14px;}
  .foot-bot{display:flex; align-items:center; justify-content:space-between; gap:20px; padding-top:26px; flex-wrap:wrap;}
  .foot-bot .label{color:#7c7a70;}
  .pay{display:flex; gap:8px; flex-wrap:wrap;}
  .pay-mark{display:inline-flex; line-height:0;}
  .pay-mark svg{display:block; border-radius:2px;}

  .reveal{opacity:0; transform:translateY(14px); transition:opacity .7s ease var(--d,0s), transform .7s ease var(--d,0s);}
  .reveal.in{opacity:1; transform:none;}

  @media(max-width:960px){
    .page-frame{display:none;}
    .hero-in{grid-template-columns:1fr; gap:8px;}
    .hero-text{padding-bottom:20px;}
    .hero-media{height:280px;}
    .hero-media img{bottom:-88px; right:auto;}
    .cats2-grid{grid-template-columns:1fr;}
    /* a full-width mobile card would make .cat-photo's box far more landscape
       than the desktop box the transform/object-position values above were
       measured against (verified: 395x123 vs 200x146) — over-cropping the
       subject. Taller card brings the ratio back close to desktop's, and the
       fixed-px recenter transform (tuned for the desktop box width) is dropped
       since it doesn't scale with this different width. */
    .cat-card{min-height:230px; max-width:none;}
    .cat-text{max-width:56%;}
    .cat-photo{left:46%;}
    .cat-photo img{transform:none !important;}
    .grid{grid-template-columns:repeat(2,1fr); gap:30px 20px;}
    .voices-grid{grid-template-columns:1fr; gap:40px;}
    .voices-arrow{display:none;}
    .foot-top{grid-template-columns:1fr 1fr; gap:36px;}
    .nav-links{display:none;}
  }
  @media(max-width:560px){
    .nav-right .icon-btn:nth-child(2){display:none;}
    .grid{grid-template-columns:1fr 1fr; gap:20px 14px;}
  }
  @media(prefers-reduced-motion:reduce){
    .norr *{transition:none !important;}
    .reveal{opacity:1; transform:none;}
  }
</style>

<div class="norr">
  <div class="page-frame" aria-hidden="true"></div>
  <header class="nav" id="nav">
    <div class="nav-in">
      <div class="nav-left">
        <nav class="nav-links">
          <a href="#">home</a><a href="#">shop</a><a href="#">collections</a>
        </nav>
      </div>

      <span class="brand">norr</span>

      <div class="nav-right">
        <button class="icon-btn" type="button" aria-label="Search">${ICON.search}</button>
        <button class="icon-btn" type="button" aria-label="Account">${ICON.account}</button>
        <button class="icon-btn" type="button" aria-label="Cart">${ICON.bag}</button>
        <button class="icon-btn" type="button" aria-label="Menu">${ICON.menu}</button>
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="wrap hero-in">
      <div class="hero-text">
        <h1>Halo<br>Desk<br>Lamp</h1>
        <a href="#collection" class="hero-shop">
          <span class="ar">${ICON.chevron}</span> Shop this product
        </a>
      </div>
      <div class="hero-media" id="heroMedia">
        <img class="on" src="${IMG["lamp-studio"]}" alt="Halo Desk Lamp — Sage" data-cap="Halo Desk Lamp — Sage" />
        <img src="${IMG["lamp-scene"]}" alt="The Halo Desk Lamp on an oak desk" data-cap="Halo Desk Lamp — on a desk" />
      </div>
      <div class="hero-dots" id="heroDots">
        <span class="dot on" data-i="0"><b></b></span>
        <span class="dot" data-i="1"><b></b></span>
      </div>
    </div>
  </section>

  <section class="cats2 wrap reveal">
    <div class="cats2-grid">${catTiles}
    </div>
  </section>

  <section class="coll wrap" id="collection">
    <div class="coll-head reveal">
      <h2>Recent Products</h2>
    </div>
    <div class="grid">${cards}
    </div>
    <div class="coll-more">
      <a href="#" class="viewall-btn">View All Products</a>
    </div>
  </section>

  <section class="voices">
    <div class="wrap">
      <h2 class="voices-title reveal">Testimonial</h2>
      <div class="voices-row">
        <button class="voices-arrow" type="button" aria-label="Previous testimonials">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"/></svg>
        </button>
        <div class="voices-grid">${quotes}
        </div>
        <button class="voices-arrow" type="button" aria-label="Next testimonials">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
      </div>
    </div>
  </section>

  <footer class="foot">
    <div class="wrap">
      <div class="foot-top">
        <div>
          <div class="foot-brand">norr</div>
          <p class="foot-news">Slow furniture and quiet objects, made in small runs. Join the list for new pieces and the occasional note.</p>
          <form class="news-form" id="newsForm">
            <input type="email" placeholder="you@email.com" aria-label="Email" required />
            <button type="submit">Join &rarr;</button>
          </form>
        </div>
        <div class="foot-col"><h4>Shop</h4><ul><li><a href="#">Seating</a></li><li><a href="#">Tables</a></li><li><a href="#">Lighting</a></li><li><a href="#">Objects</a></li></ul></div>
        <div class="foot-col"><h4>Studio</h4><ul><li><a href="#">Our story</a></li><li><a href="#">Materials</a></li><li><a href="#">Journal</a></li><li><a href="#">Stockists</a></li></ul></div>
        <div class="foot-col"><h4>Help</h4><ul><li><a href="#">Shipping</a></li><li><a href="#">Returns</a></li><li><a href="#">Care guide</a></li><li><a href="#">Contact</a></li></ul></div>
      </div>
      <div class="foot-bot">
        <span class="label">&copy; 2026 NORR Studio — Copenhagen</span>
        <div class="pay">${pay}</div>
      </div>
    </div>
  </footer>
</div>

<script>
(function(){
  var root = document.querySelector('.norr'); if(!root) return;

  // nav border on scroll
  var nav = document.getElementById('nav');
  var onScroll = function(){ nav.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, {passive:true}); onScroll();

  // hero 01/02 — swaps the product image, dots-only (no caption/copy to update)
  var media = document.getElementById('heroMedia');
  var imgs = media.querySelectorAll('img');
  var dots = document.querySelectorAll('#heroDots .dot');
  var cur = 0, timer;
  function go(i){
    if(i===cur) return; cur=i;
    imgs.forEach(function(im,idx){ im.classList.toggle('on', idx===i); });
    dots.forEach(function(d,idx){ d.classList.toggle('on', idx===i); });
  }
  dots.forEach(function(d){ d.addEventListener('click', function(){ go(+d.dataset.i); reset(); }); });
  function reset(){ clearInterval(timer); timer=setInterval(function(){ go((cur+1)%2); }, 5500); }
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches) reset();

  // newsletter
  var nf = document.getElementById('newsForm');
  nf.addEventListener('submit', function(e){ e.preventDefault();
    nf.innerHTML = '<span style="color:#c7c4ba;font-size:14px;padding:8px 0;">Thanks — keep an eye on your inbox.</span>';
  });

  // reveals
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target);} }); }, {threshold:.12});
    root.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  } else { root.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); }); }
})();
</script>`;

await writeFile(path.resolve("design/mockup-assets/tienda-despues.html"), html);
console.log("wrote tienda-despues.html —", (html.length / 1024).toFixed(0), "KB");

// also publish a standalone document (doctype/html/head/body) for the live
// site to serve via <iframe src="/mockups/..."> on /upgrade — same fragment,
// browsers hoist the leading <title>/<style> from body fine either way.
const doc = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
${html}
</body></html>`;
await mkdir(path.resolve("public/mockups"), { recursive: true });
await writeFile(path.resolve("public/mockups/tienda-despues.html"), doc);
console.log("wrote public/mockups/tienda-despues.html —", (doc.length / 1024).toFixed(0), "KB");
