import { useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/", label: "Home" },
  { to: "/video", label: "Video" },
];

const Navbar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const scrollHome = (e: MouseEvent) => {
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 md:px-12 py-5">
        <Link
          to="/"
          onClick={scrollHome}
          className="font-display text-lg md:text-xl tracking-[0.15em] uppercase text-foreground"
        >
          Mahmoud Haidar
        </Link>

        <div className="hidden md:flex items-center gap-10">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              onClick={l.to === "/" ? scrollHome : undefined}
              className={`text-nav text-foreground/70 hover:text-foreground transition-colors duration-300 ${location.pathname === l.to ? "text-foreground" : ""}`}
            >
              {l.label}
            </Link>
          ))}
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
            <Link
              key={l.label}
              to={l.to}
              onClick={(e) => {
                if (l.to === "/") scrollHome(e);
                setOpen(false);
              }}
              className="text-nav text-foreground/70 hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
