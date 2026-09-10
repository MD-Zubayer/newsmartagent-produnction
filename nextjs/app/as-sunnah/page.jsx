"use client";

import { useEffect, useMemo, useState } from "react";

const API = "/api/assunnah";
const emptyForm = {
  entry_language: "bn",
  dakhila_no: "", name: "", father_name: "", village: "", thana: "",
  district: "", mobile_number: "", blood_group: "", education_period: "",
};

const hasArabic = (value) => /[\u0600-\u06FF]/.test(String(value || ""));
const textDirection = (value) => hasArabic(value) ? "rtl" : "ltr";
const detectedLanguage = (values) => Object.values(values).some(hasArabic) ? "ar" : "bn";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "অনুরোধটি সম্পন্ন করা যায়নি");
  }
  return response;
}

export default function AsSunnahPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [districts, setDistricts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [entryMode, setEntryMode] = useState("single");
  const [bulkRows, setBulkRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    const [stateResponse, districtResponse, entryResponse] = await Promise.all([
      request("/state/"), request("/districts/"), request("/entries/"),
    ]);
    const state = await stateResponse.json();
    setExpiresAt(state.expires_at);
    const loadedDistricts = await districtResponse.json();
    setDistricts(loadedDistricts);
    setEntries(await entryResponse.json());
    const lastDistrict = window.localStorage.getItem("as_sunnah_last_district");
    if (lastDistrict && loadedDistricts.some((district) => String(district.id) === lastDistrict)) {
      setForm((old) => ({ ...old, district: lastDistrict }));
    }
  };

  useEffect(() => {
    request("/state/").then(async (response) => {
      const state = await response.json();
      setAuthenticated(true);
      setExpiresAt(state.expires_at);
      loadData().catch((err) => setError(err.message));
    }).catch(() => {});
  }, []);

  const submitPassword = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const response = await request("/password/", { method: "POST", body: JSON.stringify({ password }) });
      const data = await response.json();
      setAuthenticated(true);
      setExpiresAt(data.expires_at);
      setPassword("");
      await loadData();
    } catch (err) { setError(err.message); }
  };

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const updateDistrict = (event) => {
    const value = event.target.value;
    setForm({ ...form, district: value });
    if (value) window.localStorage.setItem("as_sunnah_last_district", value);
  };

  const newBulkRow = () => ({ dakhila_no: "", name: "", father_name: "", village: "", thana: "", mobile_number: "", blood_group: "", education_period: "" });

  const updateBulkRow = (index, field, value) => {
    setBulkRows((old) => old.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const saveBulkEntries = async () => {
    const filledRows = bulkRows.filter((row) => Object.values(row).some((value) => String(value).trim()));
    if (!form.district) { setError("Bulk entry-এর আগে জেলা নির্বাচন করুন"); return; }
    if (!filledRows.length) { setError("কমপক্ষে একটি row পূরণ করুন"); return; }
    setLoading(true); setError("");
    try {
      const response = await request("/entries/bulk/", {
        method: "POST",
        body: JSON.stringify({ entries: filledRows.map((row) => ({ ...row, district: form.district, entry_language: detectedLanguage(row, form.entry_language) })) }),
      });
      const saved = await response.json();
      setEntries((old) => [...saved, ...old]);
      setBulkRows(Array.from({ length: 5 }, newBulkRow));
      window.localStorage.setItem("as_sunnah_last_district", form.district);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const submitEntry = async (event) => {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const payload = { ...form, entry_language: detectedLanguage(form, form.entry_language) };
      const response = await request(editingId ? `/entries/${editingId}/` : "/entries/", {
        method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload),
      });
      const saved = await response.json();
      setEntries((old) => editingId ? old.map((entry) => entry.id === saved.id ? saved : entry) : [saved, ...old]);
      setForm({ ...emptyForm, district: String(saved.district), entry_language: saved.entry_language });
      window.localStorage.setItem("as_sunnah_last_district", String(saved.district));
      setEditingId(null);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const addDistrict = async (event) => {
    event.preventDefault();
    if (!newDistrict.trim()) return;
    try {
      const response = await request("/districts/", { method: "POST", body: JSON.stringify({ name: newDistrict.trim() }) });
      const district = await response.json();
      setDistricts((old) => [...old.filter((item) => item.id !== district.id), district].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((old) => ({ ...old, district: String(district.id) }));
      window.localStorage.setItem("as_sunnah_last_district", String(district.id));
      setNewDistrict("");
    } catch (err) { setError(err.message); }
  };

  const deleteEntry = async (id) => {
    if (!confirm("এই তথ্যটি মুছে ফেলবেন?")) return;
    try { await request(`/entries/${id}/`, { method: "DELETE" }); setEntries((old) => old.filter((entry) => entry.id !== id)); }
    catch (err) { setError(err.message); }
  };

  const download = async (language) => {
    try {
      const response = await request(`/export/?language=${language}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = language === "ar" ? "as-sunnah-arabic.docx" : "as-sunnah-bangla.docx"; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  };

  const visibleEntries = useMemo(() => entries.filter((entry) => {
    const matchesDistrict = !districtFilter || String(entry.district) === districtFilter;
    const value = `${entry.dakhila_no} ${entry.name} ${entry.mobile_number}`.toLowerCase();
    return matchesDistrict && value.includes(search.toLowerCase());
  }).sort((a, b) => {
    const left = Number(a.dakhila_no), right = Number(b.dakhila_no);
    return (Number.isNaN(left) || Number.isNaN(right)) ? a.dakhila_no.localeCompare(b.dakhila_no) : left - right;
  }), [entries, search, districtFilter]);

  if (!authenticated) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <form onSubmit={submitPassword} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-slate-900">As-Sunnah Data Collection</h1>
        <p className="text-sm text-slate-500 mt-2">এই পেজে প্রবেশের জন্য password দিন। Data ৬০ দিন পর automatic delete হবে।</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Access password" className="mt-6 w-full border rounded-xl px-4 py-3" required />
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        <button className="mt-4 w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold">প্রবেশ করুন</button>
      </form>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div><h1 className="text-3xl font-bold text-slate-900">As-Sunnah</h1><p className="text-sm text-slate-500">মেয়াদ শেষ: {expiresAt ? new Date(expiresAt).toLocaleDateString("bn-BD") : "—"}</p></div>
          <div className="flex gap-2"><button onClick={() => download("ar")} className="rounded-xl bg-amber-600 text-white px-4 py-2">Arabic DOCX</button><button onClick={() => download("bn")} className="rounded-xl bg-emerald-600 text-white px-4 py-2">Bangla DOCX</button></div>
        </div>
        {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 p-3">{error}</div>}
        <div className="flex gap-2 mb-4"><button onClick={() => { setEntryMode("single"); setEditingId(null); }} className={`rounded-xl px-4 py-2 ${entryMode === "single" ? "bg-indigo-600 text-white" : "bg-white text-slate-700"}`}>Single Entry</button><button onClick={() => { setEntryMode("bulk"); setEditingId(null); if (!bulkRows.length) setBulkRows(Array.from({ length: 5 }, newBulkRow)); }} className={`rounded-xl px-4 py-2 ${entryMode === "bulk" ? "bg-indigo-600 text-white" : "bg-white text-slate-700"}`}>Bulk Entry</button></div>
        <section className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          {entryMode === "single" ? <>
          <h2 className="font-bold text-lg mb-4">{editingId ? "তথ্য পরিবর্তন করুন" : "নতুন তথ্য যোগ করুন"}</h2>
          <form onSubmit={submitEntry} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select name="entry_language" value={form.entry_language} onChange={updateField} className="border rounded-xl px-3 py-2.5"><option value="bn">বাংলা এন্ট্রি</option><option value="ar">আরবি এন্ট্রি</option></select>
            {[["dakhila_no","দাখিলা নং"],["name","নাম"],["father_name","বাবার নাম"],["village","গ্রাম"],["thana","থানা/উপজেলা"],["mobile_number","মোবাইল নম্বর"],["education_period","শিক্ষাকাল/শিক্ষাবর্ষ"]].map(([name,label]) => <input key={name} name={name} value={form[name]} onChange={updateField} placeholder={label} className="border rounded-xl px-3 py-2.5" required={!["education_period"].includes(name)} />)}
            <select name="district" value={form.district} onChange={updateDistrict} className="border rounded-xl px-3 py-2.5" required><option value="">জেলা নির্বাচন করুন</option>{districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select>
            <select name="blood_group" value={form.blood_group} onChange={updateField} className="border rounded-xl px-3 py-2.5"><option value="">রক্তের গ্রুপ</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((group) => <option key={group}>{group}</option>)}</select>
            <div className="flex gap-2"><button disabled={loading} className="flex-1 rounded-xl bg-indigo-600 text-white py-2.5">{loading ? "Saving..." : editingId ? "Update" : "Save"}</button>{editingId && <button type="button" onClick={() => {setEditingId(null); setForm({ ...emptyForm, district: form.district, entry_language: form.entry_language });}} className="rounded-xl bg-slate-200 px-4">Cancel</button>}</div>
          </form>
          <form onSubmit={addDistrict} className="flex gap-2 mt-4 max-w-md"><input value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} placeholder="নতুন জেলা যোগ করুন" className="border rounded-xl px-3 py-2.5 flex-1" /><button className="rounded-xl bg-slate-800 text-white px-4">জেলা যোগ</button></form>
          </> : <>
          <div className="flex flex-wrap gap-3 mb-4"><select value={form.entry_language} onChange={updateField} name="entry_language" className="border rounded-xl px-3 py-2.5"><option value="bn">বাংলা এন্ট্রি</option><option value="ar">আরবি এন্ট্রি</option></select><select value={form.district} onChange={updateDistrict} className="border rounded-xl px-3 py-2.5"><option value="">Bulk-এর জেলা নির্বাচন করুন</option>{districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select><button type="button" onClick={() => setBulkRows((old) => [...old, newBulkRow()])} className="rounded-xl bg-slate-800 text-white px-4">+ Row যোগ করুন</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b text-left">{[["dakhila_no","দাখিলা"],["name","নাম"],["father_name","বাবার নাম"],["village","গ্রাম"],["thana","থানা"],["mobile_number","মোবাইল"],["blood_group","রক্তের গ্রুপ"],["education_period","শিক্ষাকাল"]].map(([, label]) => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{bulkRows.map((row, index) => <tr key={index} className="border-b">{["dakhila_no","name","father_name","village","thana","mobile_number","blood_group","education_period"].map((field) => <td key={field} className="p-1"><input value={row[field]} onChange={(event) => updateBulkRow(index, field, event.target.value)} placeholder={field === "dakhila_no" ? `${index + 1}` : ""} className="w-full border rounded-lg px-2 py-2" /></td>)}</tr>)}</tbody></table></div>
          <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => setBulkRows(Array.from({ length: 5 }, newBulkRow))} className="rounded-xl bg-slate-200 px-4 py-2">Clear Rows</button><button type="button" disabled={loading} onClick={saveBulkEntries} className="rounded-xl bg-indigo-600 text-white px-5 py-2">{loading ? "Saving..." : "সব Entry Save করুন"}</button></div>
          <form onSubmit={addDistrict} className="flex gap-2 mt-4 max-w-md"><input value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} placeholder="নতুন জেলা যোগ করুন" className="border rounded-xl px-3 py-2.5 flex-1" /><button className="rounded-xl bg-slate-800 text-white px-4">জেলা যোগ</button></form>
          </>}
        </section>
        <section className="bg-white rounded-2xl shadow-sm p-5 overflow-x-auto">
          <div className="flex flex-wrap gap-3 mb-4"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম/দাখিলা/মোবাইল search" className="border rounded-xl px-3 py-2.5 flex-1 min-w-56" /><select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} className="border rounded-xl px-3 py-2.5"><option value="">সব জেলা</option>{districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select></div>
          <table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-3">দাখিলা</th><th className="p-3">নাম</th><th className="p-3">বাবার নাম</th><th className="p-3">জেলা</th><th className="p-3">মোবাইল</th><th className="p-3">Action</th></tr></thead><tbody>{visibleEntries.map((entry) => <tr key={entry.id} className="border-b last:border-0"><td className="p-3">{entry.dakhila_no}</td><td className="p-3">{entry.name}</td><td className="p-3">{entry.father_name}</td><td className="p-3">{entry.district_name}</td><td className="p-3">{entry.mobile_number}</td><td className="p-3 whitespace-nowrap"><button onClick={() => {setEditingId(entry.id); setForm({...entry, district: String(entry.district)});}} className="text-indigo-600 mr-3">Edit</button><button onClick={() => deleteEntry(entry.id)} className="text-red-600">Delete</button></td></tr>)}</tbody></table>
          {!visibleEntries.length && <p className="text-center text-slate-500 py-8">কোনো তথ্য পাওয়া যায়নি</p>}
        </section>
      </div>
    </main>
  );
}
