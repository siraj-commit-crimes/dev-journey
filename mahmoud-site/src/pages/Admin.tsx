import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type GalleryRow = { id: string; image_url: string; sort_order: number; alt_text?: string | null };
type BrandRow = { id: string; name: string; logo_url: string; activity_image_url: string; sort_order: number };
type DetailRow = { id: string; label: string; value: string; sort_order: number };
type Tab = "gallery" | "brands" | "details";

const showError = (description: string) => toast.error("Error", { description });

const Admin = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("gallery");
  const [gallery, setGallery] = useState<GalleryRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    (async () => {
      const [g, b, d] = await Promise.all([
        supabase.from("gallery_images").select("*").order("sort_order"),
        supabase.from("brands").select("*").order("sort_order"),
        supabase.from("details").select("*").order("sort_order"),
      ]);
      if (g.data) setGallery(g.data);
      if (b.data) setBrands(b.data);
      if (d.data) setDetails(d.data);
    })();
  }, []);

  // Uploads a file to the "portfolio" storage bucket and returns its public URL.
  const upload = async (file: File, folder: string) => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("portfolio").upload(path, file);
    if (error) {
      toast.error("Upload failed", { description: error.message });
      return null;
    }
    return supabase.storage.from("portfolio").getPublicUrl(path).data.publicUrl;
  };

  // ---- Gallery ----
  const addGalleryImage = async (file: File) => {
    const url = await upload(file, "gallery");
    if (!url) return;
    const { data, error } = await supabase
      .from("gallery_images")
      .insert({ image_url: url, sort_order: gallery.length })
      .select()
      .single();
    if (data) setGallery([...gallery, data]);
    if (error) showError(error.message);
  };

  const setGalleryOrder = (index: number, order: number) => {
    const next = [...gallery];
    next[index] = { ...next[index], sort_order: order };
    setGallery(next);
  };

  const saveGalleryOrder = async (row: GalleryRow) => {
    setSaving(true);
    const { error } = await supabase.from("gallery_images").update({ sort_order: row.sort_order }).eq("id", row.id);
    if (error) showError(error.message);
    else {
      setGallery((g) => [...g].sort((a, b) => a.sort_order - b.sort_order));
      toast("Order saved");
    }
    setSaving(false);
  };

  const deleteGalleryImage = async (id: string) => {
    await supabase.from("gallery_images").delete().eq("id", id);
    setGallery(gallery.filter((g) => g.id !== id));
  };

  // ---- Brands ----
  const addBrand = () =>
    setBrands([
      ...brands,
      { id: `new-${Date.now()}`, name: "", logo_url: "", activity_image_url: "", sort_order: brands.length },
    ]);

  const updateBrand = (index: number, field: keyof BrandRow, value: string) => {
    const next = [...brands];
    next[index] = { ...next[index], [field]: value };
    setBrands(next);
  };

  const uploadBrandImage = async (index: number, file: File, field: "logo_url" | "activity_image_url") => {
    const url = await upload(file, "brands");
    if (url) updateBrand(index, field, url);
  };

  const saveBrand = async (brand: BrandRow) => {
    setSaving(true);
    if (brand.id.startsWith("new-")) {
      const { id: _id, ...row } = brand;
      const { data, error } = await supabase.from("brands").insert(row).select().single();
      if (data) setBrands(brands.map((b) => (b.id === brand.id ? data : b)));
      if (error) showError(error.message);
    } else {
      const { error } = await supabase
        .from("brands")
        .update({
          name: brand.name,
          logo_url: brand.logo_url,
          activity_image_url: brand.activity_image_url,
          sort_order: brand.sort_order,
        })
        .eq("id", brand.id);
      if (error) showError(error.message);
    }
    setSaving(false);
    toast("Saved");
  };

  const deleteBrand = async (id: string) => {
    if (!id.startsWith("new-")) await supabase.from("brands").delete().eq("id", id);
    setBrands(brands.filter((b) => b.id !== id));
  };

  // ---- Details ----
  const addDetail = () =>
    setDetails([...details, { id: `new-${Date.now()}`, label: "", value: "", sort_order: details.length }]);

  const updateDetail = (index: number, field: "label" | "value", value: string) => {
    const next = [...details];
    next[index] = { ...next[index], [field]: value };
    setDetails(next);
  };

  const saveDetail = async (detail: DetailRow) => {
    setSaving(true);
    if (detail.id.startsWith("new-")) {
      const { id: _id, ...row } = detail;
      const { data, error } = await supabase.from("details").insert(row).select().single();
      if (data) setDetails(details.map((d) => (d.id === detail.id ? data : d)));
      if (error) showError(error.message);
    } else {
      const { error } = await supabase
        .from("details")
        .update({ label: detail.label, value: detail.value, sort_order: detail.sort_order })
        .eq("id", detail.id);
      if (error) showError(error.message);
    }
    setSaving(false);
    toast("Saved");
  };

  const deleteDetail = async (id: string) => {
    if (!id.startsWith("new-")) await supabase.from("details").delete().eq("id", id);
    setDetails(details.filter((d) => d.id !== id));
  };

  if (loading)
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return null;

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 md:px-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-section-title text-foreground">Dashboard</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              signOut();
              navigate("/");
            }}
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>

        <div className="flex gap-4 mb-10 border-b border-border pb-4">
          {(["gallery", "brands", "details"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-nav pb-2 transition-colors ${tab === t ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "gallery" && (
          <div>
            <div className="mb-6">
              <label className="cursor-pointer inline-flex items-center gap-2 text-sm border border-border px-4 py-2 hover:bg-accent transition-colors">
                <Plus className="w-4 h-4" /> Add Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && addGalleryImage(e.target.files[0])}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gallery.map((g, i) => (
                <div key={g.id} className="relative group aspect-[4/5] flex flex-col">
                  <img src={g.image_url} alt={g.alt_text || ""} className="w-full h-full object-cover flex-1 min-h-0" />
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs text-muted-foreground shrink-0">Order:</label>
                    <Input
                      type="number"
                      min={0}
                      value={g.sort_order}
                      onChange={(e) => setGalleryOrder(i, parseInt(e.target.value, 10) || 0)}
                      className="h-8 w-16 text-xs"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => saveGalleryOrder(g)}
                      disabled={saving}
                    >
                      <Save className="w-3 h-3" />
                    </Button>
                  </div>
                  <button
                    onClick={() => deleteGalleryImage(g.id)}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "brands" && (
          <div>
            <Button variant="outline" size="sm" onClick={addBrand} className="mb-6">
              <Plus className="w-4 h-4 mr-2" /> Add Brand
            </Button>
            <div className="flex flex-col gap-6">
              {brands.map((b, i) => (
                <div key={b.id} className="border border-border p-4 flex flex-col gap-3">
                  <Input placeholder="Brand name" value={b.name} onChange={(e) => updateBrand(i, "name", e.target.value)} />
                  <div className="flex gap-4 items-center">
                    <label className="text-xs text-muted-foreground">Logo:</label>
                    {b.logo_url && <img src={b.logo_url} className="h-10 object-contain" />}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && uploadBrandImage(i, e.target.files[0], "logo_url")}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex gap-4 items-center">
                    <label className="text-xs text-muted-foreground">Activity Image:</label>
                    {b.activity_image_url && <img src={b.activity_image_url} className="h-16 object-contain" />}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files?.[0] && uploadBrandImage(i, e.target.files[0], "activity_image_url")
                      }
                      className="text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveBrand(b)} disabled={saving}>
                      <Save className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteBrand(b.id)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "details" && (
          <div>
            <Button variant="outline" size="sm" onClick={addDetail} className="mb-6">
              <Plus className="w-4 h-4 mr-2" /> Add Detail
            </Button>
            <div className="flex flex-col gap-4">
              {details.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3 border border-border p-3">
                  <Input
                    placeholder="Label (e.g. Height)"
                    value={d.label}
                    onChange={(e) => updateDetail(i, "label", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Value (e.g. 181 cm)"
                    value={d.value}
                    onChange={(e) => updateDetail(i, "value", e.target.value)}
                    className="flex-1"
                  />
                  <Button size="icon" variant="ghost" onClick={() => saveDetail(d)} disabled={saving}>
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteDetail(d.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Admin;
