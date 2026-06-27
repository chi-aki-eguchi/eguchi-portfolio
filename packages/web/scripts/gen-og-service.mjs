// Generates the site's social cards.
// 1200x630, quiet off-white to match akieguchi.com's tone. Re-run after editing:
//   cd packages/web && bun scripts/gen-og-service.mjs
import sharp from "sharp";

const W = 1200, H = 630;

const serviceSvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#f5f4f1"/>
  <rect x="44" y="44" width="${W - 88}" height="${H - 88}" fill="none" stroke="#e2ddd6" stroke-width="1.5"/>
  <text x="${W / 2}" y="248" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="30" letter-spacing="9" fill="#a39c92">PORTFOLIO FOR PHOTOGRAPHERS</text>
  <text x="${W / 2}" y="350" text-anchor="middle" font-family="'Hiragino Mincho ProN', 'YuMincho', 'Noto Serif JP', 'Yu Mincho', serif" font-size="62" letter-spacing="4" fill="#2c2824">写真家のためのポートフォリオ</text>
  <line x1="${W / 2 - 60}" y1="402" x2="${W / 2 + 60}" y2="402" stroke="#c3bdb3" stroke-width="1"/>
  <text x="${W / 2}" y="452" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="25" letter-spacing="3" fill="#8c857b">akieguchi.com</text>
</svg>`;

const portfolioSvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#f5f4f1"/>
  <rect x="64" y="64" width="${W - 128}" height="${H - 128}" fill="none" stroke="#ded8cf" stroke-width="1.5"/>
  <rect x="212" y="146" width="308" height="338" fill="#d9d4cc"/>
  <rect x="540" y="146" width="188" height="160" fill="#b9b2a7"/>
  <rect x="540" y="324" width="188" height="160" fill="#cec8be"/>
  <rect x="748" y="146" width="240" height="338" fill="#aaa296"/>
  <text x="${W / 2}" y="536" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="25" letter-spacing="8" fill="#827a70">PHOTOGRAPHY PORTFOLIO</text>
</svg>`;

await sharp(Buffer.from(serviceSvg))
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile("public/og-service.jpg");

await sharp(Buffer.from(portfolioSvg))
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile("public/og-image.jpg");

console.log("Wrote public/og-service.jpg and public/og-image.jpg (1200x630)");
