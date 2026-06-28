import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Bell, LogOut, Building2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function Layout() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(0);
  const agent = JSON.parse(localStorage.getItem('wabroker_agent') || '{}');

  useEffect(() => {
    api.get('/api/analytics/notifications').then(res => {
      setNotifications(res.data.length);
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('wabroker_token');
    localStorage.removeItem('wabroker_agent');
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/leads', icon: Users, label: 'Leads' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-400" />
            <span className="font-bold text-white text-lg">WABroker</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">Dubai RE AI</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
              {agent.name?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{agent.name}</div>
              <div className="text-slate-400 text-xs capitalize">{agent.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white text-sm rounded-lg hover:bg-slate-800 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
