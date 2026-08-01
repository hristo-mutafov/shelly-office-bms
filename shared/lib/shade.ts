// Lightens/darkens a hex color by a flat per-channel amount — used to fake
// per-face lighting on the CSS 3D shapes (Box3D, RoofPrism) without needing
// real lighting math.
export function shade(hex: string, amount: number): string {
    const num = Number.parseInt(hex.replace('#', ''), 16);
    const clamp = (v: number) => Math.min(255, Math.max(0, v));
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0xff) + amount);
    const b = clamp((num & 0xff) + amount);
    return `rgb(${r}, ${g}, ${b})`;
}
