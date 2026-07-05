// NORR "before" — a GENERIC, over-designed ~2015 Bootstrap/Shopify-template
// e-commerce site: gradients, drop-shadows, rounded cards, a carousel, countdown
// timer, %OFF badges, icon feature strip. Dated & cluttered, but modern-era (not
// 90s). Same store/products/prices/photos as the "after". System fonts only.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OPT = path.resolve("design/mockup-assets/opt");
const uri = async (n) => `data:image/jpeg;base64,${(await readFile(path.join(OPT, n + ".jpg"))).toString("base64")}`;
const names = [
  "clock-light", "clock-walnut", "lamp-sage", "lamp-scene", "armchair-spindle",
  "ottoman", "throw-basket", "chair-sage", "side-table-round", "pedestal-black",
  "vessel-oak", "vase-ceramic", "dining-table", "chair-cord",
];
const IMG = {};
for (const n of names) IMG[n] = await uri(n);

const PRODUCTS = [
  { img: "lamp-sage", name: "Halo Desk Lamp - Sage Green", was: 149.99, now: 95, rating: 5, rev: 128, cat: "Lighting" },
  { img: "armchair-spindle", name: "Sonoma Wooden Armchair", was: 699, now: 445, rating: 4, rev: 64, cat: "Chairs" },
  { img: "chair-sage", name: "Arc Dining Chair - Green Seat", was: 549.99, now: 365, rating: 5, rev: 92, cat: "Chairs" },
  { img: "dining-table", name: "Linden Solid Oak Dining Table", was: 1899, now: 1240, rating: 4, rev: 41, cat: "Tables" },
  { img: "chair-cord", name: "Cord Dining Chair - Natural", was: 499.99, now: 325, rating: 4, rev: 77, cat: "Chairs" },
  { img: "side-table-round", name: "Pebble Round Side Table", was: 379.99, now: 245, rating: 5, rev: 53, cat: "Tables" },
  { img: "ottoman", name: "Sonoma Footstool Ottoman", was: 329, now: 215, rating: 4, rev: 38, cat: "Chairs" },
  { img: "clock-light", name: "Meridian Wall Clock - Ash", was: 189.99, now: 118, rating: 5, rev: 111, cat: "Decor" },
  { img: "vase-ceramic", name: "Dune Ceramic Vase - Sand", was: 89.99, now: 54, rating: 5, rev: 205, cat: "Decor" },
  { img: "clock-walnut", name: "Meridian Wall Clock - Walnut", was: 199.99, now: 132, rating: 4, rev: 87, cat: "Decor" },
  { img: "throw-basket", name: "Rib-Knit Throw + Woven Basket", was: 129.99, now: 85, rating: 4, rev: 149, cat: "Decor" },
  { img: "vessel-oak", name: "Oak Wooden Vessel / Pot", was: 69.99, now: 42, rating: 4, rev: 66, cat: "Decor" },
];

const off = (p) => Math.round((1 - p.now / p.was) * 100);
const stars = (r) => "★★★★★☆☆☆☆☆".slice(5 - r, 10 - r);
const $ = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const cards = PRODUCTS.map((p) => `
      <div class="pcard">
        <span class="off-badge">-${off(p)}%</span>
        <button class="wish" title="Add to Wishlist" type="button">&#9825;</button>
        <div class="pcard-img"><img src="${IMG[p.img]}" alt="${p.name}" loading="lazy"></div>
        <div class="pcard-body">
          <div class="pstars"><span class="s">${stars(p.rating)}</span> <span class="rev">(${p.rev})</span></div>
          <div class="pcat">${p.cat}</div>
          <a href="#" class="ptitle">${p.name}</a>
          <div class="pprice"><span class="now">$${$(p.now)}</span> <span class="was">$${$(p.was)}</span></div>
          <button class="addcart" data-name="${p.name}" type="button"><span class="ci">&#128722;</span> Add to Cart</button>
        </div>
      </div>`).join("");

const html = `<title>NORR Furniture Store | Buy Chairs, Tables, Lighting &amp; Home Decor Online - Free Shipping</title>
<style>
  .b2015{
    --teal:#16a3ac; --teal-d:#0d858d; --orange:#ff7a1a; --orange-d:#e8620a;
    --navy:#2b3550; --red:#e23b3b; --ink:#3a4250; --muted:#8a93a2; --line:#e4e8ee;
    --bg:#eef1f6; --card:#fff; --star:#ffb400;
    background:var(--bg); color:var(--ink); line-height:1.5;
    font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif; font-size:14px;
    -webkit-font-smoothing:antialiased;
  }
  .b2015 *{box-sizing:border-box; margin:0; padding:0;}
  .b2015 img{max-width:100%; display:block;}
  .b2015 a{color:var(--teal); text-decoration:none;}
  .b2015 button{font:inherit; cursor:pointer; border:0; background:none; color:inherit;}
  .bwrap{max-width:1180px; margin:0 auto; padding:0 16px;}

  /* announcement */
  .announce{background:linear-gradient(90deg,var(--teal),var(--teal-d)); color:#fff; font-size:13px; text-align:center; padding:8px 40px; position:relative;}
  .announce b{color:#fff2cc;}
  .announce .x{position:absolute; right:14px; top:6px; opacity:.8; font-size:16px;}

  /* header */
  .hdr{background:var(--card); box-shadow:0 2px 10px rgba(43,53,80,.06); position:relative; z-index:5;}
  .hdr-in{display:flex; align-items:center; gap:20px; padding:16px;}
  .logo{font-size:26px; font-weight:800; color:var(--navy); letter-spacing:1px; white-space:nowrap;}
  .logo span{color:var(--teal);}
  .search{flex:1; display:flex; max-width:560px; box-shadow:0 1px 3px rgba(0,0,0,.06); border-radius:24px; overflow:hidden; border:1px solid var(--line);}
  .search input{flex:1; border:0; padding:11px 18px; font-size:14px; outline:none; color:var(--ink);}
  .search button{background:linear-gradient(var(--teal),var(--teal-d)); color:#fff; padding:0 22px; font-weight:600;}
  .hicons{display:flex; align-items:center; gap:22px; margin-left:auto;}
  .hicon{display:flex; align-items:center; gap:7px; color:var(--ink); font-size:13px; white-space:nowrap;}
  .hicon .ic{font-size:20px; color:var(--teal);}
  .cartpill{background:linear-gradient(var(--orange),var(--orange-d)); color:#fff; padding:9px 16px; border-radius:22px; font-weight:600; display:flex; align-items:center; gap:8px; box-shadow:0 3px 10px rgba(255,122,26,.35);}
  .cartpill .cnt{background:#fff; color:var(--orange-d); border-radius:11px; min-width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;}

  /* nav */
  .mnav{background:var(--navy);}
  .mnav-in{display:flex; align-items:center; gap:2px; max-width:1180px; margin:0 auto; padding:0 16px; flex-wrap:wrap;}
  .mnav a{color:#dfe4ee; font-size:13.5px; font-weight:600; padding:13px 15px; display:inline-block; letter-spacing:.02em;}
  .mnav a:hover{background:rgba(255,255,255,.08); color:#fff;}
  .mnav a .car{font-size:9px; opacity:.7; margin-left:4px;}
  .mnav a.sale{color:#ffd24d;}
  .mnav a.sale:hover{color:#fff;}

  /* hero carousel */
  .hero{padding:22px 0;}
  .carousel{position:relative; border-radius:12px; overflow:hidden; box-shadow:0 8px 30px rgba(43,53,80,.14);}
  .slide{display:none; min-height:340px; align-items:center; padding:44px; position:relative; background-size:cover; background-position:center;}
  .slide.on{display:flex;}
  .slide1{background:linear-gradient(120deg,#17a3ac 0%,#0e7c84 60%,#0a5f66 100%);}
  .slide2{background:linear-gradient(120deg,#2b3550 0%,#3a4668 100%);}
  .slide-txt{max-width:520px; color:#fff; position:relative; z-index:2;}
  .slide-ey{display:inline-block; background:var(--orange); color:#fff; font-size:12px; font-weight:700; letter-spacing:.08em; padding:5px 12px; border-radius:14px; text-transform:uppercase; box-shadow:0 3px 10px rgba(0,0,0,.2);}
  .slide h2{font-size:clamp(30px,4.6vw,48px); font-weight:800; line-height:1.08; margin:16px 0 12px; text-shadow:0 2px 12px rgba(0,0,0,.2);}
  .slide p{font-size:16px; opacity:.95; margin-bottom:24px; max-width:36ch;}
  .shopbtn{display:inline-flex; align-items:center; gap:10px; background:linear-gradient(var(--orange),var(--orange-d)); color:#fff; font-weight:700; font-size:15px; padding:14px 30px; border-radius:26px; box-shadow:0 6px 18px rgba(255,122,26,.4); transition:transform .15s;}
  .shopbtn:hover{transform:translateY(-2px);}
  .slide-img{position:absolute; right:36px; bottom:0; width:44%; max-width:420px; z-index:1; filter:drop-shadow(0 12px 24px rgba(0,0,0,.3));}
  .slide-img img{border-radius:10px;}
  .cdots{position:absolute; bottom:16px; left:50%; transform:translateX(-50%); display:flex; gap:8px; z-index:3;}
  .cdots b{width:11px; height:11px; border-radius:50%; background:rgba(255,255,255,.5); cursor:pointer; display:block;}
  .cdots b.on{background:#fff; transform:scale(1.15);}
  .carr{position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,.85); width:42px; height:42px; border-radius:50%; font-size:20px; color:var(--navy); z-index:3; box-shadow:0 3px 10px rgba(0,0,0,.2);}
  .carr.prev{left:16px;} .carr.next{right:16px;}

  /* feature strip */
  .feats{display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin:8px 0 26px;}
  .feat{background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; display:flex; align-items:center; gap:13px; box-shadow:0 2px 8px rgba(43,53,80,.05);}
  .feat .fi{width:44px; height:44px; border-radius:50%; background:#e7f6f7; color:var(--teal); display:flex; align-items:center; justify-content:center; font-size:22px; flex:0 0 44px;}
  .feat b{display:block; font-size:13.5px; color:var(--navy);}
  .feat small{color:var(--muted); font-size:12px;}

  /* deal of the day */
  .deal{background:linear-gradient(100deg,#fff 60%,#fff5ec 100%); border:1px solid #ffe0c2; border-radius:12px; padding:22px 24px; display:flex; align-items:center; gap:26px; margin-bottom:30px; box-shadow:0 4px 16px rgba(255,122,26,.08); flex-wrap:wrap;}
  .deal-img{width:120px; height:120px; border-radius:10px; overflow:hidden; flex:0 0 120px; box-shadow:0 3px 10px rgba(0,0,0,.1);}
  .deal-img img{width:100%; height:100%; object-fit:cover;}
  .deal-info{flex:1; min-width:200px;}
  .deal-tag{color:var(--orange-d); font-weight:800; font-size:13px; letter-spacing:.04em; text-transform:uppercase;}
  .deal-info h3{font-size:20px; color:var(--navy); margin:4px 0 6px;}
  .deal-info .dp{font-size:22px; font-weight:800; color:var(--red);}
  .deal-info .dp s{color:var(--muted); font-size:15px; font-weight:400; margin-left:8px;}
  .cd{display:flex; gap:8px; text-align:center;}
  .cd div{background:var(--navy); color:#fff; border-radius:8px; padding:8px 10px; min-width:52px; box-shadow:0 3px 8px rgba(43,53,80,.2);}
  .cd b{font-size:22px; font-weight:800; font-variant-numeric:tabular-nums; display:block; line-height:1;}
  .cd small{font-size:9px; text-transform:uppercase; opacity:.7; letter-spacing:.05em;}

  /* products */
  .sec-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; flex-wrap:wrap; gap:12px;}
  .sec-head h2{font-size:24px; color:var(--navy); font-weight:800;}
  .sec-head h2 small{color:var(--orange); font-weight:800;}
  .ptabs{display:flex; gap:6px; margin:14px 0 20px; flex-wrap:wrap;}
  .ptabs button{border:1px solid var(--line); background:#fff; padding:7px 16px; border-radius:20px; font-size:13px; font-weight:600; color:var(--muted);}
  .ptabs button.on{background:linear-gradient(var(--teal),var(--teal-d)); color:#fff; border-color:transparent; box-shadow:0 3px 8px rgba(22,163,172,.3);}
  .pgrid{display:grid; grid-template-columns:repeat(4,1fr); gap:20px;}
  .pcard{background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; position:relative; box-shadow:0 2px 10px rgba(43,53,80,.06); transition:transform .2s, box-shadow .2s; display:flex; flex-direction:column;}
  .pcard:hover{transform:translateY(-5px); box-shadow:0 12px 28px rgba(43,53,80,.16);}
  .off-badge{position:absolute; top:10px; left:10px; background:linear-gradient(var(--red),#c22); color:#fff; font-size:12px; font-weight:800; padding:5px 9px; border-radius:16px; z-index:2; box-shadow:0 2px 6px rgba(226,59,59,.4);}
  .wish{position:absolute; top:9px; right:9px; width:34px; height:34px; border-radius:50%; background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.12); z-index:2; font-size:17px; color:#c9d0da; transition:color .15s, transform .15s;}
  .wish:hover, .wish.on{color:var(--red); transform:scale(1.12);}
  .pcard-img{background:#f6f7f9; aspect-ratio:1/1; overflow:hidden;}
  .pcard-img img{width:100%; height:100%; object-fit:cover; transition:transform .4s;}
  .pcard:hover .pcard-img img{transform:scale(1.06);}
  .pcard-body{padding:14px; display:flex; flex-direction:column; flex:1;}
  .pstars{font-size:13px; margin-bottom:4px;}
  .pstars .s{color:var(--star); letter-spacing:1px;}
  .pstars .rev{color:var(--muted); font-size:11px;}
  .pcat{font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em;}
  .ptitle{display:block; color:var(--navy); font-weight:600; font-size:14px; margin:3px 0 8px; min-height:38px; line-height:1.35;}
  .pprice{margin-bottom:12px;}
  .pprice .now{color:var(--red); font-weight:800; font-size:19px;}
  .pprice .was{color:var(--muted); text-decoration:line-through; font-size:13px; margin-left:6px;}
  .addcart{margin-top:auto; width:100%; background:linear-gradient(var(--orange),var(--orange-d)); color:#fff; font-weight:700; padding:11px; border-radius:8px; font-size:13.5px; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 3px 10px rgba(255,122,26,.28); transition:filter .15s;}
  .addcart:hover{filter:brightness(1.06);}
  .addcart.done{background:linear-gradient(#43b543,#2e9a2e); box-shadow:0 3px 10px rgba(46,154,46,.3);}

  /* categories */
  .cats{margin:36px 0;}
  .cat-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:18px;}
  .ctile{position:relative; border-radius:12px; overflow:hidden; height:150px; box-shadow:0 3px 12px rgba(43,53,80,.1); display:flex; align-items:flex-end;}
  .ctile img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform .4s;}
  .ctile:hover img{transform:scale(1.07);}
  .ctile span{position:relative; z-index:2; color:#fff; font-weight:800; font-size:18px; padding:16px; text-shadow:0 2px 8px rgba(0,0,0,.5); width:100%; background:linear-gradient(transparent,rgba(0,0,0,.55));}

  /* newsletter */
  .nl{background:linear-gradient(120deg,var(--teal),var(--teal-d)); border-radius:14px; padding:34px; text-align:center; color:#fff; margin:36px 0; box-shadow:0 8px 24px rgba(22,163,172,.25);}
  .nl h3{font-size:26px; font-weight:800; margin-bottom:6px;}
  .nl p{opacity:.92; margin-bottom:18px;}
  .nlform{display:flex; max-width:460px; margin:0 auto; gap:8px; flex-wrap:wrap; justify-content:center;}
  .nlform input{flex:1; min-width:220px; border:0; border-radius:26px; padding:13px 20px; font-size:14px; outline:none; color:var(--ink);}
  .nlform button{background:linear-gradient(var(--orange),var(--orange-d)); color:#fff; font-weight:700; padding:13px 28px; border-radius:26px; box-shadow:0 4px 12px rgba(0,0,0,.15);}

  /* footer */
  .ftr{background:var(--navy); color:#b7c0d3; padding:44px 0 20px; margin-top:20px;}
  .ftr a{color:#b7c0d3;} .ftr a:hover{color:#fff;}
  .ftr-top{display:grid; grid-template-columns:1.4fr 1fr 1fr 1fr; gap:30px; padding-bottom:28px; border-bottom:1px solid #3a4460;}
  .ftr-logo{font-size:24px; font-weight:800; color:#fff;}
  .ftr-logo span{color:var(--teal);}
  .ftr-top p{font-size:13px; margin:12px 0; color:#9aa5bd;}
  .social{display:flex; gap:10px;}
  .social a{width:36px; height:36px; border-radius:50%; background:#3a4460; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:#fff;}
  .ftr-col h4{color:#fff; font-size:14px; margin-bottom:14px;}
  .ftr-col ul{list-style:none;} .ftr-col li{margin-bottom:9px; font-size:13px;}
  .ftr-bot{display:flex; align-items:center; justify-content:space-between; padding-top:18px; flex-wrap:wrap; gap:12px; font-size:12px; color:#8a93aa;}
  .paymt{display:flex; gap:6px;}
  .paymt span{background:#fff; color:var(--navy); font-weight:800; font-size:10px; padding:5px 8px; border-radius:4px;}

  @media(max-width:960px){
    .feats{grid-template-columns:repeat(2,1fr);} .pgrid,.cat-grid{grid-template-columns:repeat(2,1fr);}
    .ftr-top{grid-template-columns:1fr 1fr;} .slide-img{display:none;} .hicon.acct{display:none;}
  }
  @media(max-width:560px){ .pgrid{grid-template-columns:1fr 1fr; gap:12px;} .search{display:none;} }
  @media(prefers-reduced-motion:reduce){ .b2015 *{transition:none !important; animation:none !important;} }
</style>

<div class="b2015">
  <div class="announce"><b>&#128666; FREE SHIPPING</b> on all orders over $99 &nbsp;&bull;&nbsp; Use code <b>WELCOME10</b> for 10% off your first order! <span class="x">&times;</span></div>

  <header class="hdr">
    <div class="bwrap hdr-in">
      <div class="logo">NO<span>RR</span></div>
      <div class="search">
        <input type="text" placeholder="Search for chairs, tables, lighting...">
        <button type="button">Search</button>
      </div>
      <div class="hicons">
        <span class="hicon acct"><span class="ic">&#9825;</span> Wishlist</span>
        <span class="hicon acct"><span class="ic">&#128100;</span> Account</span>
        <span class="cartpill"><span>&#128722; Cart</span><span class="cnt" id="cnt">0</span></span>
      </div>
    </div>
  </header>

  <nav class="mnav">
    <div class="mnav-in">
      <a href="#">Home</a>
      <a href="#">Furniture <span class="car">&#9660;</span></a>
      <a href="#">Chairs <span class="car">&#9660;</span></a>
      <a href="#">Tables <span class="car">&#9660;</span></a>
      <a href="#">Lighting</a>
      <a href="#">Decor <span class="car">&#9660;</span></a>
      <a href="#">Textiles</a>
      <a href="#" class="sale">&#128293; SALE</a>
      <a href="#">New Arrivals</a>
    </div>
  </nav>

  <div class="bwrap">
    <section class="hero">
      <div class="carousel" id="carousel">
        <div class="slide slide1 on">
          <div class="slide-txt">
            <span class="slide-ey">Mid-Season Sale</span>
            <h2>Up to 40% Off Furniture</h2>
            <p>Refresh your home with premium oak pieces at unbeatable prices. Limited time only!</p>
            <a href="#" class="shopbtn">Shop Now &#8594;</a>
          </div>
          <div class="slide-img"><img src="${IMG["dining-table"]}" alt="Dining table"></div>
        </div>
        <div class="slide slide2">
          <div class="slide-txt">
            <span class="slide-ey">Just Arrived</span>
            <h2>New Season Seating</h2>
            <p>Handcrafted chairs in sage &amp; natural oak. Free shipping on every order over $99.</p>
            <a href="#" class="shopbtn">Explore Collection &#8594;</a>
          </div>
          <div class="slide-img"><img src="${IMG["chair-sage"]}" alt="Dining chair"></div>
        </div>
        <button class="carr prev" id="cprev" type="button">&#8249;</button>
        <button class="carr next" id="cnext" type="button">&#8250;</button>
        <div class="cdots" id="cdots"><b class="on" data-i="0"></b><b data-i="1"></b></div>
      </div>
    </section>

    <div class="feats">
      <div class="feat"><span class="fi">&#128666;</span><div><b>Free Shipping</b><small>On orders over $99</small></div></div>
      <div class="feat"><span class="fi">&#8617;</span><div><b>Easy Returns</b><small>30-day money back</small></div></div>
      <div class="feat"><span class="fi">&#128274;</span><div><b>Secure Checkout</b><small>100% protected</small></div></div>
      <div class="feat"><span class="fi">&#128172;</span><div><b>24/7 Support</b><small>We're here to help</small></div></div>
    </div>

    <div class="deal">
      <div class="deal-img"><img src="${IMG["lamp-sage"]}" alt="Halo Desk Lamp"></div>
      <div class="deal-info">
        <div class="deal-tag">&#9889; Deal of the Day</div>
        <h3>Halo Desk Lamp - Sage Green</h3>
        <div class="dp">$95.00 <s>$149.99</s></div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:600;text-align:center;">HURRY! ENDS IN:</div>
        <div class="cd" id="cd">
          <div><b id="cd-h">07</b><small>Hrs</small></div>
          <div><b id="cd-m">42</b><small>Min</small></div>
          <div><b id="cd-s">18</b><small>Sec</small></div>
        </div>
      </div>
    </div>

    <section>
      <div class="sec-head">
        <h2>Featured Products <small>- On Sale!</small></h2>
        <a href="#" style="font-weight:600;">View All Products &#8594;</a>
      </div>
      <div class="ptabs">
        <button class="on" type="button">All</button><button type="button">Chairs</button><button type="button">Tables</button><button type="button">Lighting</button><button type="button">Decor</button>
      </div>
      <div class="pgrid">${cards}
      </div>
    </section>

    <section class="cats">
      <div class="sec-head"><h2>Shop by Category</h2></div>
      <div class="cat-grid">
        <div class="ctile"><img src="${IMG["armchair-spindle"]}" alt=""><span>Chairs</span></div>
        <div class="ctile"><img src="${IMG["dining-table"]}" alt=""><span>Tables</span></div>
        <div class="ctile"><img src="${IMG["lamp-scene"]}" alt=""><span>Lighting</span></div>
        <div class="ctile"><img src="${IMG["vase-ceramic"]}" alt=""><span>Decor</span></div>
      </div>
    </section>

    <section class="nl">
      <h3>Get 10% Off Your First Order!</h3>
      <p>Subscribe to our newsletter for exclusive deals, new arrivals &amp; interior tips.</p>
      <form class="nlform" id="nlform">
        <input type="email" placeholder="Enter your email address" required>
        <button type="submit">Subscribe</button>
      </form>
    </section>
  </div>

  <footer class="ftr">
    <div class="bwrap">
      <div class="ftr-top">
        <div>
          <div class="ftr-logo">NO<span>RR</span></div>
          <p>Your trusted online store for quality home furniture &amp; decor since 2011.</p>
          <div class="social"><a href="#">f</a><a href="#">t</a><a href="#">in</a><a href="#">&#9834;</a></div>
        </div>
        <div class="ftr-col"><h4>Shop</h4><ul><li><a href="#">Chairs</a></li><li><a href="#">Tables</a></li><li><a href="#">Lighting</a></li><li><a href="#">Decor</a></li><li><a href="#">Sale</a></li></ul></div>
        <div class="ftr-col"><h4>Customer Service</h4><ul><li><a href="#">Shipping Info</a></li><li><a href="#">Returns</a></li><li><a href="#">Order Tracking</a></li><li><a href="#">FAQ</a></li><li><a href="#">Contact Us</a></li></ul></div>
        <div class="ftr-col"><h4>About</h4><ul><li><a href="#">Our Story</a></li><li><a href="#">Blog</a></li><li><a href="#">Careers</a></li><li><a href="#">Privacy Policy</a></li><li><a href="#">Terms</a></li></ul></div>
      </div>
      <div class="ftr-bot">
        <span>&copy; 2016 NORR Furniture Store. All rights reserved.</span>
        <div class="paymt"><span>VISA</span><span>MC</span><span>AMEX</span><span>PayPal</span><span>&#63743;Pay</span></div>
      </div>
    </div>
  </footer>
</div>

<script>
(function(){
  var root=document.querySelector('.b2015'); if(!root) return;
  var reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;

  // carousel
  var slides=root.querySelectorAll('.slide'), dots=root.querySelectorAll('#cdots b'), cur=0, t;
  function show(i){ cur=(i+slides.length)%slides.length;
    slides.forEach(function(s,x){ s.classList.toggle('on',x===cur); });
    dots.forEach(function(d,x){ d.classList.toggle('on',x===cur); }); }
  dots.forEach(function(d){ d.addEventListener('click',function(){ show(+d.dataset.i); rst(); }); });
  document.getElementById('cnext').addEventListener('click',function(){ show(cur+1); rst(); });
  document.getElementById('cprev').addEventListener('click',function(){ show(cur-1); rst(); });
  function rst(){ if(reduce) return; clearInterval(t); t=setInterval(function(){ show(cur+1); },4500); }
  rst();

  // cart
  var n=0, cnt=document.getElementById('cnt');
  root.querySelectorAll('.addcart').forEach(function(b){ b.addEventListener('click',function(){
    n++; cnt.textContent=n; var o=b.innerHTML; b.innerHTML='&#10004; Added!'; b.classList.add('done');
    setTimeout(function(){ b.innerHTML=o; b.classList.remove('done'); },1100); }); });
  root.querySelectorAll('.wish').forEach(function(w){ w.addEventListener('click',function(){ w.classList.toggle('on'); }); });

  // countdown
  var H=document.getElementById('cd-h'),M=document.getElementById('cd-m'),S=document.getElementById('cd-s');
  var left=7*3600+42*60+18;
  function tick(){ left=left<=0?7*3600+42*60+18:left-1; var h=left/3600|0,m=(left%3600)/60|0,s=left%60;
    H.textContent=String(h).padStart(2,'0'); M.textContent=String(m).padStart(2,'0'); S.textContent=String(s).padStart(2,'0'); }
  if(!reduce){ tick(); setInterval(tick,1000); }

  // newsletter
  var nf=document.getElementById('nlform');
  nf.addEventListener('submit',function(e){ e.preventDefault();
    nf.innerHTML='<div style="color:#fff;font-weight:600;padding:10px;">&#10004; Thanks for subscribing! Check your inbox for your 10% code.</div>'; });
})();
</script>`;

await writeFile(path.resolve("design/mockup-assets/tienda-antes.html"), html);
console.log("wrote tienda-antes.html —", (html.length / 1024).toFixed(0), "KB");

// also publish a standalone document for the live site to serve via
// <iframe src="/mockups/...">  on /upgrade — see build-mockup-after.mjs.
const doc = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
${html}
</body></html>`;
await mkdir(path.resolve("public/mockups"), { recursive: true });
await writeFile(path.resolve("public/mockups/tienda-antes.html"), doc);
console.log("wrote public/mockups/tienda-antes.html —", (doc.length / 1024).toFixed(0), "KB");
