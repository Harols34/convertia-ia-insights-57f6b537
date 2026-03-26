import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { AnimatedDashboard } from "@/components/landing/AnimatedDashboard";
import { CTASection } from "@/components/landing/CTASection";
import { ContactSection } from "@/components/landing/ContactSection";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(
          180deg,
          hsl(220 25% 7%) 0%,
          hsl(220 25% 7%) 8%,
          hsl(220 22% 12%) 18%,
          hsl(215 20% 22%) 30%,
          hsl(210 18% 38%) 42%,
          hsl(210 15% 55%) 54%,
          hsl(210 12% 72%) 66%,
          hsl(210 10% 86%) 78%,
          hsl(210 15% 96%) 90%,
          hsl(0 0% 100%) 100%
        )`,
      }}
    >
      <LandingNav />
      <HeroSection />
      <AnimatedDashboard />
      <ServicesSection />
      <BenefitsSection />
      <CTASection />
      <ContactSection />
      <Footer />
    </div>
  );
};

export default Index;
