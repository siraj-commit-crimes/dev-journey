import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Instagram, Mail, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import ScrollReveal from "@/components/ScrollReveal";
import { supabase } from "@/lib/supabase";
import { defaultBrands, defaultDetails, defaultGallery, type Brand } from "@/lib/content";
import { instagramUrl, useSiteSettings, videoPoster, videoSrc, whatsappUrl } from "@/lib/settings";
import { downloadCompCard } from "@/lib/compCard";
import BookingForm from "@/components/BookingForm";

// Browsers only allow autoplay when the video is muted. React does not reliably
// set the `muted` attribute, so set it on the element directly and start playback.
const startMuted = (v: HTMLVideoElement | null) => {
  if (!v) return;
  v.muted = true;
  v.defaultMuted = true;
  v.play().catch(() => {});
};

export const scrollToSection = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

const SectionTitle = ({ children }: { children: string }) => (
  <h2 className="text-section-title text-foreground">{children}</h2>
);

const Index = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>(defaultGallery);
  const [details, setDetails] = useState(defaultDetails);
  const [brands, setBrands] = useState<Brand[]>(defaultBrands);
  const [making, setMaking] = useState(false);
  const site = useSiteSettings();
  const location = useLocation();

  useEffect(() => {
    (async () => {
      const [g, d, b] = await Promise.all([
        supabase.from("gallery_images").select("*").order("sort_order"),
        supabase.from("details").select("*").order("sort_order"),
        supabase.from("brands").select("*").order("sort_order"),
      ]);
      if (g.data && g.data.length > 0) setGallery(g.data.map((r) => r.image_url));
      if (d.data && d.data.length > 0) setDetails(d.data.map((r) => ({ label: r.label, value: r.value })));
      if (b.data && b.data.length > 0)
        setBrands(b.data.map((r) => ({ name: r.name, logo: r.logo_url, activityImage: r.activity_image_url })));
    })();
  }, []);

  // Menu links from other pages arrive with the section to scroll to.
  useEffect(() => {
    const id = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (id) setTimeout(() => scrollToSection(id), 100);
  }, [location.state]);

  const makeCard = async () => {
    setMaking(true);
    try {
      await downloadCompCard({
        heroUrl: site.hero_image_url,
        // Skip the first gallery photo: it is usually the same shot as the main photo.
        photos: gallery.slice(1),
        details,
        email: site.email,
        instagram: site.instagram,
        whatsapp: site.whatsapp,
      });
    } catch {
      toast.error("Couldn't make the comp card", { description: "Check your connection and try again." });
    }
    setMaking(false);
  };

  const contacts = [
    { label: "Email", value: site.email, href: `mailto:${site.email}`, Icon: Mail },
    { label: "Instagram", value: `@${site.instagram.replace(/^@/, "")}`, href: instagramUrl(site.instagram), Icon: Instagram },
    { label: "WhatsApp", value: site.whatsapp, href: whatsappUrl(site.whatsapp), Icon: MessageCircle },
  ];

  return (
    <main className="pt-[68px] md:pt-[76px]">
      {/* Comp card: photo + measurements */}
      <section className="grid md:grid-cols-2 md:min-h-[calc(100svh-76px)]">
        <div className="relative h-[72svh] md:h-auto overflow-hidden bg-secondary">
          <img
            src={site.hero_image_url}
            alt="Mahmoud Haidar - Professional Model"
            className={`absolute inset-0 w-full h-full object-cover object-[50%_18%] transition-opacity duration-500 ${site.loaded ? "opacity-100" : "opacity-0"}`}
          />
        </div>
        <div className="flex flex-col justify-center gap-7 px-6 py-10 md:px-16 md:py-14">
          <h1 className="font-display font-light text-[3rem] md:text-[clamp(3.5rem,5.4vw,5rem)] leading-[0.92] tracking-[0.05em] uppercase text-foreground animate-fade-up">
            Mahmoud
            <br />
            Haidar
          </h1>
          <p className="text-detail-label animate-fade-up-delay-1">Professional Model · Lebanon</p>
          <dl className="grid grid-cols-2 gap-x-6 md:gap-x-10 gap-y-3.5 tabular-nums">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between items-baseline border-b border-border pb-2.5">
                <dt className="text-detail-label">{d.label}</dt>
                <dd className="text-detail-value text-foreground">{d.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={makeCard}
              disabled={making}
              className="flex-1 md:flex-none text-nav font-normal bg-foreground text-background border border-foreground px-5 py-3.5 disabled:opacity-60"
            >
              {making ? "Preparing..." : "Download comp card"}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("contact")}
              className="flex-1 md:flex-none text-nav font-normal border border-foreground text-foreground px-5 py-3.5"
            >
              Contact
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {gallery.slice(1, 5).map((src, i) => (
              <button key={i} type="button" onClick={() => setPreview(src)} className="block">
                <img src={src} alt="" className="w-full aspect-[4/5] object-cover object-[50%_15%]" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="border-t border-border py-14 md:py-24 px-6 md:px-12">
        <ScrollReveal className="max-w-5xl mx-auto grid md:grid-cols-[1fr_1.4fr] gap-4 md:gap-16">
          <SectionTitle>About</SectionTitle>
          <p className="text-foreground/70 leading-[1.85] text-sm md:text-base whitespace-pre-line">{site.about_text}</p>
        </ScrollReveal>
      </section>

      {/* Portfolio */}
      <section id="portfolio" className="scroll-mt-20 border-t border-border py-14 md:py-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <SectionTitle>Portfolio</SectionTitle>
          </ScrollReveal>
          <div className="mt-8 md:mt-10 grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3.5">
            {gallery.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPreview(src)}
                className="w-full aspect-[4/5] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
              >
                <img
                  src={src}
                  alt={`Mahmoud Haidar portfolio photo ${i + 1}`}
                  className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Brands: each brand's campaign photo with its logo */}
      <section id="brands" className="scroll-mt-20 border-t border-border py-14 md:py-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <SectionTitle>Brands</SectionTitle>
          </ScrollReveal>
          <div className="mt-8 md:mt-10 flex flex-wrap justify-center gap-2.5 md:gap-3.5">
            {brands.map((b, i) => (
              <figure
                key={i}
                className="m-0 w-[calc(50%-5px)] md:w-[calc((100%-28px)/3)] lg:w-[calc((100%-42px)/4)] bg-white flex flex-col"
              >
                {b.activityImage && (
                  <button type="button" onClick={() => setPreview(b.activityImage)} className="block w-full aspect-[4/5] overflow-hidden">
                    <img
                      src={b.activityImage}
                      alt={b.name ? `Mahmoud Haidar for ${b.name}` : "Mahmoud Haidar brand campaign"}
                      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                      loading="lazy"
                    />
                  </button>
                )}
                <figcaption className="h-16 md:h-20 flex items-center justify-center p-2.5">
                  <img src={b.logo} alt={b.name || "Brand logo"} className="max-h-full max-w-[80%] object-contain" loading="lazy" />
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Video */}
      <section id="video" className="scroll-mt-20 border-t border-border py-14 md:py-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <SectionTitle>Runway</SectionTitle>
          </ScrollReveal>
          <div className="mt-8 md:mt-10 aspect-video bg-black overflow-hidden">
            <video
              key={site.video_url}
              src={videoSrc(site.video_url)}
              poster={videoPoster(site.video_url)}
              ref={startMuted}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              controls
              className="w-full h-full object-cover"
            >
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="text-muted-foreground text-sm mt-4 tracking-wide">{site.video_caption}</p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 border-t border-border py-14 md:py-24 px-6 md:px-12">
        <ScrollReveal className="max-w-5xl mx-auto">
          <SectionTitle>Contact</SectionTitle>
          <p className="mt-4 text-foreground/70 text-sm md:text-base">Send a booking request on WhatsApp or by email, or reach Mahmoud directly below.</p>
          <div className="mt-8 md:mt-10">
            <BookingForm email={site.email} whatsapp={site.whatsapp} />
          </div>
          <div className="mt-10 md:mt-12 grid md:grid-cols-3 gap-2.5 md:gap-3.5">
            {contacts.map(({ label, value, href, Icon }) => (
              <a
                key={label}
                href={href}
                target={label === "Email" ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="bg-white p-5 md:p-6 flex flex-col gap-1.5 hover:bg-white/70 transition-colors"
              >
                <span className="text-detail-label flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </span>
                <span className="text-foreground text-[15px] break-words">{value}</span>
              </a>
            ))}
          </div>
        </ScrollReveal>
      </section>

      <footer className="py-8 px-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground tracking-[0.15em] uppercase">© 2026 Mahmoud Haidar. All rights reserved.</p>
      </footer>

      {preview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={preview} alt="Portfolio preview" className="max-w-full max-h-[90vh] w-auto h-auto object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </main>
  );
};

export default Index;
