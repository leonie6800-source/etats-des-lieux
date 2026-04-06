export default function APropos() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-[#1e3a5f] mb-6">À propos</h1>

        <p className="text-gray-700 leading-relaxed mb-6">
          <strong>État des Lieux Pro</strong> est un service de génération d'états des lieux locatifs 100% conforme aux exigences de la loi ALUR 2014.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">Notre mission</h2>
          <p className="text-gray-700 leading-relaxed">
            Simplifier la vie des locataires, propriétaires et agents immobiliers en permettant de créer un état des lieux professionnel en quelques minutes, depuis n'importe quel appareil.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">Pourquoi nous faire confiance ?</h2>
          <ul className="space-y-2 text-gray-700">
            <li>✅ Conforme aux exigences de la loi ALUR 2014</li>
            <li>✅ PDF professionnel généré instantanément</li>
            <li>✅ Photos horodatées intégrées</li>
            <li>✅ Sécurisé et confidentiel</li>
            <li>✅ Accessible sur mobile, tablette et ordinateur</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">Qui sommes-nous ?</h2>
          <p className="text-gray-700 leading-relaxed">
            État des Lieux Pro est édité par un micro-entrepreneur basé à Fellerings, Alsace.
          </p>
          <p className="text-gray-700 mt-2">
            SIRET : À compléter
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">Contact</h2>
          <p className="text-gray-700">
            <a href="mailto:contact@edlpro.app" className="text-[#2d6ac4] hover:underline">contact@edlpro.app</a>
          </p>
        </section>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <a href="/" className="text-[#2d6ac4] hover:underline font-medium text-sm">← Retour à l'accueil</a>
        </div>
      </div>
    </div>
  );
}
