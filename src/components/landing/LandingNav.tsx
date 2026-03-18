import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.ico";

const links = [
  { label: "Servicios", href: "#servicios" },
  { label: "Beneficios", href: "#beneficios" },
  { label: "Contacto", href: "#contacto" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm" : "bg-transparent"}`}>
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoImg} alt="Converti-IA" className="h-8 w-8" />
          <span className={`font-display font-bold text-lg tracking-tight ${scrolled ? "text-foreground" : "text-white"}`}>
            Converti-IA
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${scrolled ? "text-muted-foreground" : "text-white/70"}`}
            >
              {l.label}
            </a>
          ))}
          <Button variant="outline" size="sm" className={`${scrolled ? "" : "border-white/20 text-white hover:bg-white/10"}`} asChild>
            <Link to="/login">Iniciar Sesión</Link>
          </Button>
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open
            ? <X className={`h-6 w-6 ${scrolled ? "text-foreground" : "text-white"}`} />
            : <Menu className={`h-6 w-6 ${scrolled ? "text-foreground" : "text-white"}`} />
          }
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border p-4 space-y-3">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="block text-sm text-foreground py-2" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Button size="sm" className="w-full gradient-primary text-white" asChild>
            <Link to="/login">Iniciar Sesión</Link>
          </Button>
        </div>
      )}
    </nav>
  );
}
