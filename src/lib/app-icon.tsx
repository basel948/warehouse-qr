import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

// Square app icon (browser tab, phone home screen) drawn from the Royal Stock
// logo: its crown over an "RS" monogram in the logo's orange and blue. The
// full wordmark is too wide to stay readable at icon sizes.
const ORANGE = "#F6A31D";

// The admin app gets a black version so the two home-screen icons are easy to
// tell apart. The logo's dark blue is too dim on black, so it's lightened there.
const THEMES = {
  light: { background: "#FFFFFF", crown: "#111111", blue: "#045BB5" },
  dark: { background: "#111111", crown: "#FFFFFF", blue: "#4A9BFF" },
} as const;

// The generator's built-in font has no bold; the logo's letters are heavy, so
// use the bold font the order PDF already ships.
const boldFont = fs.readFileSync(path.join(process.cwd(), "src/assets/fonts/Alef-Bold.ttf"));

export function renderAppIcon(size: number, theme: keyof typeof THEMES = "light") {
  const unit = size / 100;
  const { background, crown, blue } = THEMES[theme];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={30 * unit} height={19 * unit} viewBox="0 0 34 22">
          <path d="M2 8 L9 13 L17 3 L25 13 L32 8 L29 20 L5 20 Z" fill={crown} />
          <circle cx="2" cy="7" r="2.2" fill={crown} />
          <circle cx="17" cy="2.4" r="2.2" fill={crown} />
          <circle cx="32" cy="7" r="2.2" fill={crown} />
        </svg>
        <div
          style={{
            display: "flex",
            fontFamily: "Alef",
            fontSize: 56 * unit,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: -1 * unit,
            marginTop: -9 * unit,
          }}
        >
          <span style={{ color: ORANGE }}>R</span>
          <span style={{ color: blue }}>S</span>
        </div>
      </div>
    ),
    { width: size, height: size, fonts: [{ name: "Alef", data: boldFont, weight: 700 }] }
  );
}
