'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import emailjs from '@emailjs/browser';

// ==================== CONSTANTS ====================
const HOUSING_TYPES = ['Studio', 'T1', 'T2', 'T3', 'T4', 'Maison'];
const EDL_TYPES = ['Entrée', 'Sortie'];
const CONDITIONS = ['Très bon', 'Bon', 'Correct', 'Usé', 'Dégradé'];
const WALL_MATERIALS = ['Peinture', 'Papier peint', 'Carrelage', 'Béton', 'Autre'];
const FLOOR_MATERIALS = ['Carrelage', 'Parquet', 'Lino', 'Moquette', 'Béton', 'Autre'];
const CEILING_MATERIALS = ['Peinture', 'Plâtre', 'Lambris', 'Béton', 'Autre'];

const ROOM_ICONS = {
  'Entrée': '🚪', 'Salon': '🛋️', 'Cuisine': '🍳', 'Chambre 1': '🛏️',
  'Chambre 2': '🛏️', 'Chambre 3': '🛏️', 'Salle de bain': '🚿', 'WC': '🚽',
  'Couloir': '🏠', 'Balcon': '🌿', 'Cave': '📦', 'Garage': '🚗',
};

const EQUIPMENT_CONDITIONS = ['Bon état', 'Correct', 'Usé', 'Dégradé', 'Absent'];

// ==================== GPS HELPER ====================
function getGPS() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  });
}

// ==================== COMPRESS FOR AI ====================
function compressForAI(base64, maxWidth = 512) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.src = base64;
  });
}

// ==================== API HELPERS ====================
async function api(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };
  
  const res = await fetch(`/api/${path}`, {
    ...options,
    headers,
  });
  
  if (!res.ok) {
    // If 401, token expired or invalid
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      window.location.reload();
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur API');
  }
  return res.json();
}

// ==================== UTILITY ====================
function conditionColor(condition) {
  switch (condition) {
    case 'Très bon': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    case 'Bon': return 'bg-green-100 text-green-700 border-green-300';
    case 'Correct': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    case 'Usé': return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'Dégradé': return 'bg-red-100 text-red-700 border-red-300';
    default: return 'bg-gray-100 text-gray-600 border-gray-300';
  }
}

function statusBadge(statut) {
  switch (statut) {
    case 'completed': return { bg: 'bg-[#e6f7ef] border-[#27a96c]', text: 'text-[#27a96c]', label: '✓ Terminé' };
    case 'in_progress': return { bg: 'bg-[#e8f0fb] border-[#2d6ac4]', text: 'text-[#2d6ac4]', label: '● En cours' };
    default: return { bg: 'bg-gray-100 border-gray-300', text: 'text-gray-500', label: '○ À inspecter' };
  }
}

// ==================== MAIN APP ====================
export default function App() {
  const [view, setView] = useState('dashboard');
  const [edls, setEdls] = useState([]);
  const [currentEdl, setCurrentEdl] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [currentPiece, setCurrentPiece] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [inspectionStep, setInspectionStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userEmail, setUserEmail] = useState(null); // User session email
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authLoading, setAuthLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form state for new EDL
  const [newEdl, setNewEdl] = useState({
    adresse: '', type_logement: 'T2', type_edl: 'Entrée',
    nom_locataire: '', nom_proprietaire: '', email_locataire: '',
  });

  const showNotif = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Handle Stripe payment return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get('payment_success');
    const sessionId = params.get('session_id');
    const edlId = params.get('edl_id');
    const paymentCancel = params.get('payment_cancel');

    if (paymentCancel) {
      showNotif('Paiement annulé', 'error');
      window.history.replaceState({}, '', '/');
      return;
    }

    if (paymentSuccess && sessionId && edlId) {
      // Poll Stripe for payment status with retry logic
      const pollPayment = async (attempt = 0, maxAttempts = 5) => {
        try {
          const result = await api('stripe/status', {
            method: 'POST',
            body: JSON.stringify({ session_id: sessionId }),
          });

          console.log(`Payment status result (attempt ${attempt + 1}):`, result);

          // Check if payment is complete (paid, no_payment_required for $0, or download_token exists)
          const isComplete = result.payment_status === 'paid' || 
                           result.payment_status === 'no_payment_required' || 
                           result.download_token;

          if (isComplete) {
            // Wait a bit for webhook to fully process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            showNotif('Paiement réussi ! Votre rapport est débloqué 🎉');
            
            // Force complete refresh with cache busting
            const cacheBuster = Date.now();
            const edl = await api(`edl/${edlId}?_t=${cacheBuster}`);
            
            if (edl && edl.paid) {
              // Force new object reference to trigger re-render
              setCurrentEdl({ ...edl, _refreshKey: cacheBuster });
              const piecesData = await api(`pieces?edl_id=${edlId}&_t=${cacheBuster}`);
              setPieces([...piecesData]);
              setView('report');
              
              // Also refresh the EDL list
              fetchEdls();
            } else if (attempt < maxAttempts - 1) {
              // EDL not yet marked as paid, retry after delay
              console.log('EDL not yet paid, retrying...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              return pollPayment(attempt + 1, maxAttempts);
            } else {
              showNotif('Le paiement est en cours de traitement. Rechargez la page dans quelques instants.', 'error');
            }
          } else if (attempt < maxAttempts - 1) {
            // Payment not complete, retry
            showNotif('Vérification du paiement en cours...', 'info');
            await new Promise(resolve => setTimeout(resolve, 2000));
            return pollPayment(attempt + 1, maxAttempts);
          } else {
            showNotif('Erreur : Le paiement n\'a pas pu être vérifié. Contactez le support.', 'error');
          }
        } catch (e) {
          console.error('Payment poll error:', e);
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return pollPayment(attempt + 1, maxAttempts);
          } else {
            showNotif('Erreur lors de la vérification du paiement', 'error');
          }
        }
        window.history.replaceState({}, '', '/');
      };
      pollPayment();
    }
  }, []);

  // ---- Init: Load user session on mount ----
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setUserEmail(user.email);
        fetchEdls();
      } catch (err) {
        console.error('Error parsing user data:', err);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        setShowEmailPrompt(true);
      }
    } else {
      setShowEmailPrompt(true);
    }
  }, []);

  // Block body scroll when auth modal is open
  useEffect(() => {
    if (showEmailPrompt) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [showEmailPrompt]);

  // ---- Auth functions ----
  const handleAuth = async (e, mode) => {
    e.preventDefault();
    setAuthLoading(true);
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const nom = formData.get('nom');
    
    try {
      const endpoint = mode === 'register' ? 'auth/register' : 'auth/login';
      const result = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(mode === 'register' ? { email, password, nom } : { email, password }),
      });
      
      // Save token and user data
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_data', JSON.stringify(result.user));
      
      setUserEmail(result.user.email);
      setShowEmailPrompt(false);
      fetchEdls();
      
      showNotif(mode === 'register' ? 'Compte créé avec succès !' : 'Connexion réussie !');
    } catch (err) {
      showNotif(err.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  // ---- Data fetching ----
  const fetchEdls = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      // No token, don't try to fetch
      return;
    }
    
    try {
      const cacheBuster = Date.now();
      const data = await api(`edl?_t=${cacheBuster}`);
      setEdls([...data]); // Force new array reference
    } catch (e) { 
      console.error('fetchEdls error:', e.message);
      // Don't set state in a loop - only if we have a token but it failed
      if (e.message.includes('authentifié') || e.message.includes('Session expirée')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        if (!showEmailPrompt) {
          setShowEmailPrompt(true);
        }
      }
    }
  }, [showEmailPrompt]);

  const fetchPieces = useCallback(async (edlId) => {
    try {
      const cacheBuster = Date.now();
      const data = await api(`pieces?edl_id=${edlId}&_t=${cacheBuster}`);
      setPieces([...data]); // Force new array reference
    } catch (e) { console.error(e); }
  }, []);

  const fetchPhotos = useCallback(async (pieceId) => {
    try {
      const cacheBuster = Date.now();
      const data = await api(`photos?piece_id=${pieceId}&_t=${cacheBuster}`);
      setPhotos(data);
    } catch (e) { 
      console.error('Erreur chargement photos:', e); 
    }
  }, []);

  // ---- Navigation ----
  const goToDashboard = () => { setView('dashboard'); setCurrentEdl(null); fetchEdls(); };
  const goToRooms = async (edl) => {
    // Always fetch fresh EDL data from DB
    const cacheBuster = Date.now();
    const freshEdl = await api(`edl/${edl.id}?_t=${cacheBuster}`);
    setCurrentEdl({...freshEdl, _refreshKey: cacheBuster}); // Force new reference with fresh data
    const piecesData = await api(`pieces?edl_id=${edl.id}&_t=${cacheBuster}`);
    setPieces([...piecesData]); // Force new reference
    setView('rooms');
  };
  const goToInspection = async (piece) => {
    setCurrentPiece(piece);
    setFormData(piece.donnees_json || {});
    await fetchPhotos(piece.id);
    setInspectionStep(1);
    setView('inspection');
  };
  const goToReport = async (edl) => {
    // Always fetch fresh EDL data from DB to ensure we have latest paid status
    const cacheBuster = Date.now();
    const freshEdl = await api(`edl/${edl.id}?_t=${cacheBuster}`);
    setCurrentEdl({...freshEdl, _refreshKey: cacheBuster}); // Force new reference with fresh data
    const piecesData = await api(`pieces?edl_id=${edl.id}&_t=${cacheBuster}`);
    setPieces([...piecesData]); // Force new reference
    setView('report');
  };

  // ---- Create EDL ----
  const createEdl = async () => {
    if (!newEdl.adresse || !newEdl.nom_locataire || !newEdl.nom_proprietaire) {
      showNotif('Veuillez remplir tous les champs', 'error');
      return;
    }
    if (newEdl.email_locataire && !newEdl.email_locataire.includes('@')) {
      showNotif('Veuillez entrer un email valide', 'error');
      return;
    }
    setLoading(true);
    try {
      const edl = await api('edl', { method: 'POST', body: JSON.stringify(newEdl) });
      showNotif('État des lieux créé !');
      setNewEdl({ adresse: '', type_logement: 'T2', type_edl: 'Entrée', nom_locataire: '', nom_proprietaire: '', email_locataire: '' });
      setShowCreateForm(false);
      // FORCE REFRESH - Refetch all EDLs
      const updatedEdls = await api('edl');
      setEdls(updatedEdls);
      await goToRooms(edl);
    } catch (e) { showNotif(e.message, 'error'); }
    setLoading(false);
  };

  // ---- Save inspection data ----
  const saveInspection = async (data, nextStep) => {
    if (!currentPiece) return;
    const merged = { ...formData, ...data };
    setFormData(merged);
    try {
      const newStatut = nextStep > 5 ? 'completed' : 'in_progress';
      await api(`pieces/${currentPiece.id}`, {
        method: 'PUT',
        body: JSON.stringify({ donnees_json: merged, statut: newStatut, observations_generales: merged.observations_generales || '' }),
      });
      if (nextStep > 5) {
        showNotif('Pièce terminée !');
        // FORCE REFRESH - Refetch everything with cache busters
        if (currentEdl) {
          // 1. Add small delay to ensure DB write is complete
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // 2. Refresh pieces list with cache buster
          const cacheBuster = Date.now();
          const updatedPieces = await api(`pieces?edl_id=${currentEdl.id}&_t=${cacheBuster}`);
          setPieces([...updatedPieces]); // Force new reference
          
          // 3. Refresh EDL list to get updated progress
          const updatedEdls = await api(`edl?_t=${cacheBuster}`);
          setEdls([...updatedEdls]); // Force new reference
          
          // 4. Update current EDL with fresh data
          const freshEdl = updatedEdls.find(e => e.id === currentEdl.id);
          if (freshEdl) {
            setCurrentEdl({...freshEdl}); // Force new reference
          }
        }
        setView('rooms');
      } else {
        setInspectionStep(nextStep);
      }
    } catch (e) { showNotif(e.message, 'error'); }
  };

  // ---- Photo handling ----
  const uploadPhoto = async (base64Data, legende = '', gpsData = null) => {
    if (!currentPiece || !currentEdl) {
      showNotif('Erreur: pièce ou EDL non défini', 'error');
      return;
    }
    try {
      const gps = gpsData || await getGPS();
      
      const response = await api('photos', {
        method: 'POST',
        body: JSON.stringify({
          piece_id: currentPiece.id,
          edl_id: currentEdl.id,
          data: base64Data,
          legende,
          horodatage: new Date().toISOString(),
          gps,
        }),
      });
      
      // Small delay to ensure DB has written
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await fetchPhotos(currentPiece.id);
      showNotif('Photo ajoutée !');
    } catch (e) { 
      showNotif(e.message, 'error'); 
    }
  };

  const deletePhoto = async (photoId) => {
    try {
      await api(`photos/${photoId}`, { method: 'DELETE' });
      await fetchPhotos(currentPiece.id);
      showNotif('Photo supprimée');
    } catch (e) { showNotif(e.message, 'error'); }
  };

  // ---- Add custom room ----
  const addCustomRoom = async (name) => {
    if (!currentEdl) return;
    try {
      const piece = await api('pieces', {
        method: 'POST',
        body: JSON.stringify({ edl_id: currentEdl.id, nom: name, icon: '📋' }),
      });
      await fetchPieces(currentEdl.id);
      showNotif(`${name} ajoutée !`);
    } catch (e) { showNotif(e.message, 'error'); }
  };

  // ---- Delete EDL ----
  const deleteEdl = async (edlId) => {
    if (!confirm('Supprimer cet état des lieux ?')) return;
    try {
      await api(`edl/${edlId}`, { method: 'DELETE' });
      showNotif('Supprimé');
      fetchEdls();
    } catch (e) { showNotif(e.message, 'error'); }
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      {/* Auth Modal (Login/Register) */}
      {showEmailPrompt && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#1e3a5f] to-[#2d6ac4] z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl my-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-[#1e3a5f] mb-2">🏠 État des Lieux Pro</h1>
              <p className="text-gray-600 text-sm">
                {authMode === 'login' ? 'Connectez-vous à votre compte' : 'Créez votre compte professionnel'}
              </p>
            </div>

            <form onSubmit={(e) => handleAuth(e, authMode)} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    name="nom"
                    placeholder="Jean Dupont"
                    required
                    autoComplete="name"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#2d6ac4] outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="vous@exemple.com"
                  required
                  autoComplete="email"
                  autoFocus={authMode === 'login'}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#2d6ac4] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#2d6ac4] outline-none"
                />
                {authMode === 'register' && (
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
                )}
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-[#2d6ac4] hover:bg-[#2560b5] text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {authLoading ? '⏳ Chargement...' : (authMode === 'login' ? '🔓 Se connecter' : '✅ Créer mon compte')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-sm text-[#2d6ac4] hover:underline font-medium">
                {authMode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                🔒 Vos données sont sécurisées et chiffrées
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${notification.type === 'error' ? 'bg-red-500' : 'bg-[#27a96c]'}`}>
          {notification.msg}
        </div>
      )}

      <div className="max-w-[480px] mx-auto min-h-screen">
        {/* HEADER */}
        <header className="bg-[#1e3a5f] text-white px-5 py-4 sticky top-0 z-40 shadow-md">
          <div className="flex items-center justify-between">
            {view !== 'dashboard' && (
              <button onClick={() => {
                if (view === 'inspection') { setView('rooms'); fetchPieces(currentEdl?.id); }
                else if (view === 'rooms' || view === 'report') goToDashboard();
                else goToDashboard();
              }} className="text-white/80 hover:text-white mr-3 text-lg">
                ←
              </button>
            )}
            <div className="flex-1">
              <h1 className="text-lg font-bold tracking-tight">🏠 État des Lieux Pro</h1>
              {view === 'rooms' && currentEdl && (
                <p className="text-xs text-white/70 mt-0.5 truncate">{currentEdl.adresse}</p>
              )}
              {view === 'inspection' && currentPiece && (
                <p className="text-xs text-white/70 mt-0.5">{currentPiece.icon} {currentPiece.nom} — Étape {inspectionStep}/5</p>
              )}
            </div>
            {view === 'dashboard' && userEmail && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowCreateForm(true)}
                  className="bg-[#2d6ac4] hover:bg-[#2560b5] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all">
                  + Nouveau
                </button>
                <button onClick={() => {
                  localStorage.removeItem('auth_token');
                  localStorage.removeItem('user_data');
                  setUserEmail(null);
                  setEdls([]);
                  setShowEmailPrompt(true);
                }}
                  className="text-white/70 hover:text-white text-xs" title="Déconnexion">
                  🚪
                </button>
              </div>
            )}
          </div>
        </header>

        {/* VIEWS */}
        <main className="px-4 py-5 pb-24">
          {view === 'dashboard' && (
            <DashboardView
              edls={edls} showCreate={showCreateForm} setShowCreate={setShowCreateForm}
              newEdl={newEdl} setNewEdl={setNewEdl} createEdl={createEdl}
              goToRooms={goToRooms} goToReport={goToReport} deleteEdl={deleteEdl} loading={loading}
            />
          )}
          {view === 'rooms' && (
            <RoomsView
              edl={currentEdl} pieces={pieces} goToInspection={goToInspection}
              goToReport={goToReport} addCustomRoom={addCustomRoom}
              showNotif={showNotif} fetchPieces={() => fetchPieces(currentEdl?.id)}
            />
          )}
          {view === 'inspection' && (
            <InspectionView
              piece={currentPiece} step={inspectionStep} setStep={setInspectionStep}
              formData={formData} saveInspection={saveInspection}
              photos={photos} uploadPhoto={uploadPhoto} deletePhoto={deletePhoto}
              edl={currentEdl} showNotif={showNotif}
            />
          )}
          {view === 'report' && (
            <ReportView edl={currentEdl} pieces={pieces} showNotif={showNotif} />
          )}
        </main>
      </div>
    </div>
  );
}

// ==================== DASHBOARD VIEW ====================
function DashboardView({ edls, showCreate, setShowCreate, newEdl, setNewEdl, createEdl, goToRooms, goToReport, deleteEdl, loading }) {
  return (
    <div>
      {/* Create Form Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full max-w-[480px] rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e3a5f]">Nouvel état des lieux</h2>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Adresse du logement *</label>
              <input type="text" value={newEdl.adresse} onChange={e => setNewEdl({...newEdl, adresse: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2d6ac4] focus:border-transparent outline-none"
                placeholder="12 rue de la Paix, 75001 Paris" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Type de logement</label>
                <select value={newEdl.type_logement} onChange={e => setNewEdl({...newEdl, type_logement: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2d6ac4] outline-none bg-white">
                  {HOUSING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Type d'EDL</label>
                <select value={newEdl.type_edl} onChange={e => setNewEdl({...newEdl, type_edl: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2d6ac4] outline-none bg-white">
                  {EDL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nom du locataire *</label>
              <input type="text" value={newEdl.nom_locataire} onChange={e => setNewEdl({...newEdl, nom_locataire: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2d6ac4] outline-none"
                placeholder="Jean Dupont" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nom du propriétaire *</label>
              <input type="text" value={newEdl.nom_proprietaire} onChange={e => setNewEdl({...newEdl, nom_proprietaire: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2d6ac4] outline-none"
                placeholder="Marie Martin" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email du locataire (recommandé pour envoi automatique)</label>
              <input type="email" value={newEdl.email_locataire} onChange={e => setNewEdl({...newEdl, email_locataire: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2d6ac4] outline-none"
                placeholder="jean.dupont@example.com" />
              <p className="text-xs text-gray-500 mt-1">💡 Le rapport PDF sera envoyé automatiquement à cet email après paiement</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={createEdl} disabled={loading}
                className="flex-1 py-3 rounded-xl bg-[#1e3a5f] text-white font-semibold text-sm hover:bg-[#162d4a] disabled:opacity-50 transition-all">
                {loading ? '...' : 'Créer l\'EDL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {edls.length === 0 && !showCreate && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🏠</div>
          <h2 className="text-xl font-bold text-[#1e3a5f] mb-2">Bienvenue !</h2>
          <p className="text-gray-500 text-sm mb-6">Créez votre premier état des lieux<br />en quelques minutes</p>
          <button onClick={() => setShowCreate(true)}
            className="bg-[#2d6ac4] text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-[#2560b5] shadow-lg shadow-blue-200 transition-all">
            + Créer un état des lieux
          </button>
        </div>
      )}

      {/* EDL List */}
      {edls.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Mes états des lieux</h2>
          {edls.map(edl => {
            const progress = edl.pieces_total > 0 ? Math.round((edl.pieces_done / edl.pieces_total) * 100) : 0;
            return (
              <div key={edl.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[#1e3a5f] text-sm truncate">{edl.adresse}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {edl.type_logement} • {edl.type_edl} • {new Date(edl.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${edl.paid ? 'bg-[#e6f7ef] text-[#27a96c]' : 'bg-[#e8f0fb] text-[#2d6ac4]'}`}>
                    {edl.paid ? '✓ Finalisé' : 'En cours'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                  <span>🏠 {edl.pieces_done}/{edl.pieces_total} pièces</span>
                  <span>📷 {edl.photos_count || 0} photos</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div className="h-2 rounded-full bg-gradient-to-r from-[#2d6ac4] to-[#27a96c] transition-all duration-500"
                    style={{ width: `${progress}%` }} />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => goToRooms(edl)}
                    className="flex-1 bg-[#1e3a5f] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#162d4a] transition-all">
                    {progress === 100 ? '📋 Voir' : '▶ Continuer'}
                  </button>
                  {progress === 100 && (
                    <button onClick={() => goToReport(edl)}
                      className="flex-1 bg-[#27a96c] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#1f9058] transition-all">
                      📄 Rapport
                    </button>
                  )}
                  <button onClick={() => deleteEdl(edl.id)}
                    className="px-3 py-2.5 rounded-xl border border-red-200 text-red-400 hover:bg-red-50 text-sm transition-all">
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== ROOMS VIEW ====================
function RoomsView({ edl, pieces, goToInspection, goToReport, addCustomRoom, showNotif, fetchPieces }) {
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [customName, setCustomName] = useState('');

  const piecesCompleted = pieces.filter(p => p.statut === 'completed').length;
  const progress = pieces.length > 0 ? Math.round((piecesCompleted / pieces.length) * 100) : 0;

  return (
    <div>
      {/* Stats */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[#1e3a5f]">Progression</h2>
          <span className="text-2xl font-bold text-[#2d6ac4]">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
          <div className="h-3 rounded-full bg-gradient-to-r from-[#2d6ac4] to-[#27a96c] transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>🏠 {piecesCompleted}/{pieces.length} pièces</span>
          <span>{edl?.type_edl === 'Entrée' ? "📥 Entrée" : "📤 Sortie"}</span>
        </div>
      </div>

      {/* AI Batch Upload */}
      <BatchUploader
        edlId={edl?.id}
        pieces={pieces}
        showNotif={showNotif || (() => {})}
        onComplete={() => { if (fetchPieces) fetchPieces(); }}
      />

      {/* Room Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {pieces.map(piece => {
          const status = statusBadge(piece.statut);
          return (
            <button key={piece.id} onClick={() => goToInspection(piece)}
              className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${piece.statut === 'completed' ? 'border-[#27a96c]' : piece.statut === 'in_progress' ? 'border-[#2d6ac4]' : 'border-gray-100'} hover:shadow-md transition-all text-left`}>
              <div className="text-3xl mb-2">{piece.icon || ROOM_ICONS[piece.nom] || '📋'}</div>
              <h3 className="font-semibold text-[#1e3a5f] text-sm mb-1">{piece.nom}</h3>
              <div className={`text-xs font-medium ${status.text}`}>{status.label}</div>
              {piece.photos_count > 0 && (
                <div className="text-xs text-gray-400 mt-1">📷 {piece.photos_count}</div>
              )}
            </button>
          );
        })}

        {/* Add room button */}
        <button onClick={() => setShowAddRoom(true)}
          className="bg-white rounded-2xl p-4 shadow-sm border-2 border-dashed border-gray-200 hover:border-[#2d6ac4] hover:shadow-md transition-all text-center flex flex-col items-center justify-center">
          <div className="text-3xl mb-2 text-gray-300">+</div>
          <h3 className="font-medium text-gray-400 text-sm">Ajouter</h3>
        </button>
      </div>

      {/* Generate report button */}
      {piecesCompleted > 0 && (
        <button onClick={() => goToReport(edl)}
          className="w-full bg-[#27a96c] text-white font-semibold py-4 rounded-2xl hover:bg-[#1f9058] shadow-lg shadow-green-200 transition-all text-sm">
          📄 Générer le rapport ({piecesCompleted} pièce{piecesCompleted > 1 ? 's' : ''})
        </button>
      )}

      {/* Add room modal */}
      {showAddRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowAddRoom(false)}>
          <div className="bg-white w-full max-w-[480px] rounded-t-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#1e3a5f]">Ajouter une pièce</h3>
            <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2d6ac4] outline-none"
              placeholder="Nom de la pièce" />
            <div className="flex gap-3">
              <button onClick={() => setShowAddRoom(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm">
                Annuler
              </button>
              <button onClick={() => { if (customName.trim()) { addCustomRoom(customName.trim()); setCustomName(''); setShowAddRoom(false); } }}
                className="flex-1 py-3 rounded-xl bg-[#1e3a5f] text-white font-semibold text-sm">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== INSPECTION VIEW ====================
function InspectionView({ piece, step, setStep, formData, saveInspection, photos, uploadPhoto, deletePhoto, edl, showNotif }) {
  const [localData, setLocalData] = useState(formData || {});
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => { setLocalData(formData || {}); }, [formData]);

  const update = (key, value) => setLocalData(prev => ({ ...prev, [key]: value }));

  // Photo handling with timestamp
  const processImage = useCallback(async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 1200;
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Draw timestamp
          const now = new Date();
          const timestamp = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR');
          const fontSize = Math.max(14, canvas.width * 0.03);
          ctx.font = `bold ${fontSize}px Arial`;
          const textWidth = ctx.measureText(timestamp).width;
          const padding = 8;
          const x = canvas.width - textWidth - padding * 2;
          const y = canvas.height - padding * 2;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(x - padding, y - fontSize - padding, textWidth + padding * 2, fontSize + padding * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(timestamp, x, y);

          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const base64 = await processImage(file);
      await uploadPhoto(base64);
    }
    e.target.value = '';
  };

  const stepNames = ['Général', 'Murs & Plafond', 'Sol', 'Équipements', 'Photos'];

  // Detect room type for specific equipment
  const roomType = piece?.nom?.toLowerCase() || '';
  const isKitchen = roomType.includes('cuisine');
  const isBathroom = roomType.includes('salle de bain') || roomType.includes('bain');
  const isWC = roomType === 'wc' || roomType.includes('wc');

  return (
    <div>
      {/* Progress indicator */}
      <div className="flex items-center gap-1 mb-6">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className="flex-1 flex flex-col items-center">
            <div className={`w-full h-1.5 rounded-full ${s <= step ? 'bg-[#2d6ac4]' : 'bg-gray-200'} transition-all`} />
            <span className={`text-[10px] mt-1 ${s === step ? 'text-[#2d6ac4] font-bold' : 'text-gray-400'}`}>{stepNames[s - 1]}</span>
          </div>
        ))}
      </div>

      {/* Step 1: General */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">État général</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">État de la pièce</label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map(c => (
                <button key={c} onClick={() => update('etat_general', c)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${localData.etat_general === c ? conditionColor(c) + ' border-2' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Observations générales</label>
            <VoiceInput
              value={localData.observations_generales || ''}
              onChange={v => update('observations_generales', v)}
              showNotif={showNotif}
              placeholder="Décrivez l'état général de la pièce... ou utilisez le micro 🎙️"
              rows={4}
            />
          </div>
          <StepButtons step={step} onNext={() => saveInspection(localData, 2)} />
        </div>
      )}

      {/* Step 2: Walls & Ceiling */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">Murs & Plafond</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Nature des murs</label>
            <div className="flex flex-wrap gap-2">
              {WALL_MATERIALS.map(m => (
                <button key={m} onClick={() => update('nature_murs', m)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${localData.nature_murs === m ? 'bg-[#e8f0fb] text-[#2d6ac4] border-[#2d6ac4]' : 'bg-white border-gray-200 text-gray-600'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <ConditionSelector label="État des murs" value={localData.etat_murs} onChange={v => update('etat_murs', v)} />
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Nature du plafond</label>
            <div className="flex flex-wrap gap-2">
              {CEILING_MATERIALS.map(m => (
                <button key={m} onClick={() => update('nature_plafond', m)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${localData.nature_plafond === m ? 'bg-[#e8f0fb] text-[#2d6ac4] border-[#2d6ac4]' : 'bg-white border-gray-200 text-gray-600'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <ConditionSelector label="État du plafond" value={localData.etat_plafond} onChange={v => update('etat_plafond', v)} />
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Observations</label>
            <VoiceInput
              value={localData.obs_murs || ''}
              onChange={v => update('obs_murs', v)}
              showNotif={showNotif}
              placeholder="Observations sur les murs et plafond... ou utilisez le micro 🎙️"
              rows={3}
            />
          </div>
          <StepButtons step={step} onPrev={() => setStep(1)} onNext={() => saveInspection(localData, 3)} />
        </div>
      )}

      {/* Step 3: Floor */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">Sol</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Nature du sol</label>
            <div className="flex flex-wrap gap-2">
              {FLOOR_MATERIALS.map(m => (
                <button key={m} onClick={() => update('nature_sol', m)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${localData.nature_sol === m ? 'bg-[#e8f0fb] text-[#2d6ac4] border-[#2d6ac4]' : 'bg-white border-gray-200 text-gray-600'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <ConditionSelector label="État du sol" value={localData.etat_sol} onChange={v => update('etat_sol', v)} />
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Observations</label>
            <VoiceInput
              value={localData.obs_sol || ''}
              onChange={v => update('obs_sol', v)}
              showNotif={showNotif}
              placeholder="Observations sur le sol... ou utilisez le micro 🎙️"
              rows={3}
            />
          </div>
          <StepButtons step={step} onPrev={() => setStep(2)} onNext={() => saveInspection(localData, 4)} />
        </div>
      )}

      {/* Step 4: Equipment */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">Équipements & Menuiseries</h2>

          {/* Windows */}
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Fenêtres</label>
              <input type="number" min="0" value={localData.nb_fenetres || 0} onChange={e => update('nb_fenetres', parseInt(e.target.value) || 0)}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center" />
            </div>
            {(localData.nb_fenetres || 0) > 0 && (
              <ConditionSelector label="" value={localData.etat_fenetres} onChange={v => update('etat_fenetres', v)} compact />
            )}
          </div>

          {/* Doors */}
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Portes</label>
              <input type="number" min="0" value={localData.nb_portes || 0} onChange={e => update('nb_portes', parseInt(e.target.value) || 0)}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center" />
            </div>
            {(localData.nb_portes || 0) > 0 && (
              <ConditionSelector label="" value={localData.etat_portes} onChange={v => update('etat_portes', v)} compact />
            )}
          </div>

          {/* Shutters */}
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-sm font-medium text-gray-700 flex-1">Volets / Stores</label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={localData.has_volets || false} onChange={e => update('has_volets', e.target.checked)}
                  className="rounded border-gray-300" />
                Présent
              </label>
            </div>
            {localData.has_volets && (
              <ConditionSelector label="" value={localData.etat_volets} onChange={v => update('etat_volets', v)} compact />
            )}
          </div>

          {/* Electrical */}
          <ConditionSelector label="Prises électriques" value={localData.etat_prises} onChange={v => update('etat_prises', v)} />
          <ConditionSelector label="Interrupteurs" value={localData.etat_interrupteurs} onChange={v => update('etat_interrupteurs', v)} />

          {/* Radiators */}
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-sm font-medium text-gray-700 flex-1">Radiateurs</label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={localData.has_radiateurs || false} onChange={e => update('has_radiateurs', e.target.checked)}
                  className="rounded border-gray-300" />
                Présent
              </label>
            </div>
            {localData.has_radiateurs && (
              <ConditionSelector label="" value={localData.etat_radiateurs} onChange={v => update('etat_radiateurs', v)} compact />
            )}
          </div>

          {/* Kitchen specific */}
          {isKitchen && (
            <div className="bg-[#e8f0fb] rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-[#1e3a5f] text-sm">🍳 Équipements cuisine</h3>
              {['Plaques de cuisson', 'Four', 'Hotte', 'Réfrigérateur', 'Évier', 'Robinetterie'].map(eq => (
                <ConditionSelector key={eq} label={eq} value={localData[`etat_${eq.toLowerCase().replace(/ /g, '_')}`]}
                  onChange={v => update(`etat_${eq.toLowerCase().replace(/ /g, '_')}`, v)} compact />
              ))}
            </div>
          )}

          {/* Bathroom specific */}
          {isBathroom && (
            <div className="bg-[#e8f0fb] rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-[#1e3a5f] text-sm">🚿 Équipements salle de bain</h3>
              {['Baignoire/Douche', 'Lavabo', 'Robinetterie', 'WC'].map(eq => (
                <ConditionSelector key={eq} label={eq} value={localData[`etat_sdb_${eq.toLowerCase().replace(/[\/ ]/g, '_')}`]}
                  onChange={v => update(`etat_sdb_${eq.toLowerCase().replace(/[\/ ]/g, '_')}`, v)} compact />
              ))}
            </div>
          )}

          {/* WC specific */}
          {isWC && (
            <div className="bg-[#e8f0fb] rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-[#1e3a5f] text-sm">🚽 Équipements WC</h3>
              {['Cuvette', 'Chasse d\'eau', 'Robinetterie'].map(eq => (
                <ConditionSelector key={eq} label={eq} value={localData[`etat_wc_${eq.toLowerCase().replace(/[' ]/g, '_')}`]}
                  onChange={v => update(`etat_wc_${eq.toLowerCase().replace(/[' ]/g, '_')}`, v)} compact />
              ))}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Observations</label>
            <VoiceInput
              value={localData.obs_equipements || ''}
              onChange={v => update('obs_equipements', v)}
              showNotif={showNotif}
              placeholder="Observations sur les équipements... ou utilisez le micro 🎙️"
              rows={3}
            />
          </div>
          <StepButtons step={step} onPrev={() => setStep(3)} onNext={() => saveInspection(localData, 5)} />
        </div>
      )}

      {/* Step 5: Photos */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">Photos</h2>
          <p className="text-sm text-gray-500">Prenez des photos ou importez-les. Un horodatage sera automatiquement ajouté.</p>

          <div className="flex gap-3">
            <button onClick={() => cameraInputRef.current?.click()}
              className="flex-1 bg-[#2d6ac4] text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
              📸 Prendre une photo
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-white border-2 border-[#2d6ac4] text-[#2d6ac4] py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
              🖼 Galerie
            </button>
          </div>

          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />

          {/* Photo grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {photos.map(photo => (
                <div key={photo.id} className="relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                  <img src={photo.url || photo.data} alt={photo.legende || 'Photo'} className="w-full h-32 object-cover" crossOrigin="anonymous" />
                  <button onClick={() => deletePhoto(photo.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center shadow">
                    ✕
                  </button>
                  {/* AI Badge */}
                  {photo.ai_analysis && (
                    <div className="absolute top-2 left-2">
                      {photo.ai_analysis.verified ? (
                        <span className="bg-[#27a96c] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow">✓ IA</span>
                      ) : (
                        <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow">⚠ IA</span>
                      )}
                    </div>
                  )}
                  <div className="p-2 space-y-0.5">
                    <p className="text-[10px] text-gray-400">{new Date(photo.horodatage).toLocaleString('fr-FR')}</p>
                    {photo.gps && (
                      <p className="text-[9px] text-gray-300">📍 {photo.gps.lat}, {photo.gps.lng}</p>
                    )}
                    {photo.ai_analysis?.observations && (
                      <p className="text-[9px] text-[#2d6ac4] truncate">🤖 {photo.ai_analysis.observations}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {photos.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center border border-dashed border-gray-200">
              <div className="text-4xl mb-2">📷</div>
              <p className="text-sm text-gray-400">Aucune photo pour le moment</p>
            </div>
          )}

          <StepButtons step={step} onPrev={() => setStep(4)} onNext={() => saveInspection(localData, 6)} nextLabel="✓ Terminer la pièce" />
        </div>
      )}
    </div>
  );
}

// ==================== CONDITION SELECTOR ====================
function ConditionSelector({ label, value, onChange, compact }) {
  return (
    <div className={compact ? '' : 'mb-3'}>
      {label && <label className="text-sm font-medium text-gray-700 mb-2 block">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {CONDITIONS.map(c => (
          <button key={c} onClick={() => onChange(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${value === c ? conditionColor(c) + ' border-2' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== STEP BUTTONS ====================
function StepButtons({ step, onPrev, onNext, nextLabel }) {
  return (
    <div className="flex gap-3 pt-4">
      {step > 1 && (
        <button onClick={onPrev} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">
          ← Précédent
        </button>
      )}
      <button onClick={onNext}
        className={`flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all ${step === 5 ? 'bg-[#27a96c] hover:bg-[#1f9058]' : 'bg-[#2d6ac4] hover:bg-[#2560b5]'}`}>
        {nextLabel || 'Suivant →'}
      </button>
    </div>
  );
}

// ==================== REPORT VIEW ====================
function ReportView({ edl, pieces, showNotif }) {
  const [generating, setGenerating] = useState(false);
  const [paid, setPaid] = useState(edl?.paid || false);
  const [paying, setPaying] = useState(false);
  const [signName, setSignName] = useState('');
  const [signed, setSigned] = useState(false);
  const [allPhotos, setAllPhotos] = useState({});
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('one_shot');
  const [addons, setAddons] = useState({ comparaison_ia: false, archive_securisee: false, archive_type: 'one_time' });
  const [showInvoices, setShowInvoices] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [downloadToken, setDownloadToken] = useState(edl?.download_token || null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    async function loadPhotos() {
      setLoadingPhotos(true);
      const photoMap = {};
      const cacheBuster = Date.now();
      for (const piece of (pieces || [])) {
        try {
          const data = await api(`photos?piece_id=${piece.id}&_t=${cacheBuster}`);
          photoMap[piece.id] = data;
        } catch (e) { photoMap[piece.id] = []; }
      }
      setAllPhotos(photoMap);
      setLoadingPhotos(false);
    }
    loadPhotos();
  }, [pieces]);

  // Sync paid state when edl changes (after payment)
  useEffect(() => {
    if (edl?.paid !== undefined) {
      setPaid(edl.paid);
    }
  }, [edl?.paid]);

  // Sync downloadToken when edl changes
  useEffect(() => {
    if (edl?.download_token) {
      setDownloadToken(edl.download_token);
    }
  }, [edl?.download_token]);

  useEffect(() => {
    async function loadInvoices() {
      try {
        const data = await api('invoices');
        setInvoices(data);
      } catch (e) { /* ignore */ }
    }
    loadInvoices();
  }, [paid]);

  const completedPieces = (pieces || []).filter(p => p.statut === 'completed');
  const totalPhotos = Object.values(allPhotos).reduce((acc, arr) => acc + arr.length, 0);

  // Pricing
  const plans = [
    { id: 'one_shot', name: 'À l\'acte', price: 9.90, desc: '1 état des lieux', badge: null },
    { id: 'pack_pro', name: 'Pack Pro', price: 49, desc: '10 dossiers/mois\npuis 5€/dossier', badge: 'Populaire' },
    { id: 'business', name: 'Business', price: 149, desc: 'Dossiers illimités\nSupport prioritaire', badge: 'Illimité' },
  ];
  const currentPlan = plans.find(p => p.id === selectedPlan) || plans[0];
  let addonsTotal = 0;
  if (addons.comparaison_ia) addonsTotal += 2;
  if (addons.archive_securisee) addonsTotal += addons.archive_type === 'monthly' ? 1 : 10;
  const totalPrice = currentPlan.price + addonsTotal;

  const handlePayment = async () => {
    setPaying(true);
    try {
      const origin = window.location.origin;
      const result = await api('stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan_code: selectedPlan,
          addons,
          edl_id: edl.id,
          origin_url: origin,
        }),
      });
      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error('Pas de lien de paiement reçu');
      }
    } catch (e) {
      showNotif('Erreur paiement: ' + e.message, 'error');
      setPaying(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!edl?.stripe_customer_id) {
      showNotif('Impossible d\'accéder au portail : client Stripe introuvable', 'error');
      return;
    }
    
    setOpeningPortal(true);
    try {
      const origin = window.location.origin;
      const result = await api('stripe/portal', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: edl.stripe_customer_id,
          return_url: `${origin}/?edl_id=${edl.id}`,
        }),
      });
      
      // Redirect to Stripe Customer Portal
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error('Pas de lien portail reçu');
      }
    } catch (e) {
      showNotif('Erreur portail: ' + e.message, 'error');
      setOpeningPortal(false);
    }
  };


  const generatePDF = async () => {
    setGenerating(true);
    try {
      if (!downloadToken) {
        showNotif('Veuillez d\'abord payer pour générer le PDF', 'error');
        setGenerating(false);
        return;
      }

      // Use the NEW server-side PDF generation endpoint
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      const pdfUrl = `${baseUrl}/api/pdf-fresh/${downloadToken}`;
      
      // On mobile, use location.href instead of window.open for better compatibility
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        window.location.href = pdfUrl;
      } else {
        window.open(pdfUrl, '_blank');
      }
      
      showNotif('📥 Téléchargement du PDF en cours...');
      
      setGenerating(false);
    } catch (e) {
      showNotif('Erreur génération PDF: ' + e.message, 'error');
      setGenerating(false);
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Etat des lieux - ${edl.adresse}\nType: ${edl.type_edl}\nLocataire: ${edl.nom_locataire}\nProprietaire: ${edl.nom_proprietaire}\nDate: ${new Date().toLocaleDateString('fr-FR')}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const sendEmail = async () => {
    if (!emailTo || !emailTo.includes('@')) {
      showNotif('Veuillez entrer un email valide', 'error');
      return;
    }
    if (!downloadToken) {
      showNotif('Vous devez d\'abord payer pour envoyer le rapport', 'error');
      return;
    }
    setSendingEmail(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      const downloadLink = `${baseUrl}/api/pdf-fresh/${downloadToken}`;

      emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '');
      const templateParams = {
        to_email: emailTo,
        from_name: 'État des Lieux Pro',
        subject: `Rapport d'état des lieux - ${edl?.adresse || 'Rapport'}`,
        message: [
          `Bonjour,`,
          ``,
          `Votre rapport d'état des lieux est prêt.`,
          ``,
          `Adresse : ${edl?.adresse || ''}`,
          `Type : ${edl?.type_logement || ''} — ${edl?.type_edl || ''}`,
          `Locataire : ${edl?.nom_locataire || ''}`,
          `Propriétaire : ${edl?.nom_proprietaire || ''}`,
          `Date : ${new Date().toLocaleDateString('fr-FR')}`,
          `Pièces inspectées : ${completedPieces.length}`,
          `Photos : ${totalPhotos}`,
          ``,
          `Téléchargez votre rapport PDF ici :`,
          downloadLink,
          ``,
          `Cordialement,`,
          `État des Lieux Pro`,
        ].join('\n'),
        to_name: edl?.nom_locataire || 'Destinataire',
        reply_to: emailTo,
        download_link: downloadLink,
      };
      
      console.log('📧 Sending email to:', emailTo);
      
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '',
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '',
        templateParams
      );
      showNotif('✅ Email envoyé avec succès !');
      setShowEmailModal(false);
      setEmailTo('');
    } catch (e) {
      console.error('❌ EmailJS error:', e);
      showNotif('Erreur envoi email: ' + (e?.text || e?.message || 'Vérifiez votre connexion'), 'error');
    }
    setSendingEmail(false);
  };

  // Invoices view
  if (showInvoices) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1e3a5f]">🧾 Mes Factures</h2>
          <button onClick={() => setShowInvoices(false)} className="text-sm text-[#2d6ac4] font-medium">← Retour</button>
        </div>
        {invoices.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="text-4xl mb-3">🧾</div>
            <p className="text-gray-400 text-sm">Aucune facture pour le moment</p>
          </div>
        ) : (
          invoices.map(inv => (
            <div key={inv.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#1e3a5f] text-sm">{inv.plan}</span>
                <span className="bg-[#e6f7ef] text-[#27a96c] text-xs font-bold px-2 py-1 rounded-full">{inv.total?.toFixed(2)}€</span>
              </div>
              <p className="text-xs text-gray-500">{new Date(inv.created_at).toLocaleDateString('fr-FR')} • {inv.payment_id}</p>
              {inv.addons?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {inv.addons.map((a, i) => (
                    <span key={i} className="text-[10px] bg-[#e8f0fb] text-[#2d6ac4] px-2 py-0.5 rounded-full">{a}</span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">📋 Récapitulatif</h2>
          <button onClick={() => setShowInvoices(true)} className="text-xs text-[#2d6ac4] font-medium border border-[#2d6ac4] px-3 py-1 rounded-full">🧾 Factures</button>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Adresse</span>
            <span className="font-medium text-[#1e3a5f] text-right max-w-[200px] truncate">{edl?.adresse}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Type</span>
            <span className="font-medium">{edl?.type_logement} — {edl?.type_edl}</span>
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
            <span className="text-gray-500">Pièces inspectées</span>
            <span className="font-bold text-[#27a96c]">{completedPieces.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Photos prises</span>
            <span className="font-bold text-[#2d6ac4]">{loadingPhotos ? '...' : totalPhotos}</span>
          </div>
        </div>
      </div>

      {/* Blurred PDF Preview */}
      {!paid && (
        <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <div className="p-5 filter blur-[6px] select-none pointer-events-none">
            <div className="bg-[#1e3a5f] text-white p-4 rounded-xl mb-3 text-center">
              <div className="font-bold text-lg">État des Lieux</div>
              <div className="text-sm opacity-80">{edl?.adresse}</div>
            </div>
            {completedPieces.slice(0, 3).map(p => (
              <div key={p.id} className="border-b border-gray-100 py-2">
                <div className="font-medium text-sm">{p.icon} {p.nom}</div>
                <div className="text-xs text-gray-400">État : {p.donnees_json?.etat_general || 'Bon'}</div>
              </div>
            ))}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-gray-200 h-16 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
            <div className="text-4xl mb-2">🔒</div>
            <p className="font-bold text-[#1e3a5f] text-sm">Rapport verrouillé</p>
            <p className="text-xs text-gray-500">Choisissez une offre pour débloquer</p>
          </div>
        </div>
      )}

      {/* Pricing */}
      {!paid && (
        <div className="space-y-3">
          <h3 className="font-bold text-[#1e3a5f] text-sm">💳 Choisissez votre offre</h3>
          <div className="space-y-3">
            {plans.map(plan => (
              <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all relative ${
                  selectedPlan === plan.id
                    ? 'border-[#2d6ac4] bg-[#e8f0fb] shadow-md'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}>
                {plan.badge && (
                  <span className="absolute -top-2 right-4 bg-[#2d6ac4] text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#1e3a5f]">{plan.name}</div>
                    <div className="text-xs text-gray-500 whitespace-pre-line mt-0.5">{plan.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#2d6ac4]">{plan.price.toFixed(2)}€</div>
                    <div className="text-[10px] text-gray-400">{plan.id === 'one_shot' ? '/dossier' : '/mois'}</div>
                  </div>
                </div>
                {selectedPlan === plan.id && (
                  <div className="absolute top-4 left-4 w-5 h-5 bg-[#2d6ac4] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add-ons */}
      {!paid && (
        <div className="space-y-3">
          <h3 className="font-bold text-[#1e3a5f] text-sm">✨ Options supplémentaires</h3>

          {/* Comparaison IA */}
          <div className={`p-4 rounded-2xl border-2 transition-all ${addons.comparaison_ia ? 'border-[#27a96c] bg-[#e6f7ef]' : 'border-gray-100 bg-white'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={addons.comparaison_ia}
                onChange={e => setAddons({...addons, comparaison_ia: e.target.checked})}
                className="w-5 h-5 mt-0.5 rounded border-gray-300 text-[#27a96c]" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1e3a5f] text-sm">🤖 Comparaison IA</span>
                  <span className="font-bold text-[#27a96c]">+2,00€</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Compare les photos d'entrée et de sortie pour lister les différences automatiquement</p>
              </div>
            </label>
          </div>

          {/* Archive Sécurisée */}
          <div className={`p-4 rounded-2xl border-2 transition-all ${addons.archive_securisee ? 'border-[#27a96c] bg-[#e6f7ef]' : 'border-gray-100 bg-white'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={addons.archive_securisee}
                onChange={e => setAddons({...addons, archive_securisee: e.target.checked})}
                className="w-5 h-5 mt-0.5 rounded border-gray-300 text-[#27a96c]" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1e3a5f] text-sm">🔐 Archive 10 ans</span>
                  <span className="font-bold text-[#27a96c]">{addons.archive_type === 'monthly' ? '+1€/mois' : '+10€'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Stockage sécurisé des photos HD pendant 10 ans (durée légale)</p>
                {addons.archive_securisee && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setAddons({...addons, archive_type: 'one_time'})}
                      className={`text-xs px-3 py-1 rounded-full font-medium ${addons.archive_type === 'one_time' ? 'bg-[#27a96c] text-white' : 'bg-gray-100 text-gray-600'}`}>
                      10€ une fois
                    </button>
                    <button onClick={() => setAddons({...addons, archive_type: 'monthly'})}
                      className={`text-xs px-3 py-1 rounded-full font-medium ${addons.archive_type === 'monthly' ? 'bg-[#27a96c] text-white' : 'bg-gray-100 text-gray-600'}`}>
                      1€/mois
                    </button>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Total & Payment */}
      {!paid && (
        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d6ac4] rounded-2xl p-5 text-white">
          <div className="flex justify-between items-center mb-3">
            <span className="text-white/80 text-sm">{currentPlan.name}</span>
            <span className="text-sm">{currentPlan.price.toFixed(2)}€</span>
          </div>
          {addonsTotal > 0 && (
            <div className="flex justify-between items-center mb-3 text-sm">
              <span className="text-white/80">Options</span>
              <span>+{addonsTotal.toFixed(2)}€</span>
            </div>
          )}
          <div className="border-t border-white/20 pt-3 mb-4 flex justify-between items-center">
            <span className="font-bold text-lg">Total</span>
            <span className="font-bold text-2xl">{totalPrice.toFixed(2)}€</span>
          </div>
          <button onClick={handlePayment} disabled={paying}
            className="w-full bg-white text-[#1e3a5f] font-bold py-3.5 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-all text-sm mb-3">
            {paying ? '⏳ Redirection vers Stripe...' : `💳 Payer ${totalPrice.toFixed(2)}€`}
          </button>
          
          {/* Code Promo */}
          <button onClick={async () => {
            const promo = prompt('Entrez votre code promo :');
            if (!promo) return;
            try {
              const result = await api('admin/unlock', {
                method: 'POST',
                body: JSON.stringify({
                  edl_id: edl.id,
                  promo_code: promo.trim(),
                }),
              });
              if (result.success) {
                showNotif('🎉 Code promo validé ! Rapport débloqué gratuitement !');
                const cacheBuster = Date.now();
                const freshEdl = await api(`edl/${edl.id}?_t=${cacheBuster}`);
                setCurrentEdl({...freshEdl, _refreshKey: cacheBuster});
                fetchEdls();
              } else {
                showNotif('Code promo invalide', 'error');
              }
            } catch (e) {
              showNotif('Code promo invalide', 'error');
            }
          }}
            className="w-full bg-white/10 text-white border border-white/30 font-medium py-2.5 rounded-xl hover:bg-white/20 transition-all text-xs">
            🎁 J'ai un code promo
          </button>
          
          <p className="text-[10px] text-white/50 text-center mt-2">Paiement sécurisé par Stripe</p>
        </div>
      )}

      {/* After payment */}
      {paid && (
        <>
          {/* Subscription Management - Only for subscription plans */}
          {edl?.plan && (edl.plan === 'pack_pro' || edl.plan === 'business') && edl?.stripe_customer_id && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-purple-900 text-sm">🔄 Abonnement actif</h3>
                  <p className="text-xs text-purple-700 mt-1">
                    {edl.plan === 'pack_pro' ? 'Pack Pro' : 'Business'} - 
                    {edl?.subscription_status === 'canceled' ? ' Annulé' : ' Actif'}
                  </p>
                </div>
                <button onClick={handleManageSubscription} disabled={openingPortal}
                  className="bg-purple-600 text-white px-4 py-2.5 rounded-xl font-medium text-xs hover:bg-purple-700 disabled:opacity-50 transition-all shadow-sm">
                  {openingPortal ? '⏳ Ouverture...' : '⚙️ Gérer'}
                </button>
              </div>
              <p className="text-[10px] text-purple-600 mt-2">
                💡 Vous pouvez annuler votre abonnement, modifier votre moyen de paiement ou télécharger vos factures
              </p>
            </div>
          )}

          {/* Signature */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-[#1e3a5f] mb-3">✍️ Signature électronique</h3>
            <div className="flex items-center gap-3 mb-3">
              <input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-[#2d6ac4]" />
              <span className="text-sm text-gray-600">Je confirme l'exactitude des informations</span>
            </div>
            {signed && (
              <input type="text" value={signName} onChange={e => setSignName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2d6ac4] outline-none"
                placeholder="Votre nom complet" />
            )}
          </div>

          {/* Download & Share */}
          <div className="space-y-3">
            <button onClick={generatePDF} disabled={generating}
              className="w-full bg-[#27a96c] text-white font-bold py-4 rounded-2xl hover:bg-[#1f9058] disabled:opacity-50 shadow-lg shadow-green-200 transition-all text-sm">
              {generating ? '⏳ Génération en cours...' : '📥 Télécharger le PDF'}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowEmailModal(true)}
                className="bg-white border border-gray-200 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 text-sm transition-all">
                📧 Email
              </button>
              <button onClick={shareWhatsApp}
                className="bg-[#25d366] text-white font-medium py-3 rounded-xl hover:bg-[#1fb855] text-sm transition-all">
                💬 WhatsApp
              </button>
            </div>
          </div>

          {/* Email Modal */}
          {showEmailModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowEmailModal(false)}>
              <div className="bg-white w-full max-w-[480px] rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-[#1e3a5f] text-lg">📧 Envoyer par email</h3>
                <p className="text-sm text-gray-500">Le rapport sera envoyé à l'adresse indiquée</p>
                <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2d6ac4] outline-none"
                  placeholder="exemple@email.com" />
                <div className="flex gap-3">
                  <button onClick={() => setShowEmailModal(false)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm">
                    Annuler
                  </button>
                  <button onClick={sendEmail} disabled={sendingEmail}
                    className="flex-1 py-3 rounded-xl bg-[#2d6ac4] text-white font-semibold text-sm disabled:opacity-50">
                    {sendingEmail ? '⏳ Envoi...' : '📤 Envoyer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ==================== VOICE INPUT COMPONENT ====================
function VoiceInput({ value, onChange, placeholder, rows, showNotif: showNotifProp }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [localNotif, setLocalNotif] = useState(null);
  const showNotif = showNotifProp || ((msg, type) => {
    setLocalNotif({ msg, type });
    setTimeout(() => setLocalNotif(null), 3000);
  });
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotif('Microphone non supporté sur cet appareil', 'error');
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Check if MediaRecorder is supported and get compatible mime type
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = ''; // Use default
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setProcessing(true);
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const result = await api('ai/transcribe', {
              method: 'POST',
              body: JSON.stringify({ audio_base64: reader.result, language: 'fr' }),
            });
            const newText = value ? value + ' ' + result.cleaned_text : result.cleaned_text;
            onChange(newText);
            showNotif('✅ Transcription réussie !');
          } catch (e) {
            console.error('Transcription error:', e);
            showNotif('❌ Erreur transcription : ' + (e.message || 'Réessayez'), 'error');
          }
          setProcessing(false);
        };
        reader.readAsDataURL(blob);
        streamRef.current?.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      showNotif('🎤 Enregistrement en cours...');
    } catch (e) {
      console.error('Microphone error:', e);
      if (e.name === 'NotAllowedError') {
        showNotif('Accès au microphone refusé. Autorisez l\'accès dans les paramètres de votre navigateur.', 'error');
      } else if (e.name === 'NotFoundError') {
        showNotif('Aucun microphone trouvé sur cet appareil', 'error');
      } else {
        showNotif('Erreur microphone: ' + e.message, 'error');
      }
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="relative">
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-14 text-sm focus:ring-2 focus:ring-[#2d6ac4] outline-none resize-none"
        placeholder={placeholder}
        rows={rows || 3}
      />
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={processing}
        className={`absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
          recording
            ? 'bg-red-500 text-white animate-pulse'
            : processing
            ? 'bg-yellow-400 text-white'
            : 'bg-[#2d6ac4] text-white hover:bg-[#2560b5]'
        }`}
        title={recording ? 'Arrêter' : processing ? 'Transcription...' : 'Dictée vocale'}
      >
        {processing ? (
          <span className="text-xs">⏳</span>
        ) : recording ? (
          <span className="text-sm">⏹</span>
        ) : (
          <span className="text-sm">🎙️</span>
        )}
      </button>
      {recording && (
        <div className="absolute -top-6 right-0 text-xs text-red-500 font-medium animate-pulse">
          ● Enregistrement...
        </div>
      )}
      {processing && (
        <div className="absolute -top-6 right-0 text-xs text-yellow-600 font-medium">
          🤖 Transcription IA...
        </div>
      )}
    </div>
  );
}

// ==================== BATCH UPLOADER COMPONENT ====================
function BatchUploader({ edlId, pieces, onComplete, showNotif }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef(null);

  const processAndUpload = async (files) => {
    setUploading(true);
    setProgress({ current: 0, total: files.length });
    setResults([]);

    const photosToAnalyze = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Process image: resize + timestamp
      const base64Full = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxWidth = 1200;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Timestamp
            const now = new Date();
            const ts = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR');
            const fontSize = Math.max(14, canvas.width * 0.03);
            ctx.font = `bold ${fontSize}px Arial`;
            const tw = ctx.measureText(ts).width;
            const pad = 8;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(canvas.width - tw - pad * 3, canvas.height - fontSize - pad * 3, tw + pad * 2, fontSize + pad * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(ts, canvas.width - tw - pad * 2, canvas.height - pad * 2);

            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });

      // Compress for AI
      const base64AI = await compressForAI(base64Full, 512);

      // Get GPS
      const gps = await getGPS();

      photosToAnalyze.push({
        data: base64Full,
        data_ai: base64AI,
        horodatage: new Date().toISOString(),
        gps,
      });

      setProgress({ current: i + 1, total: files.length });
    }

    // Send batch to AI for analysis
    showNotif(`🤖 Analyse IA de ${photosToAnalyze.length} photos...`);

    try {
      // Send compressed versions to AI
      const aiPayload = photosToAnalyze.map(p => ({
        data: p.data_ai,
        horodatage: p.horodatage,
        gps: p.gps,
      }));

      const response = await api('ai/batch-analyze', {
        method: 'POST',
        body: JSON.stringify({ photos: aiPayload, edl_id: edlId }),
      });

      // Now save the full-quality photos with AI analysis
      // The batch-analyze endpoint already saves photos with AI data
      // But we need to update with full-quality data
      // Actually the batch endpoint saves with the compressed data, let me update each with full data
      if (response.results) {
        for (let i = 0; i < response.results.length; i++) {
          if (response.results[i].id && photosToAnalyze[i]) {
            // Update photo with full quality data and GPS
            try {
              const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
              await fetch(`/api/photos/${response.results[i].id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token && { 'Authorization': `Bearer ${token}` }),
                },
                body: JSON.stringify({
                  data: photosToAnalyze[i].data,
                  gps: photosToAnalyze[i].gps,
                }),
              });
            } catch (e) { /* ignore update errors */ }
          }
        }
      }

      setResults(response.results || []);
      setShowResults(true);
      showNotif(`✅ ${response.results?.length || 0} photos classées par l'IA !`);
    } catch (e) {
      console.error('Batch analyze error:', e);
      showNotif('Erreur analyse IA: ' + e.message, 'error');
    }

    setUploading(false);
    if (onComplete) onComplete();
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processAndUpload(files);
    e.target.value = '';
  };

  const groupedResults = results.reduce((acc, r) => {
    const key = r.piece_nom || 'Non classée';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />

      {!showResults && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full bg-gradient-to-r from-[#2d6ac4] to-[#1e3a5f] text-white font-semibold py-4 rounded-2xl hover:opacity-90 disabled:opacity-50 shadow-lg transition-all text-sm mb-4"
        >
          {uploading ? (
            <span>🤖 Analyse IA... {progress.current}/{progress.total} photos</span>
          ) : (
            <span>🤖 Upload lot de photos (Tri IA automatique)</span>
          )}
        </button>
      )}

      {uploading && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Traitement des photos...</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full bg-[#2d6ac4] transition-all"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {showResults && Object.keys(groupedResults).length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#1e3a5f] text-sm">🤖 Résultats du tri IA</h3>
            <button onClick={() => setShowResults(false)} className="text-xs text-gray-400">Fermer</button>
          </div>
          {Object.entries(groupedResults).map(([room, photos]) => (
            <div key={room} className="bg-[#e8f0fb] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[#1e3a5f] text-sm">{room}</span>
                <span className="text-xs text-[#2d6ac4]">{photos.length} photo{photos.length > 1 ? 's' : ''}</span>
              </div>
              {photos.map((p, i) => (
                <div key={i} className="text-xs text-gray-600 flex items-center gap-2 mt-1">
                  {p.verified ? (
                    <span className="bg-[#e6f7ef] text-[#27a96c] px-2 py-0.5 rounded-full font-medium">✓ Vérifié IA</span>
                  ) : (
                    <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ Défauts</span>
                  )}
                  <span className="truncate">{p.observations || 'RAS'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
