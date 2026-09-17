import React, { useState } from 'react';
import { 
  Table, 
  ArrowUpDown, 
  Search, 
  PieChart, 
  Layers, 
  ChevronDown,
  Sparkles
} from 'lucide-react';

export default function DataTable({
  objects = [],
  stats = {},
  unit = 'cm',
  selectedObjectId,
  onSelectObject
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filter & Sort
  const filtered = objects.filter(obj => {
    const term = searchTerm.toLowerCase();
    return (
      obj.label.toLowerCase().includes(term) ||
      obj.id.toString().includes(term) ||
      (obj.category || '').toLowerCase().includes(term)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField in (a.measurements || {})) {
      valA = a.measurements[sortField];
      valB = b.measurements[sortField];
    } else if (sortField in (a.pixel_metrics || {})) {
      valA = a.pixel_metrics[sortField];
      valB = b.pixel_metrics[sortField];
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const dist = stats.distribution || { small: 0, medium: 0, large: 0 };
  const total = stats.total_count || 1;

  return (
    <div className="w-full glass-panel border border-[#333333] flex flex-col overflow-hidden">
      
      {/* Header & Filter Controls */}
      <div className="p-3 bg-[#222222]/90 border-b border-[#333333] flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-100">
            Tabel Data Metrik Pengukuran ({sorted.length} Entitas)
          </h3>
        </div>

        {/* Distribution Bars */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] text-neutral-400 hidden md:inline">Distribusi Ukuran:</span>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">
              Kecil: {dist.small}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
              Sedang: {dist.medium}
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
              Besar: {dist.large}
            </span>
          </div>
        </div>

        {/* Search Box */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Cari ID / Nama..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1 rounded-lg bg-[#181818] border border-[#383838] focus:border-cyan-500 text-xs text-neutral-100 placeholder-neutral-500 w-36 sm:w-48"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="max-h-60 overflow-y-auto overflow-x-auto text-xs">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#202020] text-neutral-400 font-semibold border-b border-[#333333] z-10 text-[11px]">
            <tr>
              <th onClick={() => handleSort('id')} className="py-2 px-3 cursor-pointer hover:text-white">
                <span className="flex items-center gap-1">ID <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('label')} className="py-2 px-3 cursor-pointer hover:text-white">
                <span className="flex items-center gap-1">Label Objek <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('length')} className="py-2 px-3 cursor-pointer hover:text-white">
                <span className="flex items-center gap-1">Panjang ({unit}) <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('width')} className="py-2 px-3 cursor-pointer hover:text-white">
                <span className="flex items-center gap-1">Lebar ({unit}) <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('area')} className="py-2 px-3 cursor-pointer hover:text-white">
                <span className="flex items-center gap-1">Luas ({unit}²) <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('volume')} className="py-2 px-3 cursor-pointer hover:text-white">
                <span className="flex items-center gap-1">Volume ({unit}³) <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('circularity')} className="py-2 px-3 cursor-pointer hover:text-white">
                <span className="flex items-center gap-1">Kebulatan (C) <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('nearest_neighbor_dist')} className="py-2 px-3 cursor-pointer hover:text-white">
                <span className="flex items-center gap-1">Jarak Terdekat ({unit}) <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('confidence')} className="py-2 px-3 cursor-pointer hover:text-white">
                <span className="flex items-center gap-1">Akurasi <ArrowUpDown className="w-3 h-3" /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#282828] font-mono text-[11px]">
            {sorted.map(obj => {
              const isSelected = selectedObjectId === obj.id;
              const m = obj.measurements || {};
              const px = obj.pixel_metrics || {};

              return (
                <tr
                  key={obj.id}
                  onClick={() => onSelectObject(obj.id)}
                  className={`cursor-pointer transition-colors duration-150 ${
                    isSelected 
                      ? 'bg-amber-500/15 text-amber-200 border-l-2 border-amber-500' 
                      : 'hover:bg-[#282828] text-neutral-300'
                  }`}
                >
                  <td className="py-2 px-3 font-bold text-neutral-100">#{obj.id}</td>
                  <td className="py-2 px-3 font-sans font-medium text-neutral-200">{obj.label}</td>
                  <td className="py-2 px-3 text-cyan-300 font-bold">{m.length ?? '-'}</td>
                  <td className="py-2 px-3 text-cyan-300">{m.width ?? '-'}</td>
                  <td className="py-2 px-3 text-emerald-300">{m.area ?? '-'}</td>
                  <td className="py-2 px-3 text-purple-300 font-bold">{m.volume ?? '-'}</td>
                  <td className="py-2 px-3 text-amber-300">{px.circularity ?? '-'}</td>
                  <td className="py-2 px-3 text-neutral-400">
                    {m.nearest_neighbor_id ? `#${m.nearest_neighbor_id} (${m.nearest_neighbor_dist})` : '-'}
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-emerald-400 font-bold">
                      {Math.round(obj.confidence * 100)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
