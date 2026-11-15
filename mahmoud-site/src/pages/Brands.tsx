import { useEffect, useState } from "react";
import ScrollReveal from "@/components/ScrollReveal";
import { supabase } from "@/lib/supabase";
import { defaultBrands, type Brand } from "@/lib/content";

const Brands = () => {
  const [brands, setBrands] = useState<Brand[]>(defaultBrands);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("brands").select("*").order("sort_order");
      if (data && data.length > 0)
        setBrands(data.map((b) => ({ name: b.name, logo: b.logo_url, activityImage: b.activity_image_url })));
    })();
  }, []);

  return (
    <main className="min-h-screen pt-24 md:pt-32 pb-10 px-6 md:px-12">
      <div className="max-w-4xl mx-auto text-center">
        <ScrollReveal>
          <h1 className="text-section-title text-foreground mb-4">Brands</h1>
          <div className="w-[60px] h-px bg-foreground/20 mx-auto mb-20" />
        </ScrollReveal>
        <div className="flex flex-col gap-20 md:gap-24">
          {brands.map((b, i) => (
            <ScrollReveal key={i}>
              <section className="flex flex-col items-center gap-8 md:gap-12">
                <img src={b.logo} alt={`${b.name} logo`} className="max-h-20 w-auto object-contain" />
                <img
                  src={b.activityImage}
                  alt={`${b.name} - activity`}
                  className="w-full max-w-3xl aspect-[4/5] object-cover rounded-sm"
                />
              </section>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal>
          <p className="text-muted-foreground text-sm mt-20 tracking-wide">Collaborations and brand work.</p>
        </ScrollReveal>
      </div>
    </main>
  );
};

export default Brands;
