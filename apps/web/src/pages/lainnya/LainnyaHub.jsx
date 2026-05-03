import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Briefcase,
  Lightbulb,
  CreditCard,
  ShoppingBag,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '../../components/ui';

const TILES = [
  {
    to: '/help',
    icon: HelpCircle,
    title: 'Bantuan',
    description: 'Panduan penggunaan & masukan perbaikan untuk tim VIPOS.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    to: '/services',
    icon: Briefcase,
    title: 'LAYANAN',
    description: 'Layanan tambahan: Majoopay, EDC, Satu Sehat, Aura AI.',
    color: 'from-violet-500 to-violet-600',
  },
  {
    to: '/inspirasi',
    icon: Lightbulb,
    title: 'INSPIRASI',
    description: 'Blog, event, majalah, dan informasi update VIPOS.',
    color: 'from-amber-500 to-amber-600',
  },
  {
    to: '/capital',
    icon: CreditCard,
    title: 'Capital',
    description: 'Pinjaman modal usaha untuk pelaku UMKM (Advance+).',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    to: '/supplies',
    icon: ShoppingBag,
    title: 'SUPPLIES',
    description: 'Marketplace B2B untuk kebutuhan operasional.',
    color: 'from-rose-500 to-rose-600',
  },
];

export default function LainnyaHub() {
  return (
    <div>
      <PageHeader title="LAINNYA" subtitle="Layanan tambahan untuk mendukung operasional bisnis" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow group"
          >
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center mb-3`}
            >
              <t.icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{t.title}</h3>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary-600" />
            </div>
            <p className="text-sm text-gray-500 mt-1">{t.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
