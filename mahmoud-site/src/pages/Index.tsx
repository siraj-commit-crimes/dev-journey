import { useEffect, useState } from "react";
import { ChevronDown, Instagram, Mail, MessageCircle, X } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import Brands from "@/pages/Brands";
import { supabase } from "@/lib/supabase";
import { defaultDetails, defaultGallery, heroImage } from "@/lib/content";

const Index = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>(defaultGallery);
  const [details, setDetails] = useState(defaultDetails);

  useEffect(() => {
    (async () => {
      const [g, d] = await Promise.all([
        supabase.from("gallery_images").select("*").order("sort_order"),
        supabase.from("details").select("*").order("sort_order"),
      ]);
      if (g.data && g.data.length > 0) setGallery(g.data.map((r) => r.image_url));
      if (d.data && d.data.length > 0) setDetails(d.data.map((r) => ({ label: r.label, value: r.value })));
    })();
  }, []);

  return (
    <main>
      {/* Hero */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* Phones: original framing. Laptops (md+): framed on the face. */}
        <img
          src={heroImage}
          alt="Mahmoud Haidar - Professional Model"
          className="absolute inset-0 w-full h-full pt-10 object-cover object-[32%_55%] md:object-[50%_18%]"
        />
        {/* White wash over the photo: 40% on phones, lighter on laptops. */}
        <div className="absolute inset-0 bg-background/40 md:bg-background/[0.12]" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4 pt-40">
          <h1 className="text-hero text-foreground animate-fade-up">
            Mahmoud
            <br />
            Haidar
          </h1>
          <p className="text-nav text-foreground/60 mt-6 animate-fade-up-delay-1">Professional Model</p>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 scroll-indicator">
          <ChevronDown className="w-5 h-5 text-foreground/50" />
        </div>
      </section>

      {/* About */}
      <section className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-2xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="text-section-title text-foreground mb-8">About</h2>
            <div className="w-[60px] h-px bg-foreground/20 mx-auto mb-10" />
            <p className="text-foreground/70 leading-relaxed text-sm md:text-base">
              Mahmoud Haidar is a professional model based in Lebanon, known for his striking presence and
              versatility. With experience in editorial, commercial, and runway work, he brings a refined intensity
              to every project. His portfolio spans collaborations with leading fashion houses and photographers
              across the region.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Details */}
      <section className="py-16 md:py-32 px-6 md:px-12 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h2 className="text-section-title text-foreground text-center mb-16">Details</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {details.map((d) => (
              <ScrollReveal key={d.label}>
                <div className="flex justify-between items-baseline border-b border-border pb-4">
                  <span className="text-detail-label">{d.label}</span>
                  <span className="text-detail-value text-foreground">{d.value}</span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-10 md:py-32 px-3 md:px-12 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <ScrollReveal>
            <div className="flex flex-col items-center gap-8">
              <a
                href="mailto:mahmoudhaidarr00@gmail.com"
                className="flex items-center gap-3 text-foreground/70 hover:text-foreground transition-colors duration-300 group"
              >
                <Mail className="w-4 h-4" />
                <h5 className="text-nav font-bold">mahmoudhaidarr00@gmail.com</h5>
              </a>
              <a
                href="https://instagram.com/mahmoudhaidar_"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-foreground/70 hover:text-foreground transition-colors duration-300 group"
              >
                <Instagram className="w-4 h-4" />
                <span className="text-nav font-bold">@mahmoudhaidar_</span>
              </a>
              <a
                href="https://wa.me/96179132606"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-foreground/70 hover:text-foreground transition-colors duration-300 group"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-nav font-bold">+961 79 132 606</span>
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Portfolio */}
      <section className="py-10 md:py-32 px-6 md:px-12 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h2 className="text-section-title text-foreground text-center mb-16">Portfolio</h2>
          </ScrollReveal>
          <div className="grid grid-cols-2 gap-4 md:gap-12">
            {gallery.map((src, i) => (
              <ScrollReveal key={i}>
                <button
                  type="button"
                  onClick={() => setPreview(src)}
                  className="w-full aspect-[4/5] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded overflow-hidden"
                >
                  <img
                    src={src}
                    alt={`Mahmoud Haidar portfolio photo ${i + 1}`}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                </button>
              </ScrollReveal>
            ))}
          </div>

          {preview && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
              onClick={() => setPreview(null)}
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
            >
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Close preview"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={preview}
                alt="Portfolio preview"
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </section>

      <Brands />

      <footer className="py-8 px-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground tracking-[0.15em] uppercase">
          © 2026 Mahmoud Haidar. All rights reserved.
        </p>
      </footer>
    </main>
  );
};

export default Index;
