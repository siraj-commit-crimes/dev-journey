// Builds Mahmoud's one-page PDF comp card in the browser from the site's
// current photos and measurements, so it is always up to date.

type Detail = { label: string; value: string };
type CardInput = {
  heroUrl: string;
  photos: string[];
  details: Detail[];
  email: string;
  instagram: string;
  whatsapp: string;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });

// Crop the image to fill a w x h (mm) box, like CSS object-fit: cover.
const coverJpeg = (img: HTMLImageElement, wMm: number, hMm: number, focusY = 0.25) => {
  const pxPerMm = 10;
  const cw = Math.round(wMm * pxPerMm);
  const ch = Math.round(hMm * pxPerMm);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const sw = cw / scale;
  const sh = ch / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = Math.max(0, Math.min(img.naturalHeight - sh, (img.naturalHeight - sh) * focusY));
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", 0.88);
};

export async function downloadCompCard(input: CardInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ink: [number, number, number] = [23, 23, 26];
  const grey: [number, number, number] = [110, 108, 114];
  const line: [number, number, number] = [214, 211, 206];
  const M = 12;

  doc.setFillColor(243, 242, 239);
  doc.rect(0, 0, 210, 297, "F");

  const [hero, ...rest] = await Promise.all([input.heroUrl, ...input.photos.slice(0, 8)].map((u) => loadImage(u).catch(() => null)));
  if (hero) doc.addImage(coverJpeg(hero, 100, 140, 0.15), "JPEG", M, M, 100, 140);

  // Name and title
  const x = 122;
  const right = 198;
  doc.setTextColor(...ink);
  doc.setFont("times", "normal");
  doc.setFontSize(32);
  doc.text("MAHMOUD", x, 38, { charSpace: 1.2 });
  doc.text("HAIDAR", x, 51, { charSpace: 1.2 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...grey);
  doc.text("PROFESSIONAL MODEL  ·  LEBANON", x, 62, { charSpace: 0.9 });

  // Measurements
  let y = 82;
  for (const d of input.details) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...grey);
    doc.text(d.label.toUpperCase(), x, y, { charSpace: 0.8 });
    doc.setFont("times", "normal");
    doc.setFontSize(15);
    doc.setTextColor(...ink);
    doc.text(d.value, right, y, { align: "right" });
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.line(x, y + 3.5, right, y + 3.5);
    y += 13;
  }

  // Photo grid: two rows of four
  const gw = (210 - 2 * M - 3 * 4) / 4;
  const gh = 58;
  rest.forEach((img, i) => {
    if (!img) return;
    const col = i % 4;
    const row = Math.floor(i / 4);
    doc.addImage(coverJpeg(img, gw, gh, 0.2), "JPEG", M + col * (gw + 4), 162 + row * (gh + 6), gw, gh);
  });

  // Contact line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...grey);
  const handle = `@${input.instagram.replace(/^@/, "")}`;
  doc.text(`${input.email}   ·   ${handle}   ·   ${input.whatsapp}   ·   ${location.host}`, 105, 291, { align: "center" });

  doc.save("Mahmoud-Haidar-comp-card.pdf");
}
