import React, { useState } from 'react';
import { 
  Calendar, CheckCircle, Award, BookMarked, FileText, BarChart2, Plus, Edit2, 
  Trash2, LogOut, ChevronRight, Filter, AlertCircle, Sparkles, Smile, Info, BookOpen,
  Printer, Share2
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Siswa, Halaqoh, CatatanHarian, NilaiEvaluasi } from '../types';

interface MusyrifDashboardProps {
  onLogout: () => void;
  userId: string;
  userNama: string;
  students: Siswa[];
  halaqohs: Halaqoh[];
  journals: CatatanHarian[];
  refreshData: () => Promise<void>;
}

export default function MusyrifDashboard({
  onLogout,
  userId,
  userNama,
  students,
  halaqohs,
  journals,
  refreshData
}: MusyrifDashboardProps) {
  const [activeTab, setActiveTab] = useState<'input' | 'rekap_hari' | 'rekap_bulan'>('input');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', type: 'success' });

  // Filter halaqohs to only those managed by the current Musyrif (supports multiple Musyrifs)
  const myHalaqohs = halaqohs.filter(h => h.musyrifId === userId || (h.musyrifIds && h.musyrifIds.includes(userId)));

  // Auto-find Musyrif's assigned halaqoh (if any) as initial value
  const assignedHalaqoh = halaqohs.find(h => h.musyrifId === userId || (h.musyrifIds && h.musyrifIds.includes(userId)));
  const initialHalaqohId = assignedHalaqoh?.id || myHalaqohs[0]?.id || '';

  // Filter States
  const [selectedHalaqohId, setSelectedHalaqohId] = useState(initialHalaqohId);
  const [rekapHariTanggal, setRekapHariTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBulanMonth, setSelectedBulanMonth] = useState('06'); // Default June (2026 as current year)
  const [selectedBulanSiswaId, setSelectedBulanSiswaId] = useState('');

  // Form input states (for modal dialog input harian)
  const [showInputModal, setShowInputModal] = useState(false);
  const [targetSiswa, setTargetSiswa] = useState<Siswa | null>(null);
  
  // Specific Setoran Form Fields
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formMateri, setFormMateri] = useState('');
  const [formEvaluasi, setFormEvaluasi] = useState('');
  const [formNilai, setFormNilai] = useState<NilaiEvaluasi>('A');
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);

  const showFeedback = (text: string, type: 'success' | 'danger' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback({ text: '', type: 'success' }), 4000);
  };

  const handleOpenInputForm = (siswa: Siswa, existingLog?: CatatanHarian) => {
    setTargetSiswa(siswa);
    if (existingLog) {
      setFormTanggal(existingLog.tanggal);
      setFormMateri(existingLog.materiSetoran);
      setFormEvaluasi(existingLog.evaluasiTahsin);
      setFormNilai(existingLog.nilai);
      setEditingJournalId(existingLog.id);
    } else {
      setFormTanggal(new Date().toISOString().split('T')[0]);
      setFormMateri('');
      setFormEvaluasi('');
      setFormNilai('A');
      setEditingJournalId(null);
    }
    setShowInputModal(true);
  };

  const handleSetoranSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSiswa || !formMateri.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        tanggal: formTanggal,
        siswaId: targetSiswa.id,
        siswaNama: targetSiswa.nama,
        noInduk: targetSiswa.noInduk,
        kelasNama: targetSiswa.kelasNama,
        halaqohId: targetSiswa.halaqohId,
        materiSetoran: formMateri.trim(),
        evaluasiTahsin: formEvaluasi.trim() || 'Lancar, terus tingkatkan.',
        nilai: formNilai
      };

      if (editingJournalId) {
        await updateDoc(doc(db, 'catatan_harian', editingJournalId), payload);
        showFeedback('Berhasil memperbarui catatan setoran!');
      } else {
        await addDoc(collection(db, 'catatan_harian'), payload);
        showFeedback(`Berhasil mencatat setoran untuk ${targetSiswa.nama}!`);
      }
      
      await refreshData();
      setShowInputModal(false);
      setTargetSiswa(null);
    } catch (err: any) {
      showFeedback('Gagal menyimpan setoran: ' + err.message, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Hapus catatan setoran ini?')) return;
    try {
      await deleteDoc(doc(db, 'catatan_harian', id));
      showFeedback('Berhasil menghapus catatan setoran.');
      await refreshData();
    } catch (err: any) {
      showFeedback('Gagal menghapus: ' + err.message, 'danger');
    }
  };

  const handleShareWA = () => {
    if (!selectedHalaqohId || !activeHalaqohObj) return;

    const formattedDate = new Date(rekapHariTanggal).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let text = `*REKAP HARIAN HALAQOH TAHFIDZ*\n`;
    text += `*Markaz Muhibbil Qur'an*\n\n`;
    text += `📖 *Halaqoh*: ${activeHalaqohObj.nama}\n`;
    text += `👤 *Musyrif/ah*: Ustadz/ah ${userNama}\n`;
    text += `📅 *Tanggal*: ${formattedDate}\n`;
    text += `📊 *Total Setoran*: ${dailyRecapLogs.length} Santri\n\n`;
    text += `===================================\n\n`;

    if (dailyRecapLogs.length === 0) {
      text += `_Belum ada setoran yang tercatat hari ini._\n`;
    } else {
      dailyRecapLogs.forEach((log, idx) => {
        const labelNilai = log.nilai === 'A' ? 'Mumtaz (A)' : 
                           log.nilai === 'B' ? 'Jayyid Jidid (B)' : 
                           log.nilai === 'C' ? 'Jayyid (C)' : 
                           log.nilai === 'D' ? 'Maqbul (D)' : 'Rosib (E)';

        text += `*${idx + 1}. ${log.siswaNama}* (No Induk: ${log.noInduk})\n`;
        text += `• Materi: _${log.materiSetoran}_\n`;
        text += `• Evaluasi: _${log.evaluasiTahsin || '-'}_\n`;
        text += `• Nilai: *${labelNilai}*\n\n`;
      });
    }

    text += `===================================\n`;
    text += `_Mencetak Generasi Qur'ani yang Berakhlaqul Karimah_`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleCetakPDF = () => {
    if (!selectedHalaqohId || !activeHalaqohObj) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) return;

    const formattedDate = new Date(rekapHariTanggal).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const tableRowsHtml = dailyRecapLogs.map((log, index) => {
      const labelNilai = log.nilai === 'A' ? 'Mumtaz (A)' : 
                         log.nilai === 'B' ? 'Jayyid Jidid (B)' : 
                         log.nilai === 'C' ? 'Jayyid (C)' : 
                         log.nilai === 'D' ? 'Maqbul (D)' : 'Rosib (E)';
      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${index + 1}</td>
          <td style="font-family: monospace; text-align: center;">${log.noInduk}</td>
          <td>
            <div style="font-weight: 700; text-transform: uppercase;">${log.siswaNama}</div>
            <div style="font-size: 9px; color: #64748b;">Kelas: ${log.kelasNama || 'Belum Diatur'}</div>
          </td>
          <td style="font-weight: 600; color: #0f766e;">${log.materiSetoran}</td>
          <td style="color: #475569; font-style: italic;">${log.evaluasiTahsin || '-'}</td>
          <td style="text-align: center;">
            <span class="nilai-badge nilai-${log.nilai}">${labelNilai}</span>
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rekap Harian - ${activeHalaqohObj.nama}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #1e293b;
            padding: 30px;
            margin: 0;
            background-color: #fff;
            line-height: 1.3;
          }
          .header {
            text-align: center;
            border-bottom: 3px double #0f766e;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 20px;
            color: #0f766e;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .header h2 {
            margin: 4px 0 0;
            font-size: 13px;
            color: #334155;
            font-weight: 600;
          }
          .header p {
            margin: 4px 0 0;
            font-size: 10px;
            color: #64748b;
            font-style: italic;
          }
          .meta-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 15px;
            font-size: 11px;
          }
          .meta-item {
            margin-bottom: 4px;
          }
          .meta-item:last-child {
            margin-bottom: 0;
          }
          .meta-item strong {
            color: #334155;
            display: inline-block;
            width: 120px;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 25px;
            font-size: 11px;
          }
          .report-table th, .report-table td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            vertical-align: top;
          }
          .report-table th {
            background-color: #f1f5f9;
            color: #0f766e;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.5px;
          }
          .report-table tr {
            page-break-inside: avoid;
          }
          .report-table tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .nilai-badge {
            font-weight: 700;
            font-size: 9px;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
            white-space: nowrap;
            display: inline-block;
          }
          .nilai-A { background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
          .nilai-B { background-color: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
          .nilai-C { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .nilai-D { background-color: #fef08a; color: #854d0e; border: 1px solid #fde68a; }
          .nilai-E { background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
          
          .no-data {
            font-size: 11px;
            color: #94a3b8;
            font-style: italic;
            text-align: center;
          }
          .footer-signature {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            font-size: 11px;
            page-break-inside: avoid;
          }
          .sig-box {
            width: 180px;
            text-align: center;
          }
          .sig-line {
            margin-top: 50px;
            border-top: 1px solid #475569;
            padding-top: 4px;
            font-weight: 700;
            color: #1e293b;
          }
          @media print {
            body {
              padding: 0;
            }
            @page {
              size: A4;
              margin: 1cm;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MARKAZ MUHIBBIL QUR'AN</h1>
          <h2>LAPORAN REKAP HARIAN SETORAN TAHFIDZ</h2>
          <p>Mencetak Generasi Qur'ani yang Berakhlaqul Karimah</p>
        </div>

        <div class="meta-container">
          <div>
            <div class="meta-item"><strong>Halaqoh Qur'an</strong>: ${activeHalaqohObj.nama}</div>
            <div class="meta-item"><strong>Musyrif Pengampu</strong>: Ustadz/ah ${userNama}</div>
          </div>
          <div>
            <div class="meta-item"><strong>Tanggal Laporan</strong>: ${formattedDate}</div>
            <div class="meta-item"><strong>Total Setoran</strong>: ${dailyRecapLogs.length} Anak</div>
          </div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 12%; text-align: center;">No Induk</th>
              <th style="width: 25%; text-align: left;">Nama Santri</th>
              <th style="width: 25%; text-align: left;">Materi Setoran</th>
              <th style="width: 21%; text-align: left;">Evaluasi / Tahsin</th>
              <th style="width: 12%; text-align: center;">Nilai</th>
            </tr>
          </thead>
          <tbody>
            ${dailyRecapLogs.length === 0 ? `
              <tr>
                <td colspan="6" class="no-data">Belum ada catatan setoran harian untuk tanggal ini.</td>
              </tr>
            ` : tableRowsHtml}
          </tbody>
        </table>

        <div class="footer-signature">
          <div class="sig-box">
            <div>Mengetahui,</div>
            <div style="font-weight: 700; margin-top: 4px;">Pimpinan Markaz</div>
            <div class="sig-line">__________________________</div>
          </div>
          <div class="sig-box">
            <div>Sukoharjo, ${formattedDate}</div>
            <div style="font-weight: 700; margin-top: 4px;">Musyrif Pengampu</div>
            <div class="sig-line">Ustadz/ah ${userNama}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 5000);
    }, 500);
  };

  // Filter students based on active halaqoh
  const activeHalaqohStudents = students.filter(s => s.halaqohId === selectedHalaqohId);
  const activeHalaqohObj = halaqohs.find(h => h.id === selectedHalaqohId);

  // Filter journals for "Rekap Harian"
  const dailyRecapLogs = journals.filter(j => j.halaqohId === selectedHalaqohId && j.tanggal === rekapHariTanggal);

  // Filter for "Rekap Bulanan"
  // Month string format: 2026-XX
  const selectedYearMonthPrefix = `2026-${selectedBulanMonth}`;
  const studentMonthlyLogs = journals.filter(j => 
    j.siswaId === selectedBulanSiswaId && 
    j.tanggal.startsWith(selectedYearMonthPrefix)
  );

  const getNilaiBadgeClass = (val: NilaiEvaluasi) => {
    switch(val) {
      case 'A': return 'bg-emerald-100 text-emerald-800';
      case 'B': return 'bg-blue-100 text-blue-800';
      case 'C': return 'bg-amber-100 text-amber-900 border border-amber-200';
      case 'D': return 'bg-yellow-100 text-yellow-800';
      case 'E': return 'bg-rose-100 text-rose-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getNilaiLabel = (val: NilaiEvaluasi) => {
    switch(val) {
      case 'A': return 'Mumtaz (A)';
      case 'B': return 'Jayyid Jidid (B)';
      case 'C': return 'Jayyid (C)';
      case 'D': return 'Maqbul (D)';
      case 'E': return 'Rosib (E)';
      default: return val;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Musyrif Navigation */}
      <nav className="bg-emerald-800 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-700 border border-emerald-500/50 flex flex-col items-center justify-center">
                <BookOpen className="w-5 h-5 text-emerald-50" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm tracking-wide leading-none block uppercase text-emerald-100">
                  PORTAL MUSYRIF
                </span>
                <span className="text-[11px] text-emerald-300 font-bold block mt-0.5" title="Logged in musyrif name">
                  Ustadz {userNama}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="musyrif-logout-btn"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700/80 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition duration-150 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Core Section */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-6">
        
        {/* Left Control Sidebar */}
        <div className="w-full md:w-64 flex-none space-y-4">
          
          {/* Active Tab Buttons */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm space-y-1">
            <h4 className="text-[10px] font-bold text-slate-400 px-3 uppercase tracking-widest mb-2">MENU PERKEMBANGAN</h4>
            
            {[
              { id: 'input', label: 'Input Harian', icon: Plus },
              { id: 'rekap_hari', label: 'Rekap Harian', icon: FileText },
              { id: 'rekap_bulan', label: 'Rekap Bulanan', icon: BarChart2 }
            ].map(tab => {
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setFeedback({ text: '', type: 'success' });
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComp className={`w-4 h-4 ${activeTab === tab.id ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-400 opacity-60" />
                </button>
              );
            })}
          </div>

          {/* Connected Info Widget */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Info Halaqoh Anda:</span>
            </div>
            {assignedHalaqoh ? (
              <p>Halaqoh binaan utama Anda adalah <strong className="text-emerald-800">{assignedHalaqoh.nama}</strong>.</p>
            ) : (
              <p className="text-slate-500 italic">Anda belum memiliki halaqoh binaan tetap yang ditentukan Admin. Anda masih bisa mengajar halaqoh lain.</p>
            )}
          </div>
        </div>

        {/* Right Dashboard Body Panel */}
        <div className="flex-1 bg-white border border-slate-150 p-6 rounded-3xl shadow-xs space-y-6">
          
          {feedback.text && (
            <div className={`p-4 rounded-xl text-xs font-semibold border ${
              feedback.type === 'success' ? 'bg-emerald-50 border-emerald-250 text-emerald-800' : 'bg-rose-50 border-rose-250 text-rose-800'
            }`}>
              {feedback.text}
            </div>
          )}

          {/* TAB: INPUT HARIAN */}
          {activeTab === 'input' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Pencatatan Setoran Harian (Input Harian)</h3>
                  <p className="text-xs text-slate-500">Pilih halaqoh untuk memunculkan daftar santri kemudian inputkan catatan setoran harian mereka</p>
                </div>
              </div>

              {/* Dynamic Selector Row */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 items-center">
                <div className="w-full sm:w-auto text-xs font-bold text-slate-600 shrink-0 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-emerald-600" />
                  <span>Halaqoh Terpilih :</span>
                </div>
                <select
                  value={selectedHalaqohId}
                  onChange={(e) => {
                    setSelectedHalaqohId(e.target.value);
                    // Reset rekap bulanan student if changed halaqoh
                    setSelectedBulanSiswaId('');
                  }}
                  className="w-full sm:w-72 px-4 py-2 bg-white border border-slate-200 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-800"
                >
                  <option value="">-- Silahkan Pilih Halaqoh --</option>
                  {myHalaqohs.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Cards Grid for Laypeople & Mobile Friendliness */}
              {selectedHalaqohId ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                      Daftar Murid ({activeHalaqohStudents.length} Anak)
                    </h4>
                    <span className="text-[10px] text-slate-400 font-semibold italic">Tampilan Mobile-Friendly Card</span>
                  </div>

                  {activeHalaqohStudents.length === 0 ? (
                    <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                      Tidak ada santri yang terdaftar dalam Halaqoh ini. Hubungi Admin jika ada kesalahan pemetaan halaqoh.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeHalaqohStudents.map((siswa, sIndex) => {
                        // Find if there is a setoran entry today
                        const todayStr = new Date().toISOString().split('T')[0];
                        const logHariIni = journals.find(j => j.siswaId === siswa.id && j.tanggal === todayStr);

                        return (
                          <div 
                            key={siswa.id} 
                            className={`p-5 rounded-2xl border transition duration-150 flex flex-col justify-between space-y-4 ${
                              logHariIni 
                                ? 'bg-emerald-50/50 border-emerald-150 shadow-xs' 
                                : 'bg-white border-slate-150 hover:border-emerald-300 hover:shadow-xs'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="text-[10px] font-mono font-bold text-slate-400">#{sIndex + 1} | INDUK: {siswa.noInduk}</span>
                                  <h5 className="font-extrabold text-sm text-slate-800 uppercase leading-snug mt-0.5">{siswa.nama}</h5>
                                </div>
                                <span className="text-[10px] bg-slate-100 border border-slate-200 rounded-lg font-bold px-2 py-0.5 text-slate-600 block self-start">
                                  {siswa.kelasNama || 'N/A'}
                                </span>
                              </div>

                              {logHariIni ? (
                                <div className="p-3 bg-white rounded-xl border border-emerald-100/50 text-xs text-emerald-950 space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-600 uppercase">
                                    <span>SUDAH SETORAN HARI INI</span>
                                    <span className="bg-emerald-200 text-emerald-800 px-1.5 rounded-sm">{logHariIni.nilai}</span>
                                  </div>
                                  <p className="line-clamp-1 font-semibold text-slate-700">Materi: {logHariIni.materiSetoran}</p>
                                  <p className="line-clamp-2 text-slate-500 leading-snug text-[11px]">Eval: {logHariIni.evaluasiTahsin}</p>
                                </div>
                              ) : (
                                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 italic">
                                  Belum ada setoran hari ini.
                                </div>
                              )}
                            </div>

                            <div className="pt-2 flex gap-2">
                              {logHariIni ? (
                                <>
                                  <button
                                    onClick={() => handleOpenInputForm(siswa, logHariIni)}
                                    className="flex-1 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-xl transition cursor-pointer text-center"
                                  >
                                    Edit Catatan
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLog(logHariIni.id)}
                                    className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-xl transition cursor-pointer text-center"
                                    title="Hapus setoran"
                                  >
                                    Hapus
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleOpenInputForm(siswa)}
                                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs hover:shadow-md hover:shadow-emerald-100 flex items-center justify-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Input Setoran Harian</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-slate-400 text-xs">
                  Silahkan aktifkan salah satu filter Halaqoh Qur'an di atas terlebih dahulu.
                </div>
              )}
            </div>
          )}

          {/* TAB: REKAP HARIAN */}
          {activeTab === 'rekap_hari' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black text-slate-800">Rekap Harian Halaqoh</h3>
                <p className="text-xs text-slate-500">Melihat seluruh setoran santri di dalam satu halaqoh pada tanggal tertentu</p>
              </div>

              {/* Day filters */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">1. Pilih Halaqoh :</label>
                  <select
                    value={selectedHalaqohId}
                    onChange={(e) => setSelectedHalaqohId(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-250 text-xs rounded-xl focus:outline-none font-bold"
                  >
                    <option value="">-- Pilih Halaqoh --</option>
                    {myHalaqohs.map(h => (
                      <option key={h.id} value={h.id}>{h.nama}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">2. Pilih Tanggal :</label>
                  <input
                    type="date"
                    value={rekapHariTanggal}
                    onChange={(e) => setRekapHariTanggal(e.target.value)}
                    className="w-full px-4 py-1.5 bg-white border border-slate-250 text-xs rounded-xl focus:outline-none font-semibold text-slate-700"
                  />
                </div>

                <div className="flex items-end justify-start">
                  <span className="text-[10.5px] text-slate-500 font-medium">
                    Hari ini adalah tanggal: <strong className="text-slate-800">{new Date().toISOString().split('T')[0]}</strong>
                  </span>
                </div>
              </div>

              {selectedHalaqohId ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900 uppercase">Rekap Hasil Setoran Santri</h4>
                      <div className="text-emerald-700 text-xs mt-0.5">
                        Halaqoh: <strong>{activeHalaqohObj?.nama}</strong> | Tanggal: <strong>{rekapHariTanggal}</strong>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                      <div className="text-xs font-bold text-emerald-900">
                        Total Diinput: <strong>{dailyRecapLogs.length} dari {activeHalaqohStudents.length} Siswa</strong>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          id="btn-share-wa"
                          onClick={handleShareWA}
                          disabled={dailyRecapLogs.length === 0}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white font-extrabold text-xs rounded-xl transition shadow-xs cursor-pointer"
                          title="Bagikan Laporan ke WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Kirim ke WA</span>
                        </button>
                        <button
                          id="btn-print-pdf"
                          onClick={handleCetakPDF}
                          disabled={dailyRecapLogs.length === 0}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white font-extrabold text-xs rounded-xl transition shadow-xs cursor-pointer"
                          title="Cetak/Simpan PDF Laporan"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Cetak PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-3 px-4 w-12">NO</th>
                          <th className="py-3 px-4 w-24">NO INDUK</th>
                          <th className="py-3 px-4 w-44">NAMA SISWA</th>
                          <th className="py-3 px-4">MATERI SETORAN (SURAT/AYAT)</th>
                          <th className="py-3 px-4">EVALUASI TAHSIN & TAJWID</th>
                          <th className="py-3 px-4 text-center w-28">NILAI</th>
                          <th className="py-3 px-4 text-right w-16">AKSI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-[11.5px] text-slate-700">
                        {dailyRecapLogs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-400 font-medium italic">
                              Tidak ada data setoran yang tercatat pada halaqoh dan tanggal ini.
                            </td>
                          </tr>
                        ) : (
                          dailyRecapLogs.map((log, index) => (
                            <tr key={log.id} className="hover:bg-slate-50/40">
                              <td className="py-3 px-4 font-mono font-bold text-slate-400">{index + 1}</td>
                              <td className="py-3 px-4 font-mono">{log.noInduk}</td>
                              <td className="py-3 px-4 font-bold text-slate-900">{log.siswaNama}</td>
                              <td className="py-3 px-4 font-semibold text-emerald-900">{log.materiSetoran}</td>
                              <td className="py-3 px-4 text-slate-500 italic max-w-xs truncate" title={log.evaluasiTahsin}>{log.evaluasiTahsin}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2 py-1 rounded-full font-bold text-[10px] uppercase ${getNilaiBadgeClass(log.nilai)}`}>
                                  {getNilaiLabel(log.nilai)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="text-rose-600 hover:text-rose-800 p-1 bg-rose-50 hover:bg-rose-100 rounded-md cursor-pointer transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                  Pilih Halaqoh terlebih dahulu di atas.
                </div>
              )}
            </div>
          )}

          {/* TAB: REKAP BULANAN */}
          {activeTab === 'rekap_bulan' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black text-slate-800">Laporan Rekap Bulanan Siswa</h3>
                <p className="text-xs text-slate-500">Melihat performa, tingkat keaktifan, dan rekam materi setoran per individu siswa per bulan</p>
              </div>

              {/* Filters Block */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block uppercase">1. Pilih Halaqoh :</label>
                  <select
                    value={selectedHalaqohId}
                    onChange={(e) => {
                      setSelectedHalaqohId(e.target.value);
                      setSelectedBulanSiswaId(''); // Reset selected student
                    }}
                    className="w-full px-4 py-2 bg-white border border-slate-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih Halaqoh --</option>
                    {myHalaqohs.map(h => (
                      <option key={h.id} value={h.id}>{h.nama}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block uppercase">2. Pilih Siswa :</label>
                  <select
                    value={selectedBulanSiswaId}
                    onChange={(e) => setSelectedBulanSiswaId(e.target.value)}
                    disabled={!selectedHalaqohId}
                    className="w-full px-4 py-2 bg-white border border-slate-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {activeHalaqohStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.nama} ({s.noInduk})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block uppercase">3. Pilih Bulan :</label>
                  <select
                    value={selectedBulanMonth}
                    onChange={(e) => setSelectedBulanMonth(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="01">Januari (2026)</option>
                    <option value="02">Februari (2026)</option>
                    <option value="03">Maret (2026)</option>
                    <option value="04">April (2026)</option>
                    <option value="05">Mei (2026)</option>
                    <option value="06">Juni (2026)</option>
                    <option value="07">Juli (2026)</option>
                    <option value="08">Agustus (2026)</option>
                    <option value="09">September (2026)</option>
                    <option value="10">Oktober (2026)</option>
                    <option value="11">November (2026)</option>
                    <option value="12">Desember (2026)</option>
                  </select>
                </div>
              </div>

              {selectedBulanSiswaId ? (
                <div className="space-y-6">
                  {/* Monthly Summary Statistics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase">Jumlah Setoran</div>
                      <div className="text-2xl font-black text-emerald-900 mt-1">{studentMonthlyLogs.length} Kali</div>
                    </div>

                    <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                      <div className="text-[10px] font-bold text-indigo-600 uppercase">Perolehan Mumtaz (A)</div>
                      <div className="text-2xl font-black text-indigo-900 mt-1">
                        {studentMonthlyLogs.filter(j => j.nilai === 'A').length} Kali
                      </div>
                    </div>

                    <div className="p-4 bg-sky-50 border border-sky-100 rounded-2xl">
                      <div className="text-[10px] font-bold text-sky-600 uppercase">Jayyid Jidid (B)</div>
                      <div className="text-xl font-bold text-sky-900 mt-1">
                        {studentMonthlyLogs.filter(j => j.nilai === 'B').length} Kali
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                      <div className="text-[10px] font-bold text-amber-600 uppercase">Nilai Lain (C/D/E)</div>
                      <div className="text-xl font-bold text-amber-900 mt-1">
                        {studentMonthlyLogs.filter(j => ['C','D','E'].includes(j.nilai)).length} Kali
                      </div>
                    </div>
                  </div>

                  {/* Monthly Chronology Logs table/timeline */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                      Detail Jurnal Bulanan Siswa
                    </h4>

                    {studentMonthlyLogs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                        Tidak ada laporan setoran siswa ini untuk bulan terpilih.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {studentMonthlyLogs.map((log, index) => (
                          <div key={log.id} className="p-4 bg-white border border-slate-150 rounded-2xl shadow-xs space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                              <span className="text-[11px] font-mono font-bold text-slate-500">
                                📅 {log.tanggal}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${getNilaiBadgeClass(log.nilai)}`}>
                                {getNilaiLabel(log.nilai)}
                              </span>
                            </div>
                            <div className="text-xs space-y-1">
                              <p className="font-bold text-slate-800">
                                📖 Materi: <span className="text-emerald-800">{log.materiSetoran}</span>
                              </p>
                              <p className="text-slate-500 italic leading-snug">
                                🔍 Evaluasi: {log.evaluasiTahsin}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-slate-400 text-xs">
                  Silahkan lengkapi filter pilihan "Halaqoh" dan pilih "Siswa" di atas untuk memuat laporan bulanan.
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* INPUT / EDIT SETORAN HARIAN DIALOG MODAL */}
      {showInputModal && targetSiswa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col">
            
            <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wide">
                  {editingJournalId ? 'Edit Catatan Setoran' : 'Input Setoran Baru'}
                </h3>
                <p className="text-[11px] text-emerald-200 mt-0.5 uppercase">
                  Siswa: {targetSiswa.nama}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowInputModal(false);
                  setTargetSiswa(null);
                }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSetoranSubmit} className="p-6 space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Hari / Tanggal Setoran</label>
                <input
                  type="date"
                  required
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Materi Setoran (Surat & Ayat)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: An-Naba 1-20, Al-Baqarah 45"
                  value={formMateri}
                  onChange={(e) => setFormMateri(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Evaluasi (Tahsin & Tajwid)</label>
                <textarea
                  placeholder="Contoh: Makharijul huruf cukup baik, pertahankan dengung bighunnah pada ayat 4."
                  value={formEvaluasi}
                  onChange={(e) => setFormEvaluasi(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Kategori Penilaian Setoran Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">Kategori Penilaian Setoran</label>
                <select
                  value={formNilai}
                  onChange={(e) => setFormNilai(e.target.value as NilaiEvaluasi)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-700"
                >
                  <option value="A">Mumtaz (A) - Sangat Lancar, Sempurna</option>
                  <option value="B">Jayyid Jidid (B) - Lancar, Sedikit Koreksi</option>
                  <option value="C">Jayyid (C) - Cukup Lancar, Agak Terbata</option>
                  <option value="D">Maqbul (D) - Banyak Terputus / Perlu Mengulang</option>
                  <option value="E">Rosib (E) - Belum Bisa / Mengulang Total</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition duration-150 cursor-pointer"
              >
                {isSaving ? 'Sedang Menyimpan...' : 'Simpan Setoran Santri'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
