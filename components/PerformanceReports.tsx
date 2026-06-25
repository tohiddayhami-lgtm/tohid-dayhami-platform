
import React, { useState, useEffect } from 'react';
import { Personnel, Ticket, Task, SystemLog, TicketStatus } from '../types';
import { IconAward, IconBarChart2, IconStopwatch, IconActivity, IconCheckSquare } from './Icons';
import { fetchAnalyticsData } from '../services/firebaseService';
import { Language } from '../App';

interface Props {
  personnel: Personnel[];
  tickets: Ticket[];
  tasks: Task[];
  lang: Language;
}

export const PerformanceReports: React.FC<Props> = ({ personnel, tickets, tasks, lang }) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  const t = {
      fa: {
          loading: 'در حال آنالیز داده‌ها...',
          top: 'کارمند نمونه',
          score: 'امتیاز',
          activity: 'میانگین فعالیت کل',
          actions: 'تعداد کل عملیات',
          completionRate: 'نرخ تکمیل تیکت‌ها',
          tableTitle: 'جدول ارزیابی عملکرد پرسنل',
          staff: 'پرسنل',
          perfScore: 'امتیاز عملکرد',
          completed: 'تیکت‌های تکمیل شده',
          inProgress: 'در دست اقدام',
          responseTime: 'زمان پاسخگویی (ساعت)',
          logActivity: 'فعالیت (لاگ)'
      },
      en: {
          loading: 'Analyzing data...',
          top: 'Top Performer',
          score: 'Score',
          activity: 'Total Activity',
          actions: 'Total Actions',
          completionRate: 'Ticket Completion Rate',
          tableTitle: 'Performance Evaluation Table',
          staff: 'Staff',
          perfScore: 'Performance Score',
          completed: 'Completed Tickets',
          inProgress: 'In Progress',
          responseTime: 'Response Time (hrs)',
          logActivity: 'Activity (Logs)'
      }
  }[lang];

  useEffect(() => {
    const loadData = async () => {
        const data = await fetchAnalyticsData();
        setLogs(data);
        setLoading(false);
    };
    loadData();
  }, []);

  const calculateMetrics = (person: Personnel) => {
      const assignedTickets = tickets.filter(t => t.assignedTo === person.id || t.projectData?.teamMemberIds?.includes(person.id));
      const completedTickets = assignedTickets.filter(t => t.status === TicketStatus.COMPLETED).length;
      const inProgressTickets = assignedTickets.filter(t => t.status === TicketStatus.IN_PROGRESS || t.status === TicketStatus.PROCESSING).length;
      
      let totalResponseTime = 0;
      let responseCount = 0;

      assignedTickets.forEach(t => {
          const assignmentEntry = t.timeline.find(e => e.type === 'assignment' && (e.description?.includes(person.fullName) || t.assignedTo === person.id));
          if (assignmentEntry) {
              const actionEntry = t.timeline.find(e => e.actorName === person.fullName && new Date(e.timestamp) > new Date(assignmentEntry.timestamp));
              if (actionEntry) {
                  const diff = new Date(actionEntry.timestamp).getTime() - new Date(assignmentEntry.timestamp).getTime();
                  totalResponseTime += diff;
                  responseCount++;
              }
          }
      });
      const avgResponseTimeHours = responseCount > 0 ? (totalResponseTime / responseCount / (1000 * 60 * 60)).toFixed(1) : 'N/A';

      const userLogs = logs.filter(l => l.actorName === person.fullName || l.actorName === person.username);
      const loginCount = userLogs.filter(l => l.actionType === 'LOGIN').length;
      const totalActions = userLogs.length;

      let score = 50 + (completedTickets * 2) + (inProgressTickets * 1) + (totalActions * 0.1);
      if (score > 100) score = 100;

      let grade = 'C';
      if (score >= 90) grade = 'A+';
      else if (score >= 80) grade = 'A';
      else if (score >= 65) grade = 'B';

      return { completedTickets, inProgressTickets, avgResponseTimeHours, loginCount, totalActions, score: Math.round(score), grade };
  };

  const personnelMetrics = personnel.map(p => ({ ...p, metrics: calculateMetrics(p) })).sort((a, b) => b.metrics.score - a.metrics.score);
  const topPerformer = personnelMetrics[0];

  if (loading) return <div className="p-8 text-center text-gray-500">{t.loading}</div>;

  return (
    <div className="space-y-8 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"><div className="relative z-10"><div className="flex items-center gap-2 mb-2 opacity-90"><IconAward className="w-6 h-6" /> {t.top}</div><h3 className="text-2xl font-black">{topPerformer?.fullName}</h3><p className="opacity-80 text-sm mt-1">{topPerformer?.roles.join(', ')}</p><div className="mt-4 inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-sm font-bold border border-white/30">{t.score}: {topPerformer?.metrics.score} ({topPerformer?.metrics.grade})</div></div><IconAward className="absolute -right-6 -bottom-6 w-32 h-32 text-white opacity-10" /></div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between"><div className="flex items-center gap-2 text-gray-500 mb-2 font-bold"><IconActivity className="w-5 h-5 text-blue-500" /> {t.activity}</div><div className="text-3xl font-black text-gray-800">{logs.length}</div><div className="text-xs text-gray-400 mt-2">{t.actions}</div></div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between"><div className="flex items-center gap-2 text-gray-500 mb-2 font-bold"><IconCheckSquare className="w-5 h-5 text-green-500" /> {t.completionRate}</div><div className="text-3xl font-black text-gray-800">{tickets.filter(t => t.status === TicketStatus.COMPLETED).length} / {tickets.length}</div><div className="w-full bg-gray-100 rounded-full h-2 mt-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${(tickets.filter(t => t.status === TicketStatus.COMPLETED).length / tickets.length) * 100}%` }}></div></div></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"><div className="p-6 border-b border-gray-100 bg-gray-50"><h3 className="font-bold text-gray-800 flex items-center gap-2"><IconBarChart2 className="w-5 h-5 text-gray-600" />{t.tableTitle}</h3></div><div className="overflow-x-auto"><table className="w-full text-start"><thead className="bg-gray-100 text-gray-600 text-sm"><tr><th className="px-6 py-4">{t.staff}</th><th className="px-6 py-4 text-center">{t.perfScore}</th><th className="px-6 py-4 text-center">{t.completed}</th><th className="px-6 py-4 text-center">{t.inProgress}</th><th className="px-6 py-4 text-center">{t.responseTime}</th><th className="px-6 py-4 text-center">{t.logActivity}</th></tr></thead><tbody className="divide-y divide-gray-100">{personnelMetrics.map((p) => (<tr key={p.id} className="hover:bg-gray-50"><td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 overflow-hidden">{p.avatar ? <img src={p.avatar} className="w-full h-full object-cover" /> : p.fullName.charAt(0)}</div><div><div className="font-bold text-gray-900">{p.fullName}</div><div className="text-xs text-gray-500">{p.roles.join(', ')}</div></div></div></td><td className="px-6 py-4 text-center"><div className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-bold text-sm border ${p.metrics.grade === 'A+' ? 'bg-green-100 text-green-700 border-green-200' : p.metrics.grade === 'A' ? 'bg-blue-100 text-blue-700 border-blue-200' : p.metrics.grade === 'B' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{p.metrics.score} ({p.metrics.grade})</div></td><td className="px-6 py-4 text-center font-bold text-green-600">{p.metrics.completedTickets}</td><td className="px-6 py-4 text-center font-bold text-indigo-600">{p.metrics.inProgressTickets}</td><td className="px-6 py-4 text-center"><div className="flex items-center justify-center gap-1 text-gray-600"><IconStopwatch className="w-4 h-4" />{p.metrics.avgResponseTimeHours}</div></td><td className="px-6 py-4 text-center text-gray-600">{p.metrics.totalActions}</td></tr>))}</tbody></table></div></div>
    </div>
  );
};
