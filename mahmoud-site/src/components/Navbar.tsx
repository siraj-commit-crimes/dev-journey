import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const links = [
  { id: "portfolio", label: "Portfolio" },
  { id: "brands", label: "Brands" },
  { id: "video", label: "Video" },
  { id: "contact", label: "Contact" },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // On the home page scroll to the section; elsewhere go home first.
  const go = (id: string) => {
    setOpen(false);
    if (location.pathname === "/") document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else navigate("/", { state: { scrollTo: id } });
  };

  const home = (e: React.MouseEvent) => {
    setOpen(false);
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between gap-4 px-6 md:px-12 py-5">
        <Link to="/" onClick={home} className="font-display text-lg md:text-xl tracking-[0.15em] uppercase text-foreground whitespace-nowrap">
          Mahmoud Haidar
        </Link>

        <div className="hidden md:flex items-center gap-10">
          {links.map((l) => (
            <button key={l.id} type="button" onClick={() => go(l.id)} className="text-nav text-foreground/70 hover:text-foreground transition-colors duration-300">
              {l.label}
            </button>
          ))}
          <button type="button" onClick={() => go("contact")} className="text-nav font-normal bg-foreground text-background px-4 py-2.5">
            Book
          </button>
        </div>

        <button className="md:hidden flex flex-col gap-1.5" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <span className={`block w-6 h-px bg-foreground transition-transform duration-300 ${open ? "rotate-45 translate-y-[3.5px]" : ""}`} />
          <span className={`block w-6 h-px bg-foreground transition-opacity duration-300 ${open ? "opacity-0" : ""}`} />
          <span className={`block w-6 h-px bg-foreground transition-transform duration-300 ${open ? "-rotate-45 -translate-y-[3.5px]" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-background/95 backdrop-blur-md px-6 pb-8 pt-4 flex flex-col gap-6">
          {links.map((l) => (
            <button key={l.id} type="button" onClick={() => go(l.id)} className="text-left text-nav text-foreground/70 hover:text-foreground transition-colors">
              {l.label}
            </button>
          ))}
          <button type="button" onClick={() => go("contact")} className="text-left text-nav font-normal text-foreground">
            Book Mahmoud
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
