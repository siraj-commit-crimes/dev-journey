// Fallback content shown until (or if) the database responds.
// The live content is managed from /admin.
import hero from "@/assets/hero.jpg";
import g1 from "@/assets/gallery-1.jpg";
import g2 from "@/assets/gallery-2.jpg";
import g3 from "@/assets/gallery-3.jpg";
import g4 from "@/assets/gallery-4.jpg";
import g5 from "@/assets/gallery-5.jpg";
import g6 from "@/assets/gallery-6.jpg";
import g7 from "@/assets/gallery-7.jpg";
import g8 from "@/assets/gallery-8.jpg";
import g9 from "@/assets/gallery-9.jpg";
import g10 from "@/assets/gallery-10.jpg";
import g11 from "@/assets/gallery-11.jpg";
import g12 from "@/assets/gallery-12.jpg";
import g13 from "@/assets/gallery-13.jpg";
import g14 from "@/assets/gallery-14.jpg";
import g15 from "@/assets/gallery-15.jpg";
import g16 from "@/assets/gallery-16.jpg";
import g17 from "@/assets/gallery-17.jpg";
import g18 from "@/assets/gallery-18.jpg";
import g19 from "@/assets/gallery-19.jpg";
import g20 from "@/assets/gallery-20.jpg";
import g21 from "@/assets/gallery-21.jpg";
import g22 from "@/assets/gallery-22.jpg";
import g23 from "@/assets/gallery-23.jpg";
import brand1 from "@/assets/brand1.jpg";
import brand2 from "@/assets/brand2.jpg";
import brand3 from "@/assets/brand3.jpg";
import brand4 from "@/assets/brand4.jpg";
import brand5 from "@/assets/brand5.jpg";
import brand6 from "@/assets/brand6.jpg";
import actGeorge from "@/assets/brand-activity-georgehobaika.jpg";
import actMagrabi from "@/assets/brand-activity-magrebi.jpg";
import actAbc from "@/assets/brand-activity-ABCLebanon.jpg";
import actElegance from "@/assets/brand-activity-elegance.jpg";
import actPerrier from "@/assets/brand-activity-perrier.jpg";
import actCasper from "@/assets/brand-activity-casper.jpg";

export const heroImage = hero;

export const defaultGallery = [
  g22, g21, g2, g6, g7, g9, g1, g11, g15, g16, g20, g5,
  g10, g17, g18, g13, g12, g3, g19, g23, g4, g8, g14,
];

export const defaultDetails = [
  { label: "Height", value: "181 cm" },
  { label: "Shoulder", value: "60 cm" },
  { label: "Waist", value: "90 cm" },
  { label: "Shoe Size", value: "43 EU" },
];

export type Brand = { name: string; logo: string; activityImage: string };

export const defaultBrands: Brand[] = [
  { name: "Georges Hobeika", logo: brand1, activityImage: actGeorge },
  { name: "Magrabi", logo: brand2, activityImage: actMagrabi },
  { name: "ABC Lebanon", logo: brand3, activityImage: actAbc },
  { name: "Elegance", logo: brand4, activityImage: actElegance },
  { name: "Perrier", logo: brand5, activityImage: actPerrier },
  { name: "Casper", logo: brand6, activityImage: actCasper },
];
