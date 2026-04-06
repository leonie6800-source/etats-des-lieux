export default function PolitiqueConfidentialite() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-[#1e3a5f] mb-6">Politique de Confidentialité (RGPD)</h1>
        
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">1. Responsable du traitement</h2>
          <p className="text-gray-700 leading-relaxed">
            <strong>Raison sociale :</strong> Bouillet Aurélie<br/>
            <strong>Adresse :</strong> 10 rue de l'église, 68470 Fellering<br/>
            <strong>Email :</strong> <a href="mailto:contact@edlpro.app" className="text-[#2d6ac4] hover:underline">contact@edlpro.app</a><br/>
            <strong>Téléphone :</strong> [Votre numéro de téléphone]
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">2. Données collectées</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Dans le cadre de l'utilisation de notre service, nous collectons les données personnelles suivantes :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li><strong>Données d'identification :</strong> Nom, prénom, email</li>
            <li><strong>Données relatives aux états des lieux :</strong> Adresses des biens, photos, observations</li>
            <li><strong>Données de paiement :</strong> Informations bancaires (traitées par Stripe)</li>
            <li><strong>Données techniques :</strong> Adresse IP, cookies, logs de connexion</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">3. Finalités du traitement</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Vos données personnelles sont collectées pour les finalités suivantes :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Création et gestion des états des lieux</li>
            <li>Génération et envoi des rapports PDF</li>
            <li>Traitement des paiements</li>
            <li>Envoi d'emails transactionnels (confirmation, rapport)</li>
            <li>Support client</li>
            <li>Respect des obligations légales et comptables</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">4. Base légale</h2>
          <p className="text-gray-700 leading-relaxed">
            Le traitement de vos données repose sur les bases légales suivantes :<br/>
            - <strong>Exécution du contrat</strong> : nécessaire pour fournir le service<br/>
            - <strong>Consentement</strong> : pour les cookies non essentiels<br/>
            - <strong>Obligation légale</strong> : conservation des factures (10 ans)<br/>
            - <strong>Intérêt légitime</strong> : amélioration du service, sécurité
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">5. Destinataires des données</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Vos données peuvent être transmises aux tiers suivants :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li><strong>Stripe</strong> : Traitement sécurisé des paiements</li>
            <li><strong>Cloudinary</strong> : Stockage sécurisé des photos</li>
            <li><strong>EmailJS</strong> : Envoi des emails transactionnels</li>
            <li><strong>OpenAI</strong> : Analyse IA des photos (si option activée)</li>
            <li><strong>Vercel</strong> : Hébergement du service (vercel.com)</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            Ces prestataires sont tenus de respecter la confidentialité et la sécurité de vos données.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">6. Durée de conservation</h2>
          <p className="text-gray-700 leading-relaxed">
            Vos données sont conservées pendant les durées suivantes :<br/>
            - <strong>Données de compte</strong> : Pendant la durée du contrat + 3 ans<br/>
            - <strong>Factures</strong> : 10 ans (obligation légale comptable)<br/>
            - <strong>Photos et rapports</strong> : Durée du contrat (10 ans si option Archive activée)<br/>
            - <strong>Cookies</strong> : 13 mois maximum
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">7. Vos droits</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Conformément au RGPD, vous disposez des droits suivants :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li><strong>Droit d'accès</strong> : Obtenir une copie de vos données</li>
            <li><strong>Droit de rectification</strong> : Corriger vos données inexactes</li>
            <li><strong>Droit à l'effacement</strong> : Supprimer vos données (sous conditions)</li>
            <li><strong>Droit d'opposition</strong> : Vous opposer au traitement</li>
            <li><strong>Droit à la portabilité</strong> : Recevoir vos données dans un format structuré</li>
            <li><strong>Droit de limitation</strong> : Limiter le traitement de vos données</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            Pour exercer vos droits, contactez-nous à : <a href="mailto:contact@edlpro.app" className="text-[#2d6ac4] hover:underline">contact@edlpro.app</a> ou via notre <a href="/legal/contact" className="text-[#2d6ac4] hover:underline">formulaire de contact</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">8. Sécurité des données</h2>
          <p className="text-gray-700 leading-relaxed">
            Nous mettons en œuvre toutes les mesures techniques et organisationnelles appropriées pour protéger vos données contre la destruction, la perte, l'altération, la divulgation ou l'accès non autorisé :<br/>
            - Connexion HTTPS sécurisée (SSL/TLS)<br/>
            - Stockage chiffré des données sensibles<br/>
            - Accès restreint aux données (authentification)<br/>
            - Sauvegardes régulières
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">9. Cookies</h2>
          <p className="text-gray-700 leading-relaxed">
            Notre site utilise des cookies techniques nécessaires à son fonctionnement. Ces cookies ne nécessitent pas votre consentement. Aucun cookie publicitaire ou de tracking n'est utilisé.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">10. Transferts internationaux</h2>
          <p className="text-gray-700 leading-relaxed">
            Certains de nos prestataires (Stripe, Cloudinary, OpenAI) peuvent transférer des données hors de l'Union Européenne. Ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types approuvées par la Commission Européenne).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">11. Réclamation</h2>
          <p className="text-gray-700 leading-relaxed">
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL :<br/>
            <strong>Commission Nationale de l'Informatique et des Libertés (CNIL)</strong><br/>
            3 Place de Fontenoy - TSA 80715 - 75334 PARIS CEDEX 07<br/>
            Tél : 01 53 73 22 22<br/>
            Site web : <a href="https://www.cnil.fr" className="text-blue-600 hover:underline" target="_blank">www.cnil.fr</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#2d6ac4] mb-3">12. Modifications</h2>
          <p className="text-gray-700 leading-relaxed">
            Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. La version en vigueur est toujours accessible sur cette page avec sa date de mise à jour.
          </p>
        </section>

        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap gap-4">
          <a href="/" className="text-[#2d6ac4] hover:underline font-medium text-sm">← Retour à l'accueil</a>
          <a href="/legal/contact" className="text-[#2d6ac4] hover:underline font-medium text-sm">Nous contacter</a>
          <a href="/legal/a-propos" className="text-[#2d6ac4] hover:underline font-medium text-sm">À propos</a>
        </div>
      </div>
    </div>
  );
}
