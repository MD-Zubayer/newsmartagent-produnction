"use client";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const PLATFORM_MAP = {
  'messenger': 'Messenger',
  'whatsapp': 'WhatsApp',
  'facebook_comment': 'FB Comment',
  'instagram': 'Instagram',
  'web_widget': 'Web Widget',
  'telegram': 'Telegram',
  'youtube': 'YouTube',
  'gbp': 'Google Business',
  'tiktok': 'TikTok',
  'facebook': 'Facebook'
};

const formatPlatform = (slug) => {
  if (!slug) return 'Unknown';
  const lower = slug.toLowerCase();
  return PLATFORM_MAP[lower] || lower.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function PlatformTokenChart({ data: platformDist }) {
  if (!platformDist || platformDist.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center border border-dashed border-gray-200 rounded-3xl">
        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest text-center mt-20">No Platform usage data found</p>
      </div>
    );
  }

  // ল্যাবেল এবং ডাটা প্রসেসিং
  const labels = platformDist.map(item => formatPlatform(item.platform));
  
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Input Tokens',
        data: platformDist.map(item => item.input_tokens || 0),
        backgroundColor: '#06b6d4', // Cyan
        borderRadius: 8,
        barThickness: 20,
      },
      {
        label: 'Output Tokens',
        data: platformDist.map(item => item.output_tokens || 0),
        backgroundColor: '#ec4899', // Pink
        borderRadius: 8,
        barThickness: 20,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top', 
        align: 'end',
        labels: { 
          usePointStyle: true,
          font: { weight: 'bold', size: 11 } 
        } 
      },
      tooltip: {
        backgroundColor: '#111827',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          afterBody: (context) => {
            const index = context[0].dataIndex;
            const item = platformDist[index];
            return `Total Requests: ${item.count || 0}`;
          }
        }
      }
    },
    scales: {
      x: { 
        stacked: false, 
        grid: { display: false },
        ticks: { font: { weight: 'bold', size: 10 }, color: '#94a3b8' }
      },
      y: { 
        beginAtZero: true, 
        grid: { color: '#f1f5f9' },
        ticks: { font: { weight: 'bold' }, color: '#94a3b8' }
      }
    },
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart'
    }
  };

  return (
    <div className="h-[300px] w-full mt-4">
      <Bar data={chartData} options={options} />
    </div>
  );
}