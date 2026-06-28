import { useEffect, useState } from 'react';
import { Users, Flame, TrendingUp, Star, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import api, { Analytics, Lead } from '../lib/api';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [hotLeads, setHotLeads] = useState<Lead[]>([]);
  const [leadsOverTime, setLeadsOverTime] = useState<{date: string; count: number}[]>([]);
  const [leadsByIntent, setLeadsByIntent] = useState<{intent: string; count: number}[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const [analyticsRes, hotLeadsRes, timeRes, intentRes] = await Promise.all([
        api.get('/api/analytics/overview'),
        api.get('/api/leads?status=hot&limit=5'),
        api.get('/api/analytics/leads-over-time'),
        api.get('/api/analytics/leads-by-intent'),
      ]);
      setAnalytics(analyticsRes.data);
      setHotLeads(hotLeadsRes.data.leads);
      setLeadsOverTime(timeRes.data.map((d: {date: string; count: string}) => ({
        date: format(new Date(d.date), 'MMM d'),
        count: parseInt(d.count),
      })));
      setLeadsByIntent(intentRes.data);
    };
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: 'Total Leads', value: analytics?.totalLeads || 0, icon: Users, color: 'bg-blue-500', change: `+${analytics?.todayLeads || 0} today` },
    { label: 'Hot Leads 🔥', value: analytics?.hotLeads || 0, icon: Flame, color: 'bg-red-500', change: 'Score 80+' },
    { label: 'Avg Lead Score', value: `${analytics?.avgScore || 0}/100`, icon: Star, color: 'bg-amber-500', change: 'AI qualified' },
    { label: 'Conversion Rate', value: `${analytics?.conversionRate || 0}%`, icon: TrendingUp, color: 'bg-emerald-500', change: 'All time' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-50';
    if (score >= 60) return 'text-amber-600 bg-amber-50';
    return 'text-blue-600 bg-blue-50';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      hot: 'bg-red-100 text-red-700',
      qualifying: 'bg-blue-100 text-blue-700',
      new: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-green-100 text-green-700',
      converted: 'bg-emerald-100 text-emerald-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Real-time lead intelligence</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className={`${stat.color} p-2 rounded-lg`}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-400">{stat.change}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads Over Time */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Leads (30 days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={leadsOverTime}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Intent Breakdown */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">By Intent</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={leadsByIntent} dataKey="count" nameKey="intent" cx="50%" cy="50%" outerRadius={70} label={({ intent, percent }) => `${intent} ${(percent * 100).toFixed(0)}%`}>
                {leadsByIntent.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hot Leads */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">🔥 Hot Leads</h2>
          <button onClick={() => navigate('/leads')} className="text-emerald-600 text-sm flex items-center gap-1 hover:gap-2 transition-all">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {hotLeads.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">📭</div>
              <p>No hot leads yet. Your AI is warming them up!</p>
            </div>
          ) : hotLeads.map((lead) => (
            <div key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-semibold text-emerald-700">
                {(lead.name || lead.whatsapp_number)?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{lead.name || lead.whatsapp_number}</div>
                <div className="text-sm text-gray-500">
                  {lead.intent} • {lead.preferred_areas?.join(', ') || 'Area TBC'}
                  {lead.budget_max && ` • AED ${(lead.budget_max/1000000).toFixed(1)}M`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getScoreColor(lead.score)}`}>{lead.score}</span>
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusBadge(lead.status)}`}>{lead.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
