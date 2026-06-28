import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wabroker_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wabroker_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export interface Lead {
  id: string;
  name: string;
  whatsapp_number: string;
  intent: string;
  budget_min: number;
  budget_max: number;
  preferred_areas: string[];
  property_type: string;
  bedrooms: string;
  score: number;
  status: string;
  language: string;
  nationality: string;
  assigned_agent_name: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'lead' | 'ai' | 'agent';
  message_type: string;
  content: string;
  media_transcription: string;
  created_at: string;
}

export interface Analytics {
  totalLeads: number;
  hotLeads: number;
  todayLeads: number;
  avgScore: number;
  conversionRate: string;
}
