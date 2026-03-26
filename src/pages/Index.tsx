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
          hsl(155 30% 6%) 0%,
          hsl(155 28% 8%) 8%,
          hsl(160 22% 12%) 18%,
          hsl(158 20% 20%) 30%,
          hsl(155 18% 32%) 42%,
          hsl(152 15% 48%) 54%,
          hsl(150 12% 65%) 66%,
          hsl(148 10% 80%) 78%,
          hsl(145 12% 92%) 90%,
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
