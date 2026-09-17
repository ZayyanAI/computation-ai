import React, { useState } from 'react';
import { X, FileText, Download, Printer, Check, Copy } from 'lucide-react';

export default function ExportModal({
  isOpen,
  onClose,
  pipelineResult
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !pipelineResult) return null;

  const objects = pipelineResult.objects || [];
  const stats = pipelineResult.stats || {};
  const calib = pipelineResult.calibration || {};
  const unit = calib.unit || 'cm';

  // Export CSV
  const handleDownloadCSV = () => {
    const headers = [
      'ID',
      'Label',
      `Length (${unit})`,
      `Width (${unit})`,
      `Perimeter (${unit})`,
      `Area (${unit}^2)`,
      `Volume (${unit}^3)`,
      'Circularity',
      'Confidence',
      'Centroid_X',
      'Centroid_Y'
    ];

    const rows = objects.map(o => {
      const m = o.measurements || {};
      const px = o.pixel_metrics || {};
      return [
        o.id,
        `"${o.label}"`,
        m.length ?? 0,
        m.width ?? 0,
        m.perimeter ?? 0,
        m.area ?? 0,
        m.volume ?? 0,
        px.circularity ?? 0,
        o.confidence ?? 0,
        o.centroid ? o.centroid[0] : 0,
        o.centroid ? o.centroid[1] : 0
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `countmeasure_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON
  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(pipelineResult, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `countmeasure_audit_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Compute — Laporan Audit Pengukuran</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #222; }
          h1 { color: #047857; margin-bottom: 4px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 24px; border-bottom: 1px solid #ccc; padding-bottom: 12px; }
          .summary-grid { display: flex; gap: 20px; margin-bottom: 24px; }
          .card { border: 1px solid #ddd; padding: 14px; border-radius: 8px; flex: 1; }
          .card-title { font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 4px; }
          .card-val { font-size: 20px; font-weight: bold; color: #047857; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #f3f4f6; }
          .formula { font-family: monospace; background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <h1>Compute — Sertifikat & Laporan Hasil Audit</h1>
        <div class="meta">
          Dibuat secara otomatis pada ${new Date().toLocaleString('id-ID')} | Pipeline Computer Vision & Formula Audit
        </div>

        <div class="summary-grid">
          <div class="card">
            <div class="card-title">Total Objek Dihitung</div>
            <div class="card-val">${stats.total_count || 0}</div>
          </div>
          <div class="card">
            <div class="card-title">Faktor Skala Kalibrasi</div>
            <div class="card-val">${calib.scale ? calib.scale.toFixed(5) : 0} ${unit}/px</div>
          </div>
          <div class="card">
            <div class="card-title">Rerata Panjang</div>
            <div class="card-val">${stats.mean_length || 0} ${unit}</div>
          </div>
          <div class="card">
            <div class="card-title">Densitas Spasial</div>
            <div class="card-val">${stats.density || 0} obj/${unit}²</div>
          </div>
        </div>

        <h3>Formula Matematis Kalibrasi:</h3>
        <div class="formula">
          S = D_real / d_px = ${(calib.real_dimension || 0).toFixed(2)} ${unit} / ${(calib.pixel_dimension || 0).toFixed(1)} px = ${(calib.scale || 0).toFixed(5)} ${unit}/px
        </div>

        <h3>Daftar Detail Objek & Pengukuran:</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Panjang (${unit})</th>
              <th>Lebar (${unit})</th>
              <th>Luas (${unit}²)</th>
              <th>Volume (${unit}³)</th>
              <th>Circularity</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            ${objects.map(o => `
              <tr>
                <td>#${o.id}</td>
                <td>${o.label}</td>
                <td>${o.measurements?.length || '-'}</td>
                <td>${o.measurements?.width || '-'}</td>
                <td>${o.measurements?.area || '-'}</td>
                <td>${o.measurements?.volume || '-'}</td>
                <td>${o.pixel_metrics?.circularity || '-'}</td>
                <td>${Math.round((o.confidence || 0) * 100)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-[#222222] border border-[#383838] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between bg-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">Ekspor Laporan Audit</h3>
              <p className="text-xs text-neutral-400">Unduh data metrik, koordinat bounding box, dan riwayat formula</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#333333]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Options */}
        <div className="p-6 space-y-3">
          
          {/* CSV */}
          <div className="p-4 rounded-xl bg-[#282828] border border-[#383838] hover:border-emerald-500/50 flex items-center justify-between transition-all">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-neutral-100">Format CSV (Spreadsheet / Excel)</h4>
              <p className="text-xs text-neutral-400">Tabel terstruktur berisi ID, panjang, lebar, luas, volume, dan koordinat.</p>
            </div>
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Unduh CSV</span>
            </button>
          </div>

          {/* JSON */}
          <div className="p-4 rounded-xl bg-[#282828] border border-[#383838] hover:border-cyan-500/50 flex items-center justify-between transition-all">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-neutral-100">Format JSON (Lengkap dengan Metadata)</h4>
              <p className="text-xs text-neutral-400">Data mentah lengkap dengan polygon mask, string LaTeX, dan konfigurasi.</p>
            </div>
            <button
              onClick={handleDownloadJSON}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Unduh JSON</span>
            </button>
          </div>

          {/* Printable Report (PDF) */}
          <div className="p-4 rounded-xl bg-[#282828] border border-[#383838] hover:border-purple-500/50 flex items-center justify-between transition-all">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-neutral-100">Laporan Cetak / Simpan PDF</h4>
              <p className="text-xs text-neutral-400">Tampilan sertifikat audit rapi yang siap dicetak langsung ke PDF.</p>
            </div>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#1e1e1e] border-t border-[#333333] text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2c2c2c] hover:bg-[#363636] text-xs font-semibold text-neutral-300"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
