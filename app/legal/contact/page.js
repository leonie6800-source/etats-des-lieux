'use client';
import { useState } from 'react';

export default function Contact() {
  const [form, setForm] = useState({ nom: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nom || !form.email || !form.message) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Erreur envoi');
      setSent(true);
    } catch (e) {
      setError('Erreur lors de l\'envoi. Réessayez ou contactez-nous directement.');
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-[#1e3a5f] mb-2">Contactez-nous</h1>
        <p className="text-gray-500 mb-6">Une question ? Un problème avec votre rapport ? Nous répondons sous 24h.</p>
        <p className="text-sm text-gray-600 mb-8">Email direct : <a href="mailto:contact@edlpro.app" className="text-[#2d6ac4] hover:underline">contact@edlpro.app</a></p>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="font-semibold text-green-800">Message envoyé !</p>
            <p className="text-sm text-green-600 mt-1">Nous vous répondrons sous 24h.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nom *</label>
              <input type="text" required value={form.nom} onChange={e => setForm({...form, nom: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#2d6ac4]"
                placeholder="Votre nom" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
              <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#2d6ac4]"
                placeholder="votre@email.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Message *</label>
              <textarea required rows={5} value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#2d6ac4] resize-none"
                placeholder="Votre message..." />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={sending}
              className="w-full bg-[#2d6ac4] text-white font-semibold py-3 rounded-xl hover:bg-[#2560b5] disabled:opacity-50 transition-all">
              {sending ? '⏳ Envoi...' : '📤 Envoyer'}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <a href="/" className="text-[#2d6ac4] hover:underline font-medium text-sm">← Retour à l'accueil</a>
        </div>
      </div>
    </div>
  );
}
