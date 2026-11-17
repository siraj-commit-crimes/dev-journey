import { useState, type FormEvent } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/lib/settings";

// Optional: a Web3Forms access key sends the email straight to Mahmoud's inbox
// without leaving the site. Without one, "Send by email" opens the visitor's
// email app with the message already written.
const WEB3FORMS_KEY = (import.meta.env.VITE_WEB3FORMS_KEY as string | undefined) ?? "";

const shootTypes = ["Editorial", "Commercial", "Runway", "Campaign", "Other"];

type Props = { email: string; whatsapp: string };

const field =
  "w-full bg-white border border-border px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-foreground/20";
const label = "text-detail-label";

const BookingForm = ({ email, whatsapp }: Props) => {
  const [form, setForm] = useState({ name: "", company: "", date: "", type: "", message: "" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const text = () => {
    const lines = ["Hi Mahmoud, I'd like to book you.", "", `Name: ${form.name.trim()}`];
    if (form.company.trim()) lines.push(`Brand / company: ${form.company.trim()}`);
    if (form.date) {
      const d = new Date(`${form.date}T12:00:00`);
      const nice = isNaN(d.getTime()) ? form.date : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      lines.push(`Date: ${nice}`);
    }
    if (form.type) lines.push(`Type of shoot: ${form.type}`);
    lines.push("", form.message.trim());
    return lines.join("\n");
  };

  const valid = () => {
    if (!form.name.trim() || !form.message.trim()) {
      setError("Please add your name and a message.");
      return false;
    }
    setError("");
    return true;
  };

  const sendWhatsApp = () => {
    if (!valid()) return;
    window.open(`${whatsappUrl(whatsapp)}?text=${encodeURIComponent(text())}`, "_blank", "noopener");
  };

  const sendEmail = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid()) return;
    const subject = `Booking request from ${form.name.trim()}${form.company.trim() ? ` (${form.company.trim()})` : ""}`;
    if (!WEB3FORMS_KEY) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text())}`;
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject, from_name: form.name.trim(), message: text() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error();
      setStatus("sent");
      setForm({ name: "", company: "", date: "", type: "", message: "" });
    } catch {
      setStatus("idle");
      setError("The message didn't send. Try again, or use WhatsApp.");
    }
  };

  if (status === "sent")
    return (
      <div className="bg-white p-6 md:p-8 flex flex-col gap-2">
        <p className="font-display text-2xl text-foreground">Thank you</p>
        <p className="text-foreground/70 text-sm">Your message was sent to Mahmoud. He'll get back to you soon.</p>
        <button type="button" onClick={() => setStatus("idle")} className="self-start text-nav underline underline-offset-4 mt-2">
          Send another
        </button>
      </div>
    );

  return (
    <form onSubmit={sendEmail} className="grid md:grid-cols-2 gap-x-4 gap-y-5" noValidate>
      <label className="flex flex-col gap-2">
        <span className={label}>Your name *</span>
        <input id="bk-name" className={field} value={form.name} onChange={set("name")} autoComplete="name" required />
      </label>
      <label className="flex flex-col gap-2">
        <span className={label}>Brand / company</span>
        <input id="bk-company" className={field} value={form.company} onChange={set("company")} autoComplete="organization" />
      </label>
      <label className="flex flex-col gap-2">
        <span className={label}>Date</span>
        <input id="bk-date" type="date" className={field} value={form.date} onChange={set("date")} />
      </label>
      <label className="flex flex-col gap-2">
        <span className={label}>Type of shoot</span>
        <select id="bk-type" className={field} value={form.type} onChange={set("type")}>
          <option value="">Choose…</option>
          {shootTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 md:col-span-2">
        <span className={label}>Message *</span>
        <textarea id="bk-message" rows={5} className={field} value={form.message} onChange={set("message")} required />
      </label>
      {error && <p className="md:col-span-2 text-sm text-destructive -mt-1">{error}</p>}
      <div className="md:col-span-2 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={sendWhatsApp}
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 text-nav font-normal bg-foreground text-background border border-foreground px-6 py-3.5"
        >
          <MessageCircle className="w-4 h-4" /> Send on WhatsApp
        </button>
        <button
          type="submit"
          disabled={status === "sending"}
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 text-nav font-normal border border-foreground text-foreground px-6 py-3.5 disabled:opacity-60"
        >
          <Mail className="w-4 h-4" /> {status === "sending" ? "Sending..." : "Send by email"}
        </button>
      </div>
    </form>
  );
};

export default BookingForm;
