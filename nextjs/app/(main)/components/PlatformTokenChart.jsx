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

export default function PlatformTokenChart({ recentLogs }) {
  // ডাটা প্রসেসিং: ফেসবুক এবং মেসেঞ্জারের জন্য টোকেন আলাদা করা
  const platformData = recentLogs.reduce((acc, log) => {
    const platform = log.platform.includes('facebook') ? 'Facebook' : 'Messenger';
    if (!acc[platform]) {
      acc[platform] = { input: 0, output: 0, count: 0 };
    }
    acc[platform].input += log.input_tokens;
    acc[platform].output += log.output_tokens;
    acc[platform].count += 1;
    return acc;
  }, {});

  const labels = Object.keys(platformData);
  
  const data = {
    labels,
    datasets: [
      {
        label: 'Input Tokens',
        data: labels.map(l => platformData[l].input),
        backgroundColor: '#06b6d4', // Cyan
        borderRadius: 8,
      },
      {
        label: 'Output Tokens',
        data: labels.map(l => platformData[l].output),
        backgroundColor: '#ec4899', // Pink
        borderRadius: 8,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { weight: 'bold' } } },
      tooltip: {
        callbacks: {
          afterBody: (context) => {
            const platform = context[0].label;
            return `Total Requests: ${platformData[platform].count}`;
          }
        }
      }
    },
    scales: {
      x: { stacked: false, grid: { display: false } },
      y: { beginAtZero: true, grid: { color: '#f1f5f9' } }
    },
  };

  return (
    <div className="h-[300px] w-full">
      <Bar data={data} options={options} />
    </div>
  );
}