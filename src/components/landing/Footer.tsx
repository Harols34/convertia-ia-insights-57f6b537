import logoImg from "@/assets/logo.ico";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 py-12">
      <div className="container">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="Converti-IA" className="h-8 w-8" />
              <span className="font-display font-bold text-gray-900 text-lg">Converti-IA</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Plataforma de analítica avanzada e inteligencia artificial para empresas que buscan crecer con datos.
            </p>
          </div>
          <div>
            <h4 className="font-display font-semibold text-gray-900 mb-4">Plataforma</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#servicios" className="hover:text-primary transition-colors">Servicios</a></li>
              <li><a href="#contacto" className="hover:text-primary transition-colors">Contacto</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Documentación</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-gray-900 mb-4">Soluciones</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>Dashboards con IA</li>
              <li>Speech Analytics</li>
              <li>AI Agents</li>
              <li>Automatización</li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-gray-900 mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-primary transition-colors">Términos de servicio</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Política de privacidad</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} Converti-IA Analytics. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
