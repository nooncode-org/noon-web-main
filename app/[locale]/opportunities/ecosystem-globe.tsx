"use client";

/**
 * EcosystemGlobe — the /opportunities hero signature illustration.
 *
 * A real 3D wireframe globe (react-globe.gl / three.js): just the graticule
 * lat/long grid on a transparent canvas — fully static (no rotation, no
 * markers), themed to our tokens (flat/mono: an opaque background-coloured
 * sphere occludes the back so only the front hemisphere's grid shows).
 *
 * Loaded client-side only (WebGL) via a lazy import so three.js never touches
 * SSR and doesn't weigh on the rest of the site's bundle.
 *
 * Framing (`applyView`) is set from `onGlobeReady` — running it in a mount
 * effect can fire before the globe's camera exists, leaving the library's
 * default (closer) framing that overflows the canvas and clips the poles. The
 * camera is pinned to the equatorial plane so the sphere stays vertically
 * centred; altitude leaves margin so the whole sphere fits the square canvas.
 */

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const ALTITUDE = 1.8;

type GlobeProps = Record<string, unknown> & { ref?: unknown };

export function EcosystemGlobe() {
  const wrapRef = useRef<HTMLDivElement>(null);
  // globe.gl instance (typed loosely — react-globe.gl ships no ref types)
  const globeRef = useRef<any>(null);
  const [Globe, setGlobe] = useState<ComponentType<GlobeProps> | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [dark, setDark] = useState(true);

  // client-only lazy import (keeps three.js out of SSR + other bundles)
  useEffect(() => {
    let alive = true;
    import("react-globe.gl").then((mod) => {
      if (alive) setGlobe(() => mod.default as unknown as ComponentType<GlobeProps>);
    });
    return () => {
      alive = false;
    };
  }, []);

  // measure the wrap's real width AND height so the canvas exactly fills its box
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // track light/dark (drives the sphere + line colours)
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  // the sphere itself: opaque, coloured like the page background, so it stays
  // invisible against the page while occluding the back half of the graticule.
  const globeMaterial = useMemo(() => new THREE.MeshBasicMaterial(), []);

  // camera framing + controls — call from onGlobeReady (reliable) and on resize.
  // Fully static: no auto-rotation and no user interaction.
  const applyView = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = false;
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    // pin to the equatorial plane so the sphere stays vertically centred.
    controls.minPolarAngle = Math.PI / 2;
    controls.maxPolarAngle = Math.PI / 2;
    g.pointOfView({ lat: 0, lng: 0, altitude: ALTITUDE });
  }, []);

  // re-apply on resize (framing itself is size-independent, but keeps controls
  // coherent if the instance is recreated).
  useEffect(() => {
    if (dims.w && dims.h) applyView();
  }, [dims.w, dims.h, Globe, applyView]);

  // theme-driven colours: sphere = bg, graticule = a mid grey visible on both.
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !dims.w) return;
    globeMaterial.color.set(dark ? "#000000" : "#ffffff");
    globeMaterial.needsUpdate = true;
    g.scene().traverse((o: THREE.Object3D) => {
      const mat = (o as THREE.Line).material as THREE.LineBasicMaterial | undefined;
      if ((o.type === "LineSegments" || o.type === "Line") && mat && "color" in mat) {
        mat.color.set(dark ? "#5c5c5c" : "#c2c7d4");
        mat.transparent = true;
        mat.opacity = dark ? 0.75 : 0.9;
      }
    });
  }, [dark, dims.w, Globe, globeMaterial]);

  return (
    <div ref={wrapRef} className="opp-globe-wrap" aria-hidden>
      {Globe && dims.w > 0 && dims.h > 0 ? (
        <Globe
          ref={globeRef}
          width={dims.w}
          height={dims.h}
          animateIn={false}
          onGlobeReady={applyView}
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere={false}
          showGraticules
          globeMaterial={globeMaterial}
        />
      ) : null}
    </div>
  );
}
