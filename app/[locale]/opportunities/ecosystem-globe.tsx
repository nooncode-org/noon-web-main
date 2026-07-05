/**
 * EcosystemGlobe — the /opportunities hero signature illustration.
 *
 * A pure-SVG 2D wireframe globe, STRAIGHT-ON (equatorial): outline + vertical
 * meridian ellipses + straight horizontal parallel lines, with the Noon isotype
 * centred and a soft blue pulse that RADIATES from the logo.
 *
 * The pulse is a single RADIAL gradient centred on the logo with a soft bright
 * ring whose offset animates outward (SMIL). Blue copies of every grid line take
 * that gradient as their stroke, so each line lights up exactly where the ring
 * crosses it — every line, straight OR curved, ignites from the point nearest the
 * logo and spreads out. One centre, one wave. Same width as the base line, so the
 * grey line stays the protagonist. Deterministic SVG — never distorts or clips.
 */

import { NoonMark } from "@/components/brand/noon-logo";

const R = 94; // sphere radius within the 200×200 viewBox
const C = 100; // centre
const rad = (d: number) => (d * Math.PI) / 180;

// meridians (longitude) → vertical ellipses through both poles, rx = R·sin(lon).
const MERIDIANS = [22.5, 45, 67.5].map((lon) => +(R * Math.sin(rad(lon))).toFixed(2));

// parallels (latitude) → straight horizontal chords at each latitude band.
const PARALLELS = [0, 22.5, 45, 67.5].flatMap((lat) => {
  const halfW = +(R * Math.cos(rad(lat))).toFixed(2);
  const dy = +(R * Math.sin(rad(lat))).toFixed(2);
  const ys = lat === 0 ? [C] : [C - dy, C + dy];
  return ys.map((y) => ({ y, x1: +(C - halfW).toFixed(2), x2: +(C + halfW).toFixed(2) }));
});

const DUR = "3.2s";

export function EcosystemGlobe() {
  return (
    <div className="opp-globe-wrap" aria-hidden>
      <svg className="opp-globe-svg" viewBox="0 0 200 200" fill="none" role="presentation">
        <defs>
          {/* soft bright ring, centred on the logo, whose radius grows outward */}
          <radialGradient id="oppRadial" cx={C} cy={C} r={R} gradientUnits="userSpaceOnUse">
            <stop className="opp-pulse-stop" offset="0" stopOpacity="0">
              <animate attributeName="offset" values="0;0.92" dur={DUR} repeatCount="indefinite" />
            </stop>
            <stop className="opp-pulse-stop" offset="0.09" stopOpacity="0.9">
              <animate attributeName="offset" values="0.09;1.01" dur={DUR} repeatCount="indefinite" />
            </stop>
            <stop className="opp-pulse-stop" offset="0.18" stopOpacity="0">
              <animate attributeName="offset" values="0.18;1.1" dur={DUR} repeatCount="indefinite" />
            </stop>
          </radialGradient>
        </defs>

        {/* static grey wireframe */}
        <circle cx={C} cy={C} r={R} />
        <line x1={C} y1={C - R} x2={C} y2={C + R} />
        {MERIDIANS.map((rx) => (
          <ellipse key={`m${rx}`} cx={C} cy={C} rx={rx} ry={R} />
        ))}
        {PARALLELS.map((p, i) => (
          <line key={`p${i}`} x1={p.x1} y1={p.y} x2={p.x2} y2={p.y} />
        ))}

        {/* blue pulse — one ring expanding from the logo lights every line */}
        <line className="opp-globe-pulse" x1={C} y1={C - R} x2={C} y2={C + R} stroke="url(#oppRadial)" />
        {MERIDIANS.map((rx) => (
          <ellipse key={`bm${rx}`} className="opp-globe-pulse" cx={C} cy={C} rx={rx} ry={R} stroke="url(#oppRadial)" />
        ))}
        {PARALLELS.map((p, i) => (
          <line key={`bp${i}`} className="opp-globe-pulse" x1={p.x1} y1={p.y} x2={p.x2} y2={p.y} stroke="url(#oppRadial)" />
        ))}
      </svg>
      <span className="opp-globe-logo">
        <NoonMark />
      </span>
    </div>
  );
}
