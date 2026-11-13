import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

/** Hex tokens declared in a CSS block. */
function tokens(block: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/--helm-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    found[match[1]] = match[2];
  }
  return found;
}

const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const darkEnd = css.indexOf("html[data-vibrancy='on']");
const light = tokens(css.slice(0, darkStart));
const dark = tokens(css.slice(darkStart, darkEnd));

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const SURFACES = ['window', 'surface', 'raised', 'sunken', 'terminal'];
const FOREGROUNDS = [
  'fg',
  'fg-muted',
  'fg-subtle',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'purple',
  'gold',
];
const SOLIDS = ['accent-solid', 'success-solid', 'danger-solid'];
const WCAG_AA_NORMAL_TEXT = 4.5;

describe.each([
  ['light', light],
  ['dark', dark],
])('design tokens — %s appearance', (_name, theme) => {
  test('defines every semantic token', () => {
    for (const token of [...SURFACES, ...FOREGROUNDS, ...SOLIDS, 'on-solid']) {
      expect(theme[token], `missing --helm-${token}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  test.each(FOREGROUNDS)('%s text meets WCAG AA on every surface', (foreground) => {
    for (const surface of SURFACES) {
      const ratio = contrast(theme[foreground], theme[surface]);
      expect(ratio, `${foreground} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL_TEXT
      );
    }
  });

  test.each(SOLIDS)('text on a %s control meets WCAG AA', (solid) => {
    const ratio = contrast(theme['on-solid'], theme[solid]);
    expect(ratio, `on-solid on ${solid} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT
    );
  });
});

describe('type scale', () => {
  test('sizes below 20px carry SF Pro Text tracking and 20px+ switch to SF Pro Display', () => {
    expect(css).toContain("--font-sf: 'SF Pro Text'");
    expect(css).toContain("--font-display: 'SF Pro Display'");
    for (const size of ['caption2', 'caption', 'body', 'callout', 'headline', 'title3']) {
      const px = Number(css.match(new RegExp(`--text-${size}: (\\d+)px`))?.[1]);
      expect(px, size).toBeLessThan(20);
      expect(css).toMatch(new RegExp(`--text-${size}--letter-spacing: -?[\\d.]+px`));
    }
    for (const size of ['title2', 'title1', 'large']) {
      const px = Number(css.match(new RegExp(`--text-${size}: (\\d+)px`))?.[1]);
      expect(px, size).toBeGreaterThanOrEqual(20);
    }
    expect(css).toMatch(/\.text-title2,\s*\.text-title1,\s*\.text-large\s*\{\s*font-family: var\(--font-display\)/);
  });
});
