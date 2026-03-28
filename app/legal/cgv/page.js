export default function CGV() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-[#1e3a5f] mb-6">Conditions Générales de Vente (CGV)</h1>
        
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">1. Objet</h2>
          <p className="text-gray-700 leading-relaxed">
            Les présentes conditions générales de vente (CGV) régissent la vente de services numériques proposés par État des Lieux Pro, notamment la création, la gestion et la génération de rapports d'états des lieux immobiliers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">2. Services proposés</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            État des Lieux Pro propose trois formules :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li><strong>À l'acte (9,90€)</strong> : Un rapport d'état des lieux</li>
            <li><strong>Pack Pro (49€/mois)</strong> : 10 dossiers par mois, puis 5€ par dossier supplémentaire</li>
            <li><strong>Business (149€/mois)</strong> : Dossiers illimités + support prioritaire</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            Options supplémentaires disponibles : Comparaison IA (+2€), Archive sécurisée 10 ans (+10€ ou +1€/mois).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">3. Prix et paiement</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Les prix sont indiqués en euros TTC. Le paiement s'effectue exclusivement en ligne via Stripe (cartes bancaires acceptées).
          </p>
          <p className="text-gray-700 leading-relaxed">
            Pour les abonnements mensuels, le prélèvement est automatique et récurrent jusqu'à résiliation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">4. Droit de rétractation</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Conformément à l'article L221-28 du Code de la consommation, vous disposez d'un délai de 14 jours pour exercer votre droit de rétractation sans avoir à justifier de motifs ni à payer de pénalités.
          </p>
          <p className="text-gray-700 leading-relaxed">
            <strong>Exception :</strong> Le droit de rétractation ne peut être exercé pour les services pleinement exécutés avant la fin du délai de rétractation (ex: rapport PDF déjà généré et téléchargé).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">5. Résiliation des abonnements</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Les abonnements Pack Pro et Business peuvent être résiliés à tout moment depuis le portail client accessible via le bouton "Gérer mon abonnement".
          </p>
          <p className="text-gray-700 leading-relaxed">
            La résiliation prend effet à la fin de la période de facturation en cours. Aucun remboursement prorata temporis n'est effectué.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">6. Livraison du service</h2>
          <p className="text-gray-700 leading-relaxed">
            Le rapport PDF est généré instantanément après validation du paiement et envoyé par email à l'adresse indiquée. Le client peut également le télécharger directement depuis son espace client.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">7. Garanties</h2>
          <p className="text-gray-700 leading-relaxed">
            État des Lieux Pro s'engage à fournir un service de qualité conforme aux standards du secteur. En cas de dysfonctionnement technique, le client peut contacter le support pour résolution.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">8. Responsabilité</h2>
          <p className="text-gray-700 leading-relaxed">
            État des Lieux Pro ne saurait être tenu responsable de l'utilisation faite par le client des rapports générés. Le client reste seul responsable du contenu et de l'exactitude des informations saisies.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">9. Protection des données</h2>
          <p className="text-gray-700 leading-relaxed">
            Les données personnelles collectées sont traitées conformément au RGPD. Pour plus d'informations, consultez notre <a href="/legal/politique-confidentialite" className="text-blue-600 hover:underline">politique de confidentialité</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">10. Litige et médiation</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            En cas de litige, le client peut recourir à une médiation conventionnelle ou tout mode alternatif de règlement des différends.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Plateforme de résolution en ligne des litiges : <a href="https://ec.europa.eu/consumers/odr" className="text-blue-600 hover:underline" target="_blank">https://ec.europa.eu/consumers/odr</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">11. Droit applicable</h2>
          <p className="text-gray-700 leading-relaxed">
            Les présentes CGV sont régies par le droit français. Tout litige relève de la compétence exclusive des tribunaux français.
          </p>
        </section>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <a href="/" className="text-[#2d6ac4] hover:underline font-medium">← Retour à l'accueil</a>
        </div>
      </div>
    </div>
  );
}
