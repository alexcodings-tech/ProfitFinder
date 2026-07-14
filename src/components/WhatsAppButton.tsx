import { MessageCircle } from "lucide-react";

export function WhatsAppButton() {
  const href = "https://wa.me/918681814442?text=Hi%2C%20I%20need%20help%20with%20Profit%20Finder";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:scale-110 transition-transform"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
