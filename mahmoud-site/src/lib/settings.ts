import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { heroImage } from "@/lib/content";
import defaultVideo from "@/assets/video.mp4";

// Everything editable from the admin "Site" tab. Values live in the
// `site_settings` table (key/value). Anything missing falls back to these.
export const defaultSettings = {
  hero_image_url: heroImage,
  about_text:
    "Mahmoud Haidar is a professional model based in Lebanon, known for his striking presence and versatility. With experience in editorial, commercial, and runway work, he brings a refined intensity to every project. His portfolio spans collaborations with leading fashion houses and photographers across the region.",
  video_url: defaultVideo,
  video_caption: "Georges Hobeika - Fashion Show.",
  email: "mahmoudhaidarr00@gmail.com",
  instagram: "mahmoudhaidar_",
  whatsapp: "+961 79 132 606",
};

export type SiteSettings = typeof defaultSettings;
export type SettingKey = keyof SiteSettings;

export const loadSettings = async (): Promise<Partial<SiteSettings>> => {
  const { data, error } = await supabase.from("site_settings").select("key,value");
  if (error || !data) return {};
  const out: Partial<SiteSettings> = {};
  for (const row of data) {
    if (row.key in defaultSettings && typeof row.value === "string" && row.value.trim() !== "")
      out[row.key as SettingKey] = row.value;
  }
  return out;
};

export const useSiteSettings = () => {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loadSettings().then((s) => {
      setSettings({ ...defaultSettings, ...s });
      setLoaded(true);
    });
  }, []);
  return { ...settings, loaded };
};

export const instagramUrl = (handle: string) => `https://instagram.com/${handle.replace(/^@/, "").trim()}`;
export const whatsappUrl = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;
