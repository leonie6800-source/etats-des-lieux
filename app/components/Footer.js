export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t mt-auto py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-500">
          <a href="/legal/cgv" className="hover:text-[#2d6ac4] transition">CGV</a>
          <span className="text-gray-300">•</span>
          <a href="/legal/mentions-legales" className="hover:text-[#2d6ac4] transition">Mentions légales</a>
          <span className="text-gray-300">•</span>
          <a href="/legal/politique-confidentialite" className="hover:text-[#2d6ac4] transition">Confidentialité</a>
          <span className="text-gray-300">•</span>
          <a href="/legal/contact" className="hover:text-[#2d6ac4] transition">Contact</a>
          <span className="text-gray-300">•</span>
          <a href="/legal/a-propos" className="hover:text-[#2d6ac4] transition">À propos</a>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-3">
          © {new Date().getFullYear()} État des Lieux Pro — Conforme aux exigences de la loi ALUR 2014
        </p>
      </div>
    </footer>
  );
}
