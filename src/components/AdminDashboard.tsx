import React, { useState } from 'react';
import { 
  Users, BookOpen, UserCheck, ShieldAlert, Settings, LogOut, Plus, Edit2, Trash2, 
  ChevronRight, Database, Save, CheckCircle, Lock, BookMarked, FileText 
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Kelas, Halaqoh, Siswa, Musyrif, CatatanHarian } from '../types';

interface AdminDashboardProps {
  onLogout: () => void;
  classes: Kelas[];
  students: Siswa[];
  musyrifs: Musyrif[];
  halaqohs: Halaqoh[];
  journals: CatatanHarian[];
  adminPass: string;
  refreshData: () => Promise<void>;
}

export default function AdminDashboard({
  onLogout,
  classes,
  students,
  musyrifs,
  halaqohs,
  journals,
  adminPass,
  refreshData
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'kelas' | 'siswa' | 'pengajar' | 'halaqoh' | 'laporan' | 'pengaturan'>('kelas');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: 'success' });

  // Modal States
  const [modalType, setModalType] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  // Form Field States
  // 1. Kelas Form
  const [kelasNama, setKelasNama] = useState('');

  // 2. Halaqoh Form
  const [halaqohNama, setHalaqohNama] = useState('');
  const [halaqohMusyrifId, setHalaqohMusyrifId] = useState('');

  // 3. Siswa Form
  const [siswaNoInduk, setSiswaNoInduk] = useState('');
  const [siswaNama, setSiswaNama] = useState('');
  const [siswaKelasId, setSiswaKelasId] = useState('');
  const [siswaHalaqohId, setSiswaHalaqohId] = useState('');

  // 4. Musyrif Form
  const [musyrifNim, setMusyrifNim] = useState('');
  const [musyrifNama, setMusyrifNama] = useState('');
  const [musyrifHalaqohId, setMusyrifHalaqohId] = useState('');
  const [musyrifUsername, setMusyrifUsername] = useState('');
  const [musyrifPassword, setMusyrifPassword] = useState('');

  // 5. Laporan Form
  const [selectedLaporanHalaqohId, setSelectedLaporanHalaqohId] = useState(halaqohs[0]?.id || '');

  // 6. Pengaturan Form
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');

  // Helpers
  const showFeedback = (text: string, type: 'success' | 'danger' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg({ text: '', type: 'success' }), 4000);
  };

  const closeFormModal = () => {
    setModalType(null);
    setEditId(null);
    // Reset forms
    setKelasNama('');
    setHalaqohNama('');
    setHalaqohMusyrifId('');
    setSiswaNoInduk('');
    setSiswaNama('');
    setSiswaKelasId('');
    setSiswaHalaqohId('');
    setMusyrifNim('');
    setMusyrifNama('');
    setMusyrifHalaqohId('');
    setMusyrifUsername('');
    setMusyrifPassword('');
  };

  // ----------------------------------------------------
  // SUBMIT HANDLERS
  // ----------------------------------------------------

  // 1. KELAS
  const handleKelasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kelasNama.trim()) return;
    setIsSaving(true);
    try {
      if (modalType === 'add') {
        await addDoc(collection(db, 'classes'), { nama: kelasNama.trim() });
        showFeedback('Berhasil menambah kelas baru!');
      } else if (modalType === 'edit' && editId) {
        await updateDoc(doc(db, 'classes', editId), { nama: kelasNama.trim() });
        // Update students with old class name
        const associatedStudents = students.filter(s => s.kelasId === editId);
        for (const s of associatedStudents) {
          await updateDoc(doc(db, 'students', s.id), { kelasNama: kelasNama.trim() });
        }
        showFeedback('Berhasil memperbarui kelas!');
      }
      await refreshData();
      closeFormModal();
    } catch (err: any) {
      showFeedback('Gagal menyimpan kelas: ' + err.message, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // 2. HALAQOH
  const handleHalaqohSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!halaqohNama.trim()) return;
    setIsSaving(true);
    try {
      // Find musyrif name based on selected ID
      const chosenMusyrif = musyrifs.find(m => m.id === halaqohMusyrifId);
      const mName = chosenMusyrif ? chosenMusyrif.nama : 'Belum Ditentukan';
      const mId = chosenMusyrif ? halaqohMusyrifId : '';

      if (modalType === 'add') {
        await addDoc(collection(db, 'halaqoh'), {
          nama: halaqohNama.trim(),
          musyrifId: mId,
          musyrifNama: mName
        });
        showFeedback('Berhasil menambah halaqoh baru!');
      } else if (modalType === 'edit' && editId) {
        await updateDoc(doc(db, 'halaqoh', editId), {
          nama: halaqohNama.trim(),
          musyrifId: mId,
          musyrifNama: mName
        });

        // Cascade updates: students and musyrif referencing this halaqoh
        const associatedStudents = students.filter(s => s.halaqohId === editId);
        for (const s of associatedStudents) {
          await updateDoc(doc(db, 'students', s.id), { halaqohNama: halaqohNama.trim() });
        }

        const associatedMusyrif = musyrifs.filter(m => m.halaqohId === editId);
        for (const m of associatedMusyrif) {
          await updateDoc(doc(db, 'musyrif', m.id), { halaqohNama: halaqohNama.trim() });
        }

        showFeedback('Berhasil memperbarui halaqoh!');
      }
      await refreshData();
      closeFormModal();
    } catch (err: any) {
      showFeedback('Gagal menyimpan halaqoh: ' + err.message, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // 3. SISWA
  const handleSiswaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siswaNoInduk.trim() || !siswaNama.trim() || !siswaKelasId) return;
    setIsSaving(true);
    try {
      const cls = classes.find(c => c.id === siswaKelasId);
      const hq = halaqohs.find(h => h.id === siswaHalaqohId);

      const payload = {
        noInduk: siswaNoInduk.trim(),
        nama: siswaNama.trim(),
        kelasId: siswaKelasId,
        kelasNama: cls ? cls.nama : '',
        halaqohId: siswaHalaqohId || '',
        halaqohNama: hq ? hq.nama : 'Belum Ada Halaqoh'
      };

      if (modalType === 'add') {
        await addDoc(collection(db, 'students'), payload);
        showFeedback('Berhasil menambah siswa baru!');
      } else if (modalType === 'edit' && editId) {
        await updateDoc(doc(db, 'students', editId), payload);
        showFeedback('Berhasil memperbarui profil siswa!');
      }
      await refreshData();
      closeFormModal();
    } catch (err: any) {
      showFeedback('Gagal menyimpan siswa: ' + err.message, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. PENGAJAR (MUSYRIF)
  const handleMusyrifSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musyrifNim.trim() || !musyrifNama.trim() || !musyrifUsername.trim()) return;
    setIsSaving(true);
    try {
      const hq = halaqohs.find(h => h.id === musyrifHalaqohId);
      
      const payload: any = {
        nim: musyrifNim.trim(),
        nama: musyrifNama.trim(),
        username: musyrifUsername.trim(),
        halaqohId: musyrifHalaqohId || '',
        halaqohNama: hq ? hq.nama : 'Belum Ditentukan'
      };
      
      // Only include password if set (or on add)
      if (musyrifPassword.trim()) {
        payload.password = musyrifPassword.trim();
      }

      if (modalType === 'add') {
        if (!musyrifPassword.trim()) {
          showFeedback('Password wajib diisi untuk pengajar baru!', 'danger');
          setIsSaving(false);
          return;
        }
        const docRef = await addDoc(collection(db, 'musyrif'), payload);

        // If a halaqoh was chosen, link it with this musyrif automatically
        if (musyrifHalaqohId) {
          await updateDoc(doc(db, 'halaqoh', musyrifHalaqohId), {
            musyrifId: docRef.id,
            musyrifNama: musyrifNama.trim()
          });
        }
        showFeedback('Berhasil menambah pengajar baru!');
      } else if (modalType === 'edit' && editId) {
        await updateDoc(doc(db, 'musyrif', editId), payload);

        // Link with selected halaqoh
        if (musyrifHalaqohId) {
          await updateDoc(doc(db, 'halaqoh', musyrifHalaqohId), {
            musyrifId: editId,
            musyrifNama: musyrifNama.trim()
          });
        }
        showFeedback('Berhasil memperbarui data pengajar!');
      }
      await refreshData();
      closeFormModal();
    } catch (err: any) {
      showFeedback('Gagal menyimpan data pengajar: ' + err.message, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // 5. DELETE HANDLERS
  const handleDeleteObj = async (collectionName: 'classes' | 'students' | 'musyrif' | 'halaqoh', id: string) => {
    const isConfirmed = window.confirm('Apakah Anda yakin ingin menghapus data ini secara permanen?');
    if (!isConfirmed) return;
    
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, collectionName, id));
      showFeedback('Data berhasil dihapus!');
      await refreshData();
    } catch (err: any) {
      showFeedback('Gagal menghapus data: ' + err.message, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // 6. CHANGE PASSWORD ADMIN
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPass !== adminPass) {
      showFeedback('Password saat ini salah!', 'danger');
      return;
    }
    if (!newPass || newPass !== confirmNewPass) {
      showFeedback('Konfirmasi password baru tidak cocok!', 'danger');
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'settings', 'admin'), {
        adminPassword: newPass.trim()
      });
      showFeedback('Password administrator berhasil diubah!');
      setCurrentPass('');
      setNewPass('');
      setConfirmNewPass('');
      await refreshData();
    } catch (err: any) {
      showFeedback('Gagal mengubah password: ' + err.message, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper getters to compute totals dynamically
  const getClassStudentCount = (kelasId: string) => {
    return students.filter(s => s.kelasId === kelasId).length;
  };

  const getHalaqohStudentCount = (hqId: string) => {
    return students.filter(s => s.halaqohId === hqId).length;
  };

  // Prepare reports data
  const reportStudents = students.filter(s => s.halaqohId === selectedLaporanHalaqohId);
  const activeHalaqoh = halaqohs.find(h => h.id === selectedLaporanHalaqohId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Admin Navigation bar */}
      <nav className="bg-emerald-900 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-700 border border-emerald-500 flex items-center justify-center">
                <Database className="w-5 h-5 text-emerald-100" />
              </div>
              <div>
                <span className="font-extrabold text-sm sm:text-base leading-none block uppercase">
                  HALAMAN ADMIN
                </span>
                <span className="text-xs text-emerald-300 font-semibold uppercase tracking-wider block">
                  MIN 6 SUKOHARJO
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="admin-logout-btn"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700/80 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition duration-150 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Admin Central Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-6">
        
        {/* Left Side menu sidebar (Responsive) */}
        <div className="w-full md:w-64 flex-none space-y-2">
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm space-y-1">
            <h4 className="text-xs font-bold text-slate-400 px-3 uppercase tracking-wider mb-2">MENU UTAMA</h4>
            
            {[
              { id: 'kelas', label: 'Data Kelas', icon: BookOpen },
              { id: 'siswa', label: 'Data Siswa', icon: Users },
              { id: 'pengajar', label: 'Data Pengajar', icon: UserCheck },
              { id: 'halaqoh', label: 'Data Halaqoh', icon: BookMarked },
              { id: 'laporan', label: 'Laporan Tahfidz', icon: FileText },
              { id: 'pengaturan', label: 'Pengaturan', icon: Settings }
            ].map(tab => {
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setFeedbackMsg({ text: '', type: 'success' });
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-emerald-50 text-emerald-800 shadow-xs border-l-4 border-emerald-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <IconComp className={`w-4 h-4 ${activeTab === tab.id ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-400 opacity-60" />
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs text-emerald-900">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <ShieldAlert className="w-4 h-4 text-emerald-700" />
              <span>Sesi Administrator</span>
            </div>
            <p className="text-emerald-700">Semua aksi tambah, edit, dan hapus langsung tersinkronisasi ke Firebase Database.</p>
          </div>
        </div>

        {/* Right Side Content Pane */}
        <div className="flex-1 bg-white border border-slate-150 p-6 rounded-3xl shadow-sm space-y-6">
          
          {feedbackMsg.text && (
            <div className={`p-4 rounded-xl text-xs font-semibold border ${
              feedbackMsg.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-250 text-rose-800'
            }`}>
              {feedbackMsg.text}
            </div>
          )}

          {/* TAB 1: KELAS */}
          {activeTab === 'kelas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">Daftar Kelas</h3>
                  <p className="text-xs text-slate-500">Kelola semua tingkatan kelas yang ada di MIN 6 Sukoharjo</p>
                </div>
                <button
                  onClick={() => {
                    setModalType('add');
                    setKelasNama('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Kelas</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-16">NO</th>
                      <th className="py-3.5 px-4">NAMA KELAS</th>
                      <th className="py-3.5 px-4 text-center">TOTAL SISWA KELAS INI</th>
                      <th className="py-3.5 px-4 text-right w-32">OPSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {classes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">Belum ada kelas. Klik Tambah Kelas di atas.</td>
                      </tr>
                    ) : (
                      classes.map((c, i) => (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-400">{i + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-950">{c.nama}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full font-bold text-[11px]">
                              {getClassStudentCount(c.id)} Siswa
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => {
                                  setModalType('edit');
                                  setEditId(c.id);
                                  setKelasNama(c.nama);
                                }}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer transition"
                                title="Edit Kelas"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteObj('classes', c.id)}
                                className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition"
                                title="Hapus Kelas"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: SISWA */}
          {activeTab === 'siswa' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">Daftar Siswa</h3>
                  <p className="text-xs text-slate-500">Kelola database siswa, no induk, dan pemetaan halaqoh</p>
                </div>
                <button
                  onClick={() => {
                    setModalType('add');
                    setSiswaNoInduk('');
                    setSiswaNama('');
                    setSiswaKelasId('');
                    setSiswaHalaqohId('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Siswa</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12">NO</th>
                      <th className="py-3.5 px-4 w-28">NO INDUK</th>
                      <th className="py-3.5 px-4">NAMA LENGKAP SISWA</th>
                      <th className="py-3.5 px-4">KELAS</th>
                      <th className="py-3.5 px-4">HALAQOH QUR'AN</th>
                      <th className="py-3.5 px-4 text-right w-24">OPSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">Belum ada data siswa.</td>
                      </tr>
                    ) : (
                      students.map((sys, idx) => (
                        <tr key={sys.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-800">{sys.noInduk}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{sys.nama}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium">
                              {sys.kelasNama || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full text-[11px]">
                              {sys.halaqohNama || 'Belum Ada Halaqoh'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex gap-1.5">
                              <button
                                onClick={() => {
                                  setModalType('edit');
                                  setEditId(sys.id);
                                  setSiswaNoInduk(sys.noInduk);
                                  setSiswaNama(sys.nama);
                                  setSiswaKelasId(sys.kelasId);
                                  setSiswaHalaqohId(sys.halaqohId);
                                }}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteObj('students', sys.id)}
                                className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PENGAJAR */}
          {activeTab === 'pengajar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">Daftar Pengajar (Musyrif)</h3>
                  <p className="text-xs text-slate-500">Kelola akun dan kredensial akses login Musyrif lapangan</p>
                </div>
                <button
                  onClick={() => {
                    setModalType('add');
                    setMusyrifNim('');
                    setMusyrifNama('');
                    setMusyrifHalaqohId('');
                    setMusyrifUsername('');
                    setMusyrifPassword('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pengajar</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12">NO</th>
                      <th className="py-3.5 px-4">NIM</th>
                      <th className="py-3.5 px-4">NAMA PENGAJAR</th>
                      <th className="py-3.5 px-4">HALAQOH AMPUAN</th>
                      <th className="py-3.5 px-4">USERNAME</th>
                      <th className="py-3.5 px-4">PASSWORD</th>
                      <th className="py-3.5 px-4 text-right w-24">OPSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {musyrifs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">Belum ada pengajar terdaftar.</td>
                      </tr>
                    ) : (
                      musyrifs.map((m, i) => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-400">{i + 1}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-800">{m.nim}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{m.nama}</td>
                          <td className="py-3 px-4 font-semibold text-emerald-800">
                            {m.halaqohNama || 'Belum Ditentukan'}
                          </td>
                          <td className="py-3 px-4 font-mono">{m.username}</td>
                          <td className="py-3 px-4 font-mono text-slate-400 select-all font-bold group hover:text-slate-700 transition" title="Klik untuk menyalin">
                            ⚡ {m.password || '●●●●●●'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex gap-1.5">
                              <button
                                onClick={() => {
                                  setModalType('edit');
                                  setEditId(m.id);
                                  setMusyrifNim(m.nim);
                                  setMusyrifNama(m.nama);
                                  setMusyrifHalaqohId(m.halaqohId);
                                  setMusyrifUsername(m.username);
                                  setMusyrifPassword(m.password || '');
                                }}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteObj('musyrif', m.id)}
                                className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: HALAQOH */}
          {activeTab === 'halaqoh' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">Daftar Halaqoh Qur'an</h3>
                  <p className="text-xs text-slate-500">Kelompok halaqoh, pengampu, serta jumlah keanggotaan santri</p>
                </div>
                <button
                  onClick={() => {
                    setModalType('add');
                    setHalaqohNama('');
                    setHalaqohMusyrifId('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Halaqoh</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12">NO</th>
                      <th className="py-3.5 px-4">NAMA HALAQOH</th>
                      <th className="py-3.5 px-4">MUSYRIF PENGAMPU</th>
                      <th className="py-3.5 px-4 text-center">JUMLAH SISWA</th>
                      <th className="py-3.5 px-4 text-right w-24">OPSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {halaqohs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">Belum ada halaqoh terdaftar.</td>
                      </tr>
                    ) : (
                      halaqohs.map((hp, index) => (
                        <tr key={hp.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-400">{index + 1}</td>
                          <td className="py-3 px-4 font-bold text-emerald-800">{hp.nama}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{hp.musyrifNama}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full font-bold text-[10px]">
                              {getHalaqohStudentCount(hp.id)} Santri
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex gap-1.5">
                              <button
                                onClick={() => {
                                  setModalType('edit');
                                  setEditId(hp.id);
                                  setHalaqohNama(hp.nama);
                                  setHalaqohMusyrifId(hp.musyrifId);
                                }}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteObj('halaqoh', hp.id)}
                                className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: LAPORAN TAHFIDZ */}
          {activeTab === 'laporan' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-extrabold text-slate-800">Laporan Rekonstruksi & Rekap Tahfidz</h3>
                <p className="text-xs text-slate-500">Filter berdasarkan Halaqoh untuk menampilkan seluruh data siswa bersangkutan</p>
              </div>

              {/* Filter Row */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 items-center">
                <div className="w-full sm:w-auto text-xs font-bold text-slate-600 shrink-0">
                  PILIH HALAQOH :
                </div>
                <select
                  value={selectedLaporanHalaqohId}
                  onChange={(e) => setSelectedLaporanHalaqohId(e.target.value)}
                  className="w-full sm:w-64 px-4 py-2 bg-white border border-slate-250 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="">-- Silahkan Pilih Halaqoh --</option>
                  {halaqohs.map(hq => (
                    <option key={hq.id} value={hq.id}>{hq.nama} ({hq.musyrifNama})</option>
                  ))}
                </select>
                
                {activeHalaqoh && (
                  <div className="text-xs text-slate-500 hidden sm:block">
                    Musyrif Pengampu: <strong>{activeHalaqoh.musyrifNama}</strong>
                  </div>
                )}
              </div>

              {selectedLaporanHalaqohId ? (
                <div className="space-y-6">
                  {/* Summary Metric Header */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">Total Anggota Halaqoh</div>
                      <div className="text-2xl font-black text-emerald-900 mt-1">{reportStudents.length} Siswa</div>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-600">Total Transaksi Setoran</div>
                      <div className="text-2xl font-black text-indigo-900 mt-1">
                        {journals.filter(j => j.halaqohId === selectedLaporanHalaqohId).length} Setoran
                      </div>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-amber-600">Peringkat Mumtaz (A)</div>
                      <div className="text-2xl font-black text-amber-900 mt-1">
                        {journals.filter(j => j.halaqohId === selectedLaporanHalaqohId && j.nilai === 'A').length} Kali
                      </div>
                    </div>
                  </div>

                  {/* List of Students & their Progress Reports */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Detail Perkembangan Perkembangan Per Siswa</h4>
                    
                    {reportStudents.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                        Tidak ada siswa terdaftar pada halaqoh ini.
                      </div>
                    ) : (
                      reportStudents.map((siswa, isDx) => {
                        // Gather history logs of this student
                        const baseHistory = journals.filter(j => j.siswaId === siswa.id);
                        
                        return (
                          <div key={siswa.id} className="p-5 bg-white border border-slate-100 shadow-xs rounded-2xl space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-50 pb-2">
                              <div>
                                <span className="text-[10px] font-mono text-slate-400">#{isDx + 1} | INDUK: {siswa.noInduk}</span>
                                <h5 className="font-extrabold text-sm text-slate-800 uppercase">{siswa.nama}</h5>
                              </div>
                              <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-100 self-start sm:self-auto">
                                Kelas: {siswa.kelasNama || 'Belum Diatur'}
                              </span>
                            </div>

                            {/* Setoran Logs History Ledger */}
                            <div className="space-y-2">
                              <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Histori Jurnal Setoran ({baseHistory.length}):</h6>
                              {baseHistory.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Belum ada catatan setoran harian untuk siswa ini.</p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2">
                                  {baseHistory.map(log => (
                                    <div key={log.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono font-bold text-slate-500">{log.tanggal}</span>
                                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                          log.nilai === 'A' ? 'bg-emerald-100 text-emerald-800' :
                                          log.nilai === 'B' ? 'bg-indigo-100 text-indigo-800' :
                                          log.nilai === 'C' ? 'bg-amber-150 text-amber-900' :
                                          log.nilai === 'D' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-rose-100 text-rose-800'
                                        }`}>
                                          Nilai: {log.nilai === 'A' ? 'Mumtaz (A)' : 
                                                 log.nilai === 'B' ? 'Jayyid Jidid (B)' : 
                                                 log.nilai === 'C' ? 'Jayyid (C)' : 
                                                 log.nilai === 'D' ? 'Maqbul (D)' : 'Rosib (E)'}
                                        </span>
                                      </div>
                                      <div><strong>Materi:</strong> <span className="text-slate-800">{log.materiSetoran}</span></div>
                                      <div className="text-slate-500 text-[11px] leading-relaxed">
                                        <strong>Evaluasi (Tahsin/Tajwid):</strong> {log.evaluasiTahsin}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-150 text-xs text-slate-400">
                  Silahkan pilih salah satu Halaqoh Qur'an di atas untuk melihat laporan.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PENGATURAN */}
          {activeTab === 'pengaturan' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-extrabold text-slate-800">Pengaturan Sistem</h3>
                <p className="text-xs text-slate-500">Ubah kredensial password login administrator utama</p>
              </div>

              <div className="max-w-md bg-slate-50 border border-slate-100 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>Ubah Password Administrator</span>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Password Saat Ini</label>
                    <input
                      type="password"
                      required
                      placeholder="Masukkan password admin lama"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Password Baru</label>
                    <input
                      type="password"
                      required
                      placeholder="Masukkan password admin baru"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 block">Ulangi Password Baru</label>
                    <input
                      type="password"
                      required
                      placeholder="Konfirmasi password baru"
                      value={confirmNewPass}
                      onChange={(e) => setConfirmNewPass(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Password Administrator</span>
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* POPUP FORMS MODALS (Reusable layout) */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col">
            
            {/* Modal Head */}
            <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold uppercase">
                  {modalType === 'add' ? 'Tambah Data Baru' : 'Perbaharui Data Tertunjuk'}
                </h3>
                <p className="text-[10px] text-emerald-200 mt-0.5">Sesi Formulir Database Admin</p>
              </div>
              <button
                onClick={closeFormModal}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-6 overflow-y-auto max-h-[80vh] space-y-4">
              
              {/* 1. KELAS FORM BODY */}
              {activeTab === 'kelas' && (
                <form onSubmit={handleKelasSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Nama Kelas</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Kelas 1A, Kelas 6B"
                      value={kelasNama}
                      onChange={(e) => setKelasNama(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition animate-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Data Kelas'}
                  </button>
                </form>
              )}

              {/* 2. HALAQOH FORM BODY */}
              {activeTab === 'halaqoh' && (
                <form onSubmit={handleHalaqohSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Nama Halaqoh</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Halaqoh Al-Fatihah, Halaqoh An-Naba"
                      value={halaqohNama}
                      onChange={(e) => setHalaqohNama(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Musyrif Pengampu (Opsional)</label>
                    <select
                      value={halaqohMusyrifId}
                      onChange={(e) => setHalaqohMusyrifId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                    >
                      <option value="">-- Pilih Musyrif --</option>
                      {musyrifs.map(m => (
                        <option key={m.id} value={m.id}>{m.nama} (username: {m.username})</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Data Halaqoh'}
                  </button>
                </form>
              )}

              {/* 3. SISWA FORM BODY */}
              {activeTab === 'siswa' && (
                <form onSubmit={handleSiswaSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">No Induk Siswa</label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan No Induk Siswa"
                      value={siswaNoInduk}
                      onChange={(e) => setSiswaNoInduk(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Nama Lengkap Siswa</label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama lengkap siswa"
                      value={siswaNama}
                      onChange={(e) => setSiswaNama(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Kategori Tingkat Kelas</label>
                    <select
                      required
                      value={siswaKelasId}
                      onChange={(e) => setSiswaKelasId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Halaqoh Qur'an (Opsional)</label>
                    <select
                      value={siswaHalaqohId}
                      onChange={(e) => setSiswaHalaqohId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                    >
                      <option value="">-- Pilih Halaqoh --</option>
                      {halaqohs.map(h => (
                        <option key={h.id} value={h.id}>{h.nama}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Data Siswa'}
                  </button>
                </form>
              )}

              {/* 4. PENGAJAR (MUSYRIF) FORM BODY */}
              {activeTab === 'pengajar' && (
                <form onSubmit={handleMusyrifSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">NIM Pengajar</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: 202601001"
                        value={musyrifNim}
                        onChange={(e) => setMusyrifNim(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">Nama Lengkap</label>
                      <input
                        type="text"
                        required
                        placeholder="Masukkan nama lengkap"
                        value={musyrifNama}
                        onChange={(e) => setMusyrifNama(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Halaqoh Pengampu (Opsional)</label>
                    <select
                      value={musyrifHalaqohId}
                      onChange={(e) => setMusyrifHalaqohId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                    >
                      <option value="">-- Pilih Halaqoh --</option>
                      {halaqohs.map(h => (
                        <option key={h.id} value={h.id}>{h.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-2 border-t border-slate-100 pt-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">Username Login</label>
                      <input
                        type="text"
                        required
                        placeholder="Ketik username"
                        value={musyrifUsername}
                        onChange={(e) => setMusyrifUsername(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">
                        Password Login {modalType === 'edit' && '(Opsional)'}
                      </label>
                      <input
                        type="text"
                        required={modalType === 'add'}
                        placeholder={modalType === 'add' ? 'Ketik password login' : 'Ketik baru jika diganti'}
                        value={musyrifPassword}
                        onChange={(e) => setMusyrifPassword(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Data Pengajar'}
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
