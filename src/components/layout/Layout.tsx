import Header from "./Header";
import Footer from "./Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import PromoPopup from "@/components/PromoPopup";
import CookieConsent from "@/components/CookieConsent";

const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex flex-col overflow-x-hidden">
    <Header />
    {/* pt-[88px] compensa a altura do header fixo (announcement + main header). */}
    <main className="flex-1 pt-[88px] pb-16 md:pb-0 overflow-x-hidden">{children}</main>
    <Footer />
    <MobileBottomNav />
    <WhatsAppFloat />
    <PromoPopup />
    <CookieConsent />
  </div>
);

export default Layout;
