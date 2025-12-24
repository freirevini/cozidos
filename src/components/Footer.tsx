import { Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background py-8 mt-auto">
      <div className="container mx-auto px-4">
        {/* Social Media Section */}
        <div className="flex flex-col items-center justify-center space-y-4 mb-6">
          <p className="text-foreground text-sm font-medium">Sigam-nos em:</p>
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/cozidos.futebolclube/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center hover:opacity-80 transition-opacity"
              aria-label="Instagram"
            >
              <Instagram className="w-6 h-6 text-white" />
            </a>
            <a
              href="https://www.tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 rounded-full bg-black flex items-center justify-center hover:opacity-80 transition-opacity border-2 border-primary"
              aria-label="TikTok"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
                  fill="currentColor"
                  className="text-primary"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* Copyright Section */}
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            Cozidos FC - Desde 2020 - Muita resenha e pouco futebol
          </p>
        </div>
      </div>
    </footer>
  );
}
