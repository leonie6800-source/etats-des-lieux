'use client';
import { useState } from 'react';
import Footer from '../components/Footer';

const steps = [
  {
    id: 1,
    icon: '👤',
    title: 'Créer votre compte',
    color: '#1e3a5f',
    duration: '1 minute',
    description: 'Inscrivez-vous gratuitement avec votre adresse email et un mot de passe.',
    details: [
      'Cliquez sur "Créer un compte" sur la page d\'accueil',
      'Saisissez votre email professionnel',
      'Choisissez un mot de passe sécurisé',
      'Votre compte est immédiatement actif — aucune vérification email requise',
    ],
    tip: 'Utilisez l\'email sur lequel vous voulez recevoir les notifications d\'état des lieux.',
    visual: [
      { label: 'Email', type: 'input', placeholder: 'votre@email.com' },
      { label: 'Mot de passe', type: 'input', placeholder: '••••••••' },
      { label: 'Créer mon compte', type: 'button' },
    ]
  },
  {
    id: 2,
    icon: '🏠',
    title: 'Créer un état des lieux',
    color: '#2d6ac4',
    duration: '2 minutes',
    description: 'Renseignez les informations du bien et des parties concernées.',
    details: [
      'Cliquez sur "Nouvel état des lieux" depuis le tableau de bord',
      'Saisissez l\'adresse complète du logement (rue, code postal, ville)',
      'Renseignez les heures de début et de fin (obligatoire loi ALUR)',
      'Indiquez le type de logement (Studio, T1, T2...)',
      'Précisez s\'il s\'agit d\'un état des lieux d\'Entrée ou de Sortie',
      'Ajoutez le nom du locataire et du propriétaire',
      'Saisissez l\'email du locataire pour recevoir le PDF automatiquement',
    ],
    tip: 'Les heures de début et fin sont OBLIGATOIRES selon la loi ALUR 2014.',
    visual: [
      { label: '📍 12 rue de la Paix, 75001 Paris', type: 'info' },
      { label: '🕐 09:00 → 11:30', type: 'info' },
      { label: '🏠 T3 • Entrée', type: 'info' },
      { label: '👤 Jean Dupont / Marie Martin', type: 'info' },
    ]
  },
  {
    id: 3,
    icon: '🚪',
    title: 'Inspecter chaque pièce',
    color: '#1e3a5f',
    duration: '5-15 minutes',
    description: 'Pour chaque pièce, documentez l\'état de tous les éléments avec photos et observations.',
    details: [
      'Étape 1 — Sélectionnez ou ajoutez une pièce (Salon, Cuisine, Chambre...)',
      'Étape 2 — Prenez des photos directement depuis votre mobile',
      'Étape 3 — L\'IA analyse automatiquement les photos et génère des observations',
      'Étape 4 — Complétez l\'état des murs, sol, plafond et équipements',
      'Étape 5 — Vérifiez le résumé de la pièce',
      'Répétez pour chaque pièce du logement',
    ],
    tip: 'Prenez minimum 2-3 photos par pièce sous différents angles pour une documentation complète.',
    visual: [
      { label: '📸 Photo prise', type: 'check' },
      { label: '🤖 IA : "Murs en bon état, légères traces..."', type: 'ia' },
      { label: '🧱 Murs : Peinture • Bon état', type: 'check' },
      { label: '🪵 Sol : Parquet • Correct', type: 'check' },
    ]
  },
  {
    id: 4,
    icon: '🔢',
    title: 'Compteurs & Clés',
    color: '#2d6ac4',
    duration: '2 minutes',
    description: 'Renseignez les relevés de compteurs et les clés remises — obligatoires ALUR.',
    details: [
      'À l\'étape 6 de l\'inspection, renseignez les compteurs',
      'Électricité (kWh), Gaz (m³), Eau froide (m³)',
      'Indiquez le nombre de clés remises : logement, boîte aux lettres, télécommandes, badges',
      'Ces informations apparaîtront dans le PDF final',
    ],
    tip: 'Photographiez les compteurs pour avoir une preuve visuelle en plus des chiffres.',
    visual: [
      { label: '⚡ Électricité : 12 450 kWh', type: 'check' },
      { label: '🔥 Gaz : 1 234 m³', type: 'check' },
      { label: '💧 Eau : 456 m³', type: 'check' },
      { label: '🔑 3 clés logement + 2 BAL', type: 'check' },
    ]
  },
  {
    id: 5,
    icon: '✍️',
    title: 'Signatures électroniques',
    color: '#1e3a5f',
    duration: '2 minutes',
    description: 'Faites signer locataire et propriétaire directement sur l\'écran.',
    details: [
      'Depuis le récapitulatif de l\'EDL, cliquez sur "Signer"',
      'Le locataire dessine sa signature sur l\'écran (ou sur votre tablette/mobile)',
      'Cliquez "Je confirme" pour valider et enregistrer',
      'Faites de même pour la signature du propriétaire',
      'Les deux signatures apparaissent sur le PDF final',
    ],
    tip: 'Faites signer sur place lors de la visite — les signatures sont horodatées automatiquement.',
    visual: [
      { label: '✍️ Zone de signature locataire', type: 'signature' },
      { label: '✅ Locataire : signé le 24/04/2026', type: 'check' },
      { label: '✍️ Zone de signature propriétaire', type: 'signature' },
      { label: '✅ Propriétaire : signé le 24/04/2026', type: 'check' },
    ]
  },
  {
    id: 6,
    icon: '📄',
    title: 'Générer & Envoyer le PDF',
    color: '#2d6ac4',
    duration: '1 minute',
    description: 'Générez le rapport PDF professionnel et envoyez-le automatiquement par email.',
    details: [
      'Cliquez sur "Télécharger PDF" depuis le récapitulatif',
      'Le PDF est généré instantanément avec toutes les informations',
      'Il contient : date/heure, identités, pièces, photos, compteurs, clés, signatures',
      'Cliquez "Envoyer par email" pour envoyer au locataire automatiquement',
      'Le locataire reçoit un lien de téléchargement sécurisé',
    ],
    tip: 'Le PDF est conforme à la loi ALUR 2014 — conservez-le précieusement.',
    visual: [
      { label: '📄 Rapport_EDL_12_rue_de_la_Paix.pdf', type: 'pdf' },
      { label: '📧 Email envoyé à jean.dupont@email.com', type: 'check' },
      { label: '✅ ALUR 2014 — Toutes mentions obligatoires', type: 'alur' },
    ]
  },
];

const alurPoints = [
  { icon: '📅', text: 'Date ET heure de début et fin (obligatoire)' },
  { icon: '👤', text: 'Identité complète du locataire et du propriétaire' },
  { icon: '📍', text: 'Adresse complète du logement' },
  { icon: '🚪', text: 'Description détaillée pièce par pièce' },
  { icon: '🧱', text: 'État de chaque élément : murs, sol, plafond, équipements' },
  { icon: '⚡', text: 'Relevés de compteurs (eau, gaz, électricité)' },
  { icon: '🔑', text: 'Nombre de clés et accès remis' },
  { icon: '✍️', text: 'Signatures des deux parties' },
];

function VisualCard({ item }) {
  if (item.type === 'button') return (
    <div className="bg-[#1e3a5f] text-white text-center py-2 px-4 rounded-xl text-sm font-medium">{item.label}</div>
  );
  if (item.type === 'input') return (
    <div className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-400 bg-white">{item.placeholder}</div>
  );
  if (item.type === 'check') return (
    <div className="flex items-center gap-2 text-sm text-gray-700"><span className="text-green-500 font-bold">✓</span>{item.label}</div>
  );
  if (item.type === 'ia') return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 italic">{item.label}</div>
  );
  if (item.type === 'info') return (
    <div className="text-sm text-gray-700 font-medium">{item.label}</div>
  );
  if (item.type === 'signature') return (
    <div className="border-2 border-dashed border-gray-300 rounded-xl h-10 flex items-center justify-center text-xs text-gray-400">{item.label}</div>
  );
  if (item.type === 'pdf') return (
    <div className="flex items-center gap-2 text-sm text-[#2d6ac4] font-medium"><span>📄</span>{item.label}</div>
  );
  if (item.type === 'alur') return (
    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1 text-xs text-green-700 font-medium">{item.label}</div>
  );
  return <div className="text-sm text-gray-700">{item.label}</div>;
}

export default function GuidePage() {
  const [activeStep, setActiveStep] = useState(null);

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white py-10 px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">📚 Guide d'utilisation</h1>
        <p className="text-white/80 text-sm max-w-lg mx-auto">Apprenez à créer un état des lieux professionnel conforme ALUR 2014 en quelques minutes</p>
      </div>

      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex-1">

        {/* Temps total */}
        <div className="bg-white rounded-2xl p-4 mb-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-gray-500">Temps total estimé</p>
            <p className="font-bold text-[#1e3a5f] text-lg">15 à 30 minutes</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Nombre d'étapes</p>
            <p className="font-bold text-[#2d6ac4] text-lg">6 étapes</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-8">
          {steps.map((step) => (
            <div key={step.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Header de l'étape */}
              <button
                onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: step.color + '15' }}>
                  {step.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: step.color }}>
                      Étape {step.id}
                    </span>
                    <span className="text-xs text-gray-400">⏱ {step.duration}</span>
                  </div>
                  <p className="font-semibold text-[#1e3a5f] mt-1">{step.title}</p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
                <span className="text-gray-400 text-lg">{activeStep === step.id ? '▲' : '▼'}</span>
              </button>

              {/* Contenu déroulable */}
              {activeStep === step.id && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  {/* Visuel mockup */}
                  <div className="bg-gray-50 rounded-xl p-4 mt-4 space-y-2 border border-gray-100">
                    <p className="text-xs text-gray-400 font-medium mb-3">APERÇU</p>
                    {step.visual.map((item, i) => (
                      <VisualCard key={i} item={item} />
                    ))}
                  </div>

                  {/* Détails */}
                  <div className="mt-4 space-y-2">
                    {step.details.map((detail, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-[#2d6ac4] font-bold mt-0.5 flex-shrink-0">→</span>
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>

                  {/* Conseil */}
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-amber-700 mb-1">💡 Conseil</p>
                    <p className="text-xs text-amber-700">{step.tip}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Section ALUR */}
        <div className="bg-[#1e3a5f] rounded-2xl p-6 mb-6 text-white">
          <h2 className="font-bold text-lg mb-1">⚖️ Conformité Loi ALUR 2014</h2>
          <p className="text-white/70 text-xs mb-4">Votre PDF contient automatiquement toutes les mentions obligatoires</p>
          <div className="space-y-2">
            {alurPoints.map((point, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-green-400 font-bold flex-shrink-0">✓</span>
                <span className="text-sm text-white/90">{point.icon} {point.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-white/10 rounded-xl p-3">
            <p className="text-xs text-white/70">⚠️ Important : le terme "certifié ALUR" n'existe pas officiellement. Notre app utilise la mention exacte : <span className="font-semibold text-white">"Conforme aux exigences de la loi ALUR 2014"</span></p>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-bold text-[#1e3a5f] text-lg mb-4">❓ Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              { q: 'Puis-je faire un EDL sans connexion internet ?', r: 'Non, l\'application nécessite une connexion pour sauvegarder et générer le PDF.' },
              { q: 'Les photos sont-elles stockées de façon sécurisée ?', r: 'Oui, les photos sont stockées sur Cloudinary avec chiffrement. Elles ne sont accessibles que via un lien sécurisé.' },
              { q: 'Le locataire doit-il être présent pour signer ?', r: 'Oui, la signature doit être faite en présence des deux parties. La loi ALUR l\'exige.' },
              { q: 'Combien de temps puis-je accéder au PDF ?', r: 'Le lien de téléchargement est valable 30 jours. Sauvegardez le PDF dès réception.' },
              { q: 'Puis-je modifier un EDL après l\'avoir créé ?', r: 'Oui, via le bouton "Modifier" sur le récapitulatif — vous pouvez changer l\'adresse, les heures, les noms.' },
            ].map((faq, i) => (
              <div key={i} className="border-b border-gray-100 pb-3 last:border-0">
                <p className="text-sm font-semibold text-[#1e3a5f] mb-1">Q : {faq.q}</p>
                <p className="text-sm text-gray-600">R : {faq.r}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <a href="/" className="inline-block bg-[#1e3a5f] text-white font-bold py-4 px-8 rounded-2xl text-sm hover:bg-[#2d6ac4] transition">
            🏠 Créer mon premier état des lieux
          </a>
        </div>
      </div>

      <Footer />
    </div>
  );
}
