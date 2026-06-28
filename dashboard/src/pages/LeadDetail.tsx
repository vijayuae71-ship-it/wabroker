import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PhoneCall, User2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import api, { Lead, Message } from '../lib/api';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/api/leads?limit=1`).then(res => {
      const found = res.data.leads.find((l: Lead) => l.id === id);
      if (found) setLead(found);
    });
    api.get(`/api/leads/${id}/messages`).then(res => setMessages(res.data.messages));
    
    const interval = setInterval(() => {
      api.get(`/api/leads/${id}/messages`).then(res => setMessages(res.data.messages));
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTakeover = async () => {
    if (!id) return;
    await api.post(`/api/leads/${id}/takeover`);
    alert('You have taken over this conversation. Reply directly on WhatsApp.');
  };

  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return 'Not specified';
    const fmt = (n: number) => n >= 1000000 ? `AED ${(n/1000000).toFixed(1)}M` : `AED ${(n/1000).toFixed(0)}K`;
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    if (max) return `Up to ${fmt(max)}`;
    return `From ${fmt(min!)}`;
  };

  if (!lead) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  );

  return (
    <div className="space-y-4 max-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/leads')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700">
          {(lead.name || lead.whatsapp_number)?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{lead.name || lead.whatsapp_number}</h1>
          <p className="text-sm text-gray-500">{lead.whatsapp_number} • Score: {lead.score}/100</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={handleTakeover} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors">
            <PhoneCall className="w-4 h-4" /> Take Over
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Lead Info */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4 h-fit">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><User2 className="w-4 h-4" /> Lead Profile</h2>
          {[
            { label: 'Intent', value: lead.intent || '—', capitalize: true },
            { label: 'Budget', value: formatBudget(lead.budget_min, lead.budget_max) },
            { label: 'Areas', value: lead.preferred_areas?.join(', ') || '—' },
            { label: 'Property', value: lead.property_type || '—', capitalize: true },
            { label: 'Bedrooms', value: lead.bedrooms || '—' },
            { label: 'Nationality', value: lead.nationality || '—' },
            { label: 'Language', value: lead.language?.toUpperCase() || '—' },
            { label: 'Assigned To', value: lead.assigned_agent_name || 'AI' },
            { label: 'Messages', value: String(lead.message_count || 0) },
          ].map(item => (
            <div key={item.label} className="flex justify-between text-sm">
              <span className="text-gray-500">{item.label}</span>
              <span className={`font-medium text-gray-800 ${item.capitalize ? 'capitalize' : ''}`}>{item.value}</span>
            </div>
          ))}
          
          {/* Score Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Lead Score</span>
              <span className="font-bold text-gray-800">{lead.score}/100</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${lead.score >= 80 ? 'bg-red-500' : lead.score >= 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${lead.score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Conversation */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Conversation</h2>
            <span className="text-xs text-gray-400 ml-auto">{messages.length} messages</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No messages yet</div>
            ) : messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                  msg.direction === 'inbound'
                    ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    : msg.sender_type === 'ai'
                    ? 'bg-emerald-600 text-white rounded-tr-sm'
                    : 'bg-blue-600 text-white rounded-tr-sm'
                }`}>
                  {msg.media_transcription && (
                    <div className="text-xs opacity-70 mb-1 italic">🎙️ Voice note transcribed</div>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className={`text-xs mt-1 ${msg.direction === 'inbound' ? 'text-gray-400' : 'opacity-70'} flex items-center gap-1`}>
                    {format(new Date(msg.created_at), 'h:mm a')}
                    {msg.direction === 'outbound' && (
                      <span className="ml-1">{msg.sender_type === 'ai' ? '🤖' : '👤'}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
