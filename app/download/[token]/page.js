'use client';
import { useState, useEffect } from 'react';

export default function DownloadPage({ params }) {
  const { token } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/report/${token}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Lien invalide');
        }
        const reportData = await res.json();
        setData(reportData);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    }
    fetchReport();
  }, [token]);

  const generateAndDownloadPDF = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const edl = data.edl;
      const pieces = data.pieces || [];
      const pageWidth = 210;
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const reportId = 'EDL-' + (edl.id || '').substring(0, 8).toUpperCase();
      const hasAICert = edl.has_comparaison_ia || edl.has_archive;

      const addPage = () => { doc.addPage(); y = margin; addFooter(); };
      const checkSpace = (needed) => { if (y + needed > 270) addPage(); };
      const addFooter = () => {
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`${reportId} | ${new Date().toLocaleDateString('fr-FR')}`, margin, 290);
        doc.text('Etat des Lieux Pro', pageWidth - margin, 290, { align: 'right' });
        if (hasAICert) {
          doc.setFillColor(39, 169, 108);
          doc.roundedRect(pageWidth / 2 - 20, 286, 40, 6, 1, 1, 'F');
          doc.setFontSize(6); doc.setTextColor(255);
          doc.text('Certifie IA', pageWidth / 2, 290, { align: 'center' });
        }
      };

      // Cover page
      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, pageWidth, 80, 'F');
      doc.setTextColor(255); doc.setFontSize(28);
      doc.text('Etat des Lieux', pageWidth / 2, 35, { align: 'center' });
      doc.setFontSize(14);
      doc.text(edl.type_edl === 'Entrée' ? "d'Entree" : 'de Sortie', pageWidth / 2, 48, { align: 'center' });
      doc.setFontSize(10);
      doc.text(new Date(edl.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth / 2, 65, { align: 'center' });

      if (hasAICert) {
        doc.setFillColor(39, 169, 108);
        doc.roundedRect(pageWidth / 2 - 25, 70, 50, 8, 2, 2, 'F');
        doc.setFontSize(8); doc.setTextColor(255);
        doc.text('Certifie par Intelligence Artificielle', pageWidth / 2, 75.5, { align: 'center' });
      }

      y = 100;
      doc.setTextColor(30, 58, 95); doc.setFontSize(12);
      doc.text('Adresse du bien', margin, y); y += 7;
      doc.setTextColor(80); doc.setFontSize(11);
      doc.text(edl.adresse || '', margin, y); y += 12;
      doc.setTextColor(30, 58, 95); doc.setFontSize(12);
      doc.text('Type de logement', margin, y); y += 7;
      doc.setTextColor(80); doc.text(edl.type_logement || '', margin, y); y += 12;
      doc.setTextColor(30, 58, 95); doc.setFontSize(12);
      doc.text('Locataire', margin, y); y += 7;
      doc.setTextColor(80); doc.text(edl.nom_locataire || '', margin, y); y += 12;
      doc.setTextColor(30, 58, 95); doc.setFontSize(12);
      doc.text('Proprietaire', margin, y); y += 7;
      doc.setTextColor(80); doc.text(edl.nom_proprietaire || '', margin, y); y += 12;
      doc.setTextColor(30, 58, 95); doc.setFontSize(12);
      doc.text('Numero de rapport', margin, y); y += 7;
      doc.setTextColor(80); doc.text(reportId, margin, y);
      addFooter();

      // Room pages
      for (const piece of pieces) {
        addPage();
        const d = piece.donnees_json || {};

        doc.setFillColor(232, 240, 251);
        doc.rect(margin, y, contentWidth, 12, 'F');
        doc.setTextColor(30, 58, 95); doc.setFontSize(14);
        doc.text(`${piece.icon || ''} ${piece.nom}`, margin + 4, y + 8); y += 18;

        if (d.etat_general) {
          doc.setFontSize(10); doc.setTextColor(30, 58, 95);
          doc.text('Etat general : ', margin, y);
          doc.setTextColor(80); doc.text(d.etat_general, margin + 30, y); y += 7;
        }
        if (d.observations_generales) {
          doc.setTextColor(100); doc.setFontSize(9);
          const lines = doc.splitTextToSize(`Observations : ${d.observations_generales}`, contentWidth);
          doc.text(lines, margin, y); y += lines.length * 5 + 3;
        }

        checkSpace(30); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
        if (d.nature_murs) { doc.text(`Murs : ${d.nature_murs} - ${d.etat_murs || ''}`, margin, y); y += 6; }
        if (d.nature_plafond) { doc.text(`Plafond : ${d.nature_plafond} - ${d.etat_plafond || ''}`, margin, y); y += 6; }
        if (d.obs_murs) { doc.setTextColor(100); doc.setFontSize(9); const l = doc.splitTextToSize(d.obs_murs, contentWidth); doc.text(l, margin, y); y += l.length * 5 + 3; }
        checkSpace(20); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
        if (d.nature_sol) { doc.text(`Sol : ${d.nature_sol} - ${d.etat_sol || ''}`, margin, y); y += 6; }
        if (d.obs_sol) { doc.setTextColor(100); doc.setFontSize(9); const l = doc.splitTextToSize(d.obs_sol, contentWidth); doc.text(l, margin, y); y += l.length * 5 + 3; }
        checkSpace(30); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
        if (d.nb_fenetres) { doc.text(`Fenetres : ${d.nb_fenetres} - ${d.etat_fenetres || ''}`, margin, y); y += 6; }
        if (d.nb_portes) { doc.text(`Portes : ${d.nb_portes} - ${d.etat_portes || ''}`, margin, y); y += 6; }
        if (d.has_volets) { doc.text(`Volets/Stores : ${d.etat_volets || ''}`, margin, y); y += 6; }
        if (d.etat_prises) { doc.text(`Prises : ${d.etat_prises}`, margin, y); y += 6; }
        if (d.etat_interrupteurs) { doc.text(`Interrupteurs : ${d.etat_interrupteurs}`, margin, y); y += 6; }
        if (d.has_radiateurs) { doc.text(`Radiateurs : ${d.etat_radiateurs || ''}`, margin, y); y += 6; }

        // Photos with AI badges
        const photos = piece.photos || [];
        if (photos.length > 0) {
          checkSpace(15);
          doc.setFillColor(232, 240, 251);
          doc.rect(margin, y, contentWidth, 8, 'F');
          doc.setFontSize(10); doc.setTextColor(30, 58, 95);
          doc.text(`Photos (${photos.length})`, margin + 2, y + 6); y += 12;

          for (const photo of photos) {
            checkSpace(60);
            try {
              // Photo data is now pre-converted to base64 by the API
              const imageData = photo.data;
              console.log('📸 Photo debug:', { 
                hasData: !!imageData, 
                dataType: typeof imageData,
                dataLength: imageData?.length,
                first50chars: imageData?.substring(0, 50),
                startsWithData: imageData?.startsWith('data:')
              });
              
              if (imageData && imageData.startsWith('data:')) {
                console.log('✅ Adding image to PDF');
                doc.setDrawColor(200);
                doc.rect(margin, y, contentWidth, 52, 'S');
                doc.addImage(imageData, 'JPEG', margin + 2, y + 2, 48, 38);
                const infoX = margin + 54;
                if (photo.ai_analysis) {
                  if (photo.ai_analysis.verified) {
                    doc.setFillColor(39, 169, 108);
                    doc.roundedRect(infoX, y + 2, 35, 6, 1, 1, 'F');
                    doc.setFontSize(7); doc.setTextColor(255);
                    doc.text('Verifie par IA', infoX + 2, y + 6.5);
                  } else {
                    doc.setFillColor(220, 53, 69);
                    doc.roundedRect(infoX, y + 2, 35, 6, 1, 1, 'F');
                    doc.setFontSize(7); doc.setTextColor(255);
                    doc.text('Defauts (IA)', infoX + 2, y + 6.5);
                  }
                }
                doc.setFontSize(8); doc.setTextColor(100);
                doc.text(`Date : ${new Date(photo.horodatage).toLocaleString('fr-FR')}`, infoX, y + 16);
                if (photo.gps) { doc.text(`GPS : ${photo.gps.lat}, ${photo.gps.lng}`, infoX, y + 22); }
                if (photo.ai_analysis?.observations) {
                  doc.setFontSize(7); doc.setTextColor(45, 106, 196);
                  const ol = doc.splitTextToSize(`IA : ${photo.ai_analysis.observations}`, contentWidth - 56);
                  doc.text(ol.slice(0, 3), infoX, y + 30);
                }
                y += 56;
              }
            } catch (e) { y += 5; }
          }
        }
      }

      // Signature page
      addPage();
      doc.setFontSize(16); doc.setTextColor(30, 58, 95);
      doc.text('Signatures', pageWidth / 2, y, { align: 'center' }); y += 15;
      doc.setFontSize(10);
      doc.text('Le locataire :', margin, y); y += 6;
      doc.text(edl.nom_locataire || '', margin, y); y += 20;
      doc.text('Le proprietaire :', margin, y); y += 6;
      doc.text(edl.nom_proprietaire || '', margin, y); y += 20;
      doc.setFontSize(9); doc.setTextColor(100);
      doc.text(`Document genere le ${new Date().toLocaleDateString('fr-FR')} - ${reportId}`, margin, y);
      addFooter();

      doc.save(`EDL_${edl.adresse?.replace(/[^a-zA-Z0-9]/g, '_') || 'rapport'}_${reportId}.pdf`);
      setDownloaded(true);
    } catch (e) {
      console.error('PDF Error:', e);
      setError('Erreur lors de la generation du PDF: ' + e.message);
    }
    setGenerating(false);
  };

  // LOADING
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">📄</div>
          <p className="text-gray-500 text-sm">Chargement du rapport...</p>
        </div>
      </div>
    );
  }

  // ERROR
  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="font-bold text-[#1e3a5f] text-lg mb-2">Lien invalide</h2>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <a href="/" className="inline-block bg-[#2d6ac4] text-white font-semibold px-6 py-3 rounded-xl text-sm">
            Retour a l'accueil
          </a>
        </div>
      </div>
    );
  }

  const edl = data?.edl;
  const pieces = data?.pieces || [];
  const totalPhotos = pieces.reduce((acc, p) => acc + (p.photos?.length || 0), 0);

  // DOWNLOAD PAGE
  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <div className="max-w-[480px] mx-auto min-h-screen">
        {/* Header */}
        <header className="bg-[#1e3a5f] text-white px-5 py-5 text-center">
          <h1 className="text-lg font-bold">🏠 État des Lieux Pro</h1>
          <p className="text-white/70 text-xs mt-1">Téléchargement sécurisé du rapport</p>
        </header>

        <main className="px-4 py-6 space-y-5">
          {/* Report card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-[#e8f0fb] rounded-xl flex items-center justify-center text-2xl">📋</div>
              <div>
                <h2 className="font-bold text-[#1e3a5f]">Rapport d'état des lieux</h2>
                <p className="text-xs text-gray-500">{edl?.type_edl === 'Entrée' ? "État des lieux d'entrée" : "État des lieux de sortie"}</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Adresse</span>
                <span className="font-medium text-[#1e3a5f] text-right max-w-[200px]">{edl?.adresse}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Type</span>
                <span className="font-medium">{edl?.type_logement}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Locataire</span>
                <span className="font-medium">{edl?.nom_locataire}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Propriétaire</span>
                <span className="font-medium">{edl?.nom_proprietaire}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
                <span className="text-gray-500">Pièces</span>
                <span className="font-bold text-[#27a96c]">{pieces.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Photos</span>
                <span className="font-bold text-[#2d6ac4]">{totalPhotos}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{new Date(edl?.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>

            {/* AI badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {edl?.has_comparaison_ia && (
                <span className="text-xs bg-[#e6f7ef] text-[#27a96c] px-3 py-1 rounded-full font-medium">🤖 Comparaison IA</span>
              )}
              {edl?.has_archive && (
                <span className="text-xs bg-[#e8f0fb] text-[#2d6ac4] px-3 py-1 rounded-full font-medium">🔐 Archive 10 ans</span>
              )}
            </div>

            {/* Download button */}
            {!downloaded ? (
              <button onClick={generateAndDownloadPDF} disabled={generating}
                className="w-full bg-[#27a96c] text-white font-bold py-4 rounded-2xl hover:bg-[#1f9058] disabled:opacity-50 shadow-lg shadow-green-200 transition-all">
                {generating ? '⏳ Génération du PDF...' : '📥 Télécharger le rapport PDF'}
              </button>
            ) : (
              <div className="text-center space-y-3">
                <div className="bg-[#e6f7ef] rounded-2xl p-4">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-bold text-[#27a96c]">PDF téléchargé !</p>
                  <p className="text-xs text-gray-500 mt-1">Vérifiez votre dossier Téléchargements</p>
                </div>
                <button onClick={() => { setDownloaded(false); generateAndDownloadPDF(); }}
                  className="w-full bg-[#2d6ac4] text-white font-semibold py-3 rounded-xl text-sm">
                  🔄 Télécharger à nouveau
                </button>
              </div>
            )}
          </div>

          {/* Security note */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="text-xs font-medium text-[#1e3a5f]">Lien sécurisé à usage unique</p>
                <p className="text-[10px] text-gray-400">Ce lien est personnel et ne doit pas être partagé</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-gray-400 pb-8">
            État des Lieux Pro — Rapport professionnel certifié
          </p>
        </main>
      </div>
    </div>
  );
}
