export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-[#1e3a5f] mb-6">Mentions Légales</h1>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">1. Éditeur du site</h2>
          <p className="text-gray-700 leading-relaxed">
            <strong>Raison sociale :</strong> [VOTRE ENTREPRISE]<br/>
            <strong>Forme juridique :</strong> [SARL/SAS/Auto-entrepreneur]<br/>
            <strong>Capital social :</strong> [MONTANT] euros<br/>
            <strong>Siège social :</strong> [ADRESSE COMPLÈTE]<br/>
            <strong>SIRET :</strong> [NUMÉRO SIRET]<br/>
            <strong>RCS :</strong> [VILLE]<br/>
            <strong>Email :</strong> contact@votre-domaine.fr<br/>
            <strong>Téléphone :</strong> [NUMÉRO]
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">2. Directeur de publication</h2>
          <p className="text-gray-700 leading-relaxed">
            <strong>Nom :</strong> [NOM DU DIRECTEUR]<br/>
            <strong>Email :</strong> contact@votre-domaine.fr
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">3. Hébergement</h2>
          <p className="text-gray-700 leading-relaxed">
            Le site est hébergé par :<br/>
            <strong>Emergent AI</strong><br/>
            [ADRESSE HÉBERGEUR]<br/>
            <strong>Site web :</strong> <a href="https://emergentmethods.ai" className="text-blue-600 hover:underline">https://emergentmethods.ai</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">4. Propriété intellectuelle</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            L'ensemble du contenu de ce site (textes, images, vidéos, logos, icônes, etc.) est protégé par le droit d'auteur et appartient à État des Lieux Pro ou à ses partenaires.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l'autorisation écrite préalable de l'éditeur.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">5. Responsabilité</h2>
          <p className="text-gray-700 leading-relaxed">
            L'éditeur s'efforce d'assurer au mieux de ses possibilités l'exactitude et la mise à jour des informations diffusées sur ce site. Toutefois, il ne peut garantir l'exactitude, la précision ou l'exhaustivité des informations mises à disposition sur ce site.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">6. Cookies</h2>
          <p className="text-gray-700 leading-relaxed">
            Ce site utilise des cookies techniques nécessaires à son fonctionnement. Pour plus d'informations, consultez notre <a href="/legal/politique-confidentialite" className="text-blue-600 hover:underline">politique de confidentialité</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">7. Droit applicable</h2>
          <p className="text-gray-700 leading-relaxed">
            Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français seront seuls compétents.
          </p>
        </section>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <a href="/" className="text-[#2d6ac4] hover:underline font-medium">← Retour à l'accueil</a>
        </div>
      </div>
    </div>
  );
}
