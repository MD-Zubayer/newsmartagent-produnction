"use client";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend
);

export default function AnalyticsCharts({ trendData }) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    // আপনার ইমেজের মতো অ্যানিমেশন স্টাইল
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart',
    },
    plugins: {
      legend: { 
        display: true, 
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
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { 
          font: { weight: 'bold', size: 10 }, 
          color: '#94a3b8',
        }
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { 
          font: { weight: 'bold' }, 
          color: '#94a3b8',
          callback: (value) => value.toLocaleString(),
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  const labels = trendData.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Output Tokens',
        data: trendData.map(d => d.output_tokens),
        borderColor: '#ec4899', // Pinkish (আপনার ইমেজের মতো)
        backgroundColor: 'rgba(236, 72, 153, 0.05)', 
        borderWidth: 3, 
        fill: true,
        tension: 0.5, // Wavy effect
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#ec4899',
        pointHoverBorderWidth: 3,
      },
      {
        label: 'Input Tokens',
        data: trendData.map(d => d.input_tokens),
        borderColor: '#06b6d4', // Cyan/Blue
        backgroundColor: 'rgba(6, 182, 212, 0.05)', 
        borderWidth: 3, 
        fill: true,
        tension: 0.5, // Wavy effect
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#06b6d4',
        pointHoverBorderWidth: 3,
      }
    ],
  };

  return (
    <div className="h-[350px] w-full p-2">
      <Line options={options} data={data} />
    </div>
  );
}