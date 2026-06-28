import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import api, { Lead } from '../lib/api';

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (intentFilter) params.append('intent', intentFilter);
    api.get(`/api/leads?${params.toString()}`).then(res => setLeads(res.data.leads));
  }, [statusFilter, intentFilter]);

  const filteredLeads = leads.filter(lead =>
    !search || 
    lead.name?.toLowerCase().includes(search.toLowerCase()) ||
    lead.whatsapp_number.includes(search)
  );

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-blue-500';
    return 'bg-gray-300';
  };

  const statusOptions = ['new', 'qualifying', 'qualified', 'hot', 'in_progress', 'converted', 'lost'];
  const intentOptions = ['buy', 'sell', 'rent', 'invest'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <span className="text-sm text-gray-500">{filteredLeads.length} leads</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">All Statuses</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={intentFilter} onChange={(e) => setIntentFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">All Intents</option>
          {intentOptions.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lead</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Intent</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Budget</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Area</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Last Message</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredLeads.map(lead => (
              <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-semibold text-emerald-700 text-xs shrink-0">
                      {(lead.name || lead.whatsapp_number)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{lead.name || 'Unknown'}</div>
                      <div className="text-gray-400 text-xs">{lead.whatsapp_number}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell capitalize text-gray-600">{lead.intent || '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                  {lead.budget_max ? `AED ${(lead.budget_max/1000000).toFixed(1)}M` : '—'}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-600 max-w-32 truncate">
                  {lead.preferred_areas?.join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${getScoreBg(lead.score)}`}></div>
                    <span className="font-semibold text-gray-700">{lead.score}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    lead.status === 'hot' ? 'bg-red-100 text-red-700' :
                    lead.status === 'converting' ? 'bg-green-100 text-green-700' :
                    lead.status === 'qualifying' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{lead.status}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">
                  {lead.last_message_at ? format(new Date(lead.last_message_at), 'MMM d, h:mm a') : '—'}
                </td>
                <td className="px-4 py-3">
                  <MessageSquare className="w-4 h-4 text-gray-300 hover:text-emerald-500 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredLeads.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📱</div>
            <p>No leads yet. Share your WhatsApp number to start!</p>
          </div>
        )}
      </div>
    </div>
  );
}
