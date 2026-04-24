import Footer from '../../components/Footer';

export const metadata = {
  title: 'Loi ALUR 2014 — État des Lieux Pro',
  description: 'Tout savoir sur la loi ALUR 2014 et les obligations légales pour un état des lieux conforme.',
};

export default function AlurPage() {
  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col">
      <div className="bg-[#1e3a5f] text-white py-10 px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">⚖️ Loi ALUR 2014</h1>
        <p className="text-white/80 text-sm max-w-lg mx-auto">Tout ce que vous devez savoir sur vos obligations légales pour un état des lieux conforme</p>
      </div>

      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex-1 space-y-6">

        {/* C'est quoi */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-[#1e3a5f] text-lg mb-3">📋 Qu'est-ce que la loi ALUR ?</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            La loi ALUR (Accès au Logement et Urbanisme Rénové) du <strong>24 mars 2014</strong> encadre strictement la réalisation des états des lieux locatifs. Elle impose des mentions obligatoires pour protéger à la fois le locataire et le propriétaire.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mt-3">
            Tout état des lieux qui ne respecte pas ces obligations peut être <strong>contesté devant un tribunal</strong>, ce qui peut entraîner des litiges coûteux.
          </p>
        </div>

        {/* Mentions obligatoires */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-[#1e3a5f] text-lg mb-4">✅ Mentions obligatoires dans le PDF</h2>
          <div className="space-y-3">
            {[
              { icon: '📅', title: 'Date ET heure', desc: 'La date et les heures de début et fin de la visite sont obligatoires. Un état des lieux sans heure peut être invalidé.' },
              { icon: '👤', title: 'Identité des parties', desc: 'Nom et prénom complets du locataire et du propriétaire (ou de son représentant/agence).' },
              { icon: '📍', title: 'Adresse complète', desc: 'Adresse du logement avec code postal et ville.' },
              { icon: '🚪', title: 'Description pièce par pièce', desc: 'Chaque pièce doit être listée et décrite individuellement.' },
              { icon: '🧱', title: 'État de chaque élément', desc: 'Pour chaque pièce : état des murs, sol, plafond et équipements (Très bon, Bon, Correct, Usé, Dégradé).' },
              { icon: '⚡', title: 'Relevés de compteurs', desc: 'Électricité (kWh), gaz (m³) et eau froide (m³) au moment de l\'état des lieux.' },
              { icon: '🔑', title: 'Clés et accès remis', desc: 'Nombre de clés du logement, boîte aux lettres, télécommandes, badges d\'accès.' },
              { icon: '✍️', title: 'Signatures des deux parties', desc: 'Le locataire et le propriétaire doivent signer. Sans signature, l\'état des lieux n\'a pas de valeur juridique.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-green-50 rounded-xl">
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
                </div>
                <span className="text-green-500 font-bold ml-auto flex-shrink-0">✓</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attention */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h2 className="font-bold text-amber-800 text-lg mb-3">⚠️ Points d'attention importants</h2>
          <div className="space-y-3">
            {[
              { title: '"Certifié ALUR" n\'existe pas', desc: 'Il n\'existe aucune certification officielle "ALUR". Les mentions légales correctes sont : "Conforme aux exigences de la loi ALUR 2014".' },
              { title: 'Présence obligatoire des deux parties', desc: 'L\'état des lieux doit se faire en présence du locataire ET du propriétaire (ou représentant). Un EDL fait en l\'absence d\'une partie est invalide.' },
              { title: 'État des lieux d\'entrée ET de sortie', desc: 'La loi impose un état des lieux à l\'entrée dans le logement ET à la sortie. La comparaison des deux permet de déterminer les éventuelles dégradations.' },
              { title: 'Conserver le document', desc: 'L\'état des lieux doit être conservé pendant toute la durée du bail et au minimum 3 ans après la fin du bail.' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-3">
                <p className="text-sm font-semibold text-amber-800">{item.title}</p>
                <p className="text-xs text-gray-600 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Comment notre app est conforme */}
        <div className="bg-[#1e3a5f] rounded-2xl p-6 text-white">
          <h2 className="font-bold text-lg mb-4">🏠 Comment État des Lieux Pro est conforme</h2>
          <div className="space-y-2">
            {[
              'Champs heure début/fin obligatoires dans le formulaire',
              'Identités locataire et propriétaire saisies à la création',
              'Inspection guidée pièce par pièce avec photos',
              'Étape dédiée compteurs et clés (étape 6)',
              'Signature électronique avec horodatage',
              'PDF généré avec toutes les mentions ALUR obligatoires',
              'Footer PDF : "Conforme aux exigences de la loi ALUR 2014"',
              'Analyse IA des photos pour description détaillée',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-green-400 font-bold">✓</span>
                <span className="text-white/90">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Références légales */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-[#1e3a5f] text-lg mb-3">📖 Textes de référence</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>• <strong>Loi n°2014-366 du 24 mars 2014</strong> pour l'accès au logement et un urbanisme rénové (ALUR)</p>
            <p>• <strong>Décret n°2016-382 du 30 mars 2016</strong> fixant les modalités d'établissement de l'état des lieux</p>
            <p>• <strong>Article 3-2 de la loi n°89-462 du 6 juillet 1989</strong> tendant à améliorer les rapports locatifs</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pb-4">
          <a href="/" className="inline-block bg-[#1e3a5f] text-white font-bold py-4 px-8 rounded-2xl text-sm hover:bg-[#2d6ac4] transition">
            🏠 Créer un état des lieux conforme ALUR
          </a>
          <p className="text-xs text-gray-400 mt-3">
            <a href="/guide" className="hover:text-[#2d6ac4]">Voir le guide d'utilisation complet →</a>
          </p>
        </div>

      </div>
      <Footer />
    </div>
  );
}
