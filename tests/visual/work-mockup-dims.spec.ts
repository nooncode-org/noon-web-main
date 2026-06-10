import { expect, test } from "@playwright/test";

// The /work mockups are self-contained HTML docs rendered inside
// constant-viewport iframes: app/[locale]/work/page.tsx declares each mockup's
// authoring size (w/h) and WorkShot scales the frame from the parent. Those
// numbers are hand-transcribed from the build pipeline, and nothing else links
// them to the actual files — a re-exported mockup with a different authoring
// size would silently render cropped or letterboxed. This spec makes the
// coupling mechanical: load /work, let every lazy iframe come in, and assert
// each iframe's declared CSS size matches the embedded document's intrinsic
// scroll size.
test("work mockup declared dims match each document's intrinsic size", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/work", { waitUntil: "networkidle" });

  const frames = page.locator('iframe[src*="/work/mockups/"]');
  await expect(frames).toHaveCount(6);

  for (let i = 0; i < 6; i++) {
    const frame = frames.nth(i);
    await frame.scrollIntoViewIfNeeded(); // trigger lazy load
    const src = (await frame.getAttribute("src"))!;
    const declared = await frame.evaluate((el) => ({
      w: parseFloat((el as HTMLIFrameElement).style.width),
      h: parseFloat((el as HTMLIFrameElement).style.height),
    }));

    const doc = page.frameLocator(`iframe[src="${src}"]`).locator("html");
    await expect(doc).toBeAttached({ timeout: 15_000 });
    // settle: self-hosted fonts can shift the content height by a line
    await doc.evaluate((el) => el.ownerDocument!.fonts.ready);
    const intrinsic = await doc.evaluate((el) => {
      const d = el.ownerDocument!;
      return { w: d.documentElement.scrollWidth, h: d.documentElement.scrollHeight };
    });

    // width must match exactly (scrollWidth > clientWidth means h-overflow);
    // height gets ±2px for sub-pixel/font rounding.
    expect.soft(intrinsic.w, `${src}: declared w=${declared.w}, intrinsic=${intrinsic.w}`).toBe(declared.w);
    expect
      .soft(
        Math.abs(intrinsic.h - declared.h),
        `${src}: declared h=${declared.h}, intrinsic=${intrinsic.h}`,
      )
      .toBeLessThanOrEqual(2);
  }
});
