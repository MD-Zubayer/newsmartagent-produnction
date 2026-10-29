"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API = "/api/assunnah";
const emptyForm = {
  entry_language: "bn",
  dakhila_no: "", name: "", father_name: "", village: "", thana: "",
  district: "", mobile_number: "", blood_group: "", education_period: "",
};
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const hasArabic = (value) => /[\u0600-\u06FF]/.test(String(value || ""));
const textDirection = (value) => hasArabic(value) ? "rtl" : "ltr";
const detectedLanguage = (values) => Object.values(values).some(hasArabic) ? "ar" : "bn";
const normalizeDigits = (value) => String(value || "").replace(/[০-৯]/g, (digit) => "০১২৩৪৫৬৭৮৯".indexOf(digit)).replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
const toBanglaDigits = (value) => String(normalizeDigits(value)).replace(/[0-9]/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);
const normalizeBloodGroup = (value) => ({ "+B": "B+", "+A": "A+", "+AB": "AB+", "+O": "O+", "-B": "B-", "-A": "A-", "-AB": "AB-", "-O": "O-" }[String(value || "").replace(/\s/g, "").toUpperCase()] || String(value || "").trim());
const normalizeEntryNumbers = (entry) => ({ ...entry, dakhila_no: normalizeDigits(entry.dakhila_no), mobile_number: normalizeDigits(entry.mobile_number), education_period: normalizeDigits(entry.education_period), blood_group: normalizeBloodGroup(entry.blood_group) });

function DakhilaStatus({ status }) {
  if (!status) return null;
  const available = status === "available";
  return (
    <span
      title={available ? "এই দাখিলা আগে entry করা হয়নি" : "এই দাখিলা আগে entry করা হয়েছে"}
      aria-label={available ? "দাখিলা নম্বর নতুন" : "দাখিলা নম্বর আগে entry করা হয়েছে"}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold ${available ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
    >
      {available ? "✓" : "×"}
    </span>
  );
}

const autoFields = ["dakhila_no", "name", "father_name", "village", "thana", "mobile_number", "blood_group", "education_period"];
const autoLabels = { dakhila_no: "দাখিলা", name: "নাম", father_name: "বাবার নাম", village: "গ্রাম", thana: "থানা/উপজেলা", mobile_number: "মোবাইল", blood_group: "রক্তের গ্রুপ", education_period: "শিক্ষাকাল" };

function AdminPromptSettings({ onLogout }) {
  const [prompts, setPrompts] = useState(null);
  const [feature, setFeature] = useState("auto_field_fill");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { request("/admin/prompts/").then((response) => response.json()).then(setPrompts).catch((err) => setMessage(err.message)); }, []);
  const current = prompts?.[feature];
  const updateCurrent = (key, value) => setPrompts((old) => ({ ...old, [feature]: { ...old[feature], [key]: value } }));
  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const response = await request("/admin/prompts/", { method: "PUT", body: JSON.stringify({ feature, mode: current.mode, custom_prompt: current.custom_prompt }) });
      const saved = await response.json(); setPrompts((old) => ({ ...old, [feature]: saved })); setMessage("Prompt save হয়েছে");
    } catch (err) { setMessage(err.message); } finally { setSaving(false); }
  };
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-lg">🔐 AI Prompt Settings</h2><p className="text-xs text-slate-500">শুধু admin session-এ prompt পরিবর্তন করা যাবে</p></div><button onClick={onLogout} className="rounded-xl bg-slate-200 px-3 py-2 text-sm">Admin Logout</button></div>
    {!current ? <p className="mt-4 text-sm text-slate-500">Prompt loading...</p> : <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2"><button onClick={() => setFeature("auto_field_fill")} className={`rounded-xl px-3 py-2 text-sm ${feature === "auto_field_fill" ? "bg-blue-600 text-white" : "bg-white"}`}>✨ Auto Field Fill Prompt</button><button onClick={() => setFeature("arabic_check")} className={`rounded-xl px-3 py-2 text-sm ${feature === "arabic_check" ? "bg-violet-600 text-white" : "bg-white"}`}>ع Arabic Check Prompt</button></div>
      <label className="block text-sm font-semibold">Default System Prompt <textarea value={current.default_prompt} readOnly rows={3} className="mt-1 w-full rounded-xl border bg-white p-3 text-xs text-slate-600" /></label>
      <label className="block text-sm font-semibold">Custom System Prompt <textarea value={current.custom_prompt} onChange={(event) => updateCurrent("custom_prompt", event.target.value)} rows={4} placeholder="অতিরিক্ত instruction লিখুন..." className="mt-1 w-full rounded-xl border bg-white p-3 text-sm" /></label>
      <div className="flex flex-wrap items-center gap-3"><select value={current.mode} onChange={(event) => updateCurrent("mode", event.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value="default">Use Default</option><option value="append">Append Custom</option><option value="replace">Replace Default</option></select><button onClick={save} disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">{saving ? "Saving..." : "Save Prompt"}</button>{message && <span className="text-sm text-slate-600">{message}</span>}</div>
      <details><summary className="cursor-pointer text-sm font-semibold text-slate-700">Effective Prompt Preview</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{current.effective_prompt}</pre></details>
    </div>}
  </section>;
}

function AutoFieldFillPanel({ districts, entryLanguage, onApproved }) {
  const [rawText, setRawText] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const updateRecord = (index, field, value) => setRecords((old) => old.map((record, rowIndex) => rowIndex === index ? { ...record, [field]: value } : record));
  const analyze = async () => { setLoading(true); setMessage(""); try { const response = await request("/auto-fill/analyze/", { method: "POST", body: JSON.stringify({ raw_text: rawText }) }); const data = await response.json(); setRecords((data.records || []).map((record) => ({ ...record, mobile_number: toBanglaDigits(record.mobile_number), education_period: toBanglaDigits(record.education_period) }))); } catch (err) { setMessage(err.message); } finally { setLoading(false); } };
  const approve = async () => {
    const entries = records.map((record) => ({ ...normalizeEntryNumbers(record), district: record.district || undefined, district_name: record.district_name || "", entry_language: "bn" }));
    setLoading(true); setMessage(""); try { const response = await request("/auto-fill/approve/", { method: "POST", body: JSON.stringify({ entries }) }); onApproved(await response.json()); setRecords([]); setRawText(""); setMessage("Approved data entry হয়েছে"); } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };
  return <div className="space-y-4"><div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">✨ <b>AI Auto Field Fill</b> — একসাথে raw data দিন। AI শুধু draft বানাবে; আপনার edit ও approve ছাড়া database-এ যোগ হবে না।</div><textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={6} placeholder="যেমন: দাখিলা ১২৩, নাম আব্দুল্লাহ, বাবার নাম আব্দুর রহমান, গ্রাম কাওনা, থানা মির্জাপুর, মোবাইল..." className="w-full rounded-xl border p-3" /><button onClick={analyze} disabled={loading || !rawText.trim()} className="rounded-xl bg-blue-600 px-5 py-2.5 text-white">{loading ? "GPT-4o বিশ্লেষণ করছে..." : "✨ Analyze with GPT-4o"}</button>{message && <p className="text-sm text-slate-600">{message}</p>}
    {records.map((record, index) => <div key={index} className="rounded-2xl border border-blue-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><b>Draft Row {index + 1}</b><span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">Arabic match · Review before approve</span></div><div className="grid grid-cols-1 gap-3 md:grid-cols-3">{autoFields.map((field) => <label key={field} className="text-xs font-semibold text-slate-600">{autoLabels[field]}<input value={record[field] || ""} onChange={(event) => updateRecord(index, field, event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>)}<label className="text-xs font-semibold text-slate-600">জেলা<input value={record.district_name || ""} onChange={(event) => updateRecord(index, "district_name", event.target.value)} placeholder="AI শনাক্ত করবে" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label></div></div>)}
    {!!records.length && <button onClick={approve} disabled={loading} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-white">✅ Approve & Add All Rows</button>}
  </div>;
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (Array.isArray(data) ? data.map((row) => Object.entries(row || {}).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`).join("; ")).join(" | ") : Object.entries(data).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`).join("; "));
    throw new Error(detail || `অনুরোধটি সম্পন্ন করা যায়নি (Status: ${response.status})`);
  }
  return response;
}

export default function AsSunnahPage() {
  const [form, setForm] = useState(emptyForm);
  const [districts, setDistricts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [districtDrafts, setDistrictDrafts] = useState({});
  const [mappingTargets, setMappingTargets] = useState({});
  const [expiresAt, setExpiresAt] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [entryMode, setEntryMode] = useState("single");
  const [bulkRows, setBulkRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestionEntry, setSuggestionEntry] = useState(null);
  const [arabicSource, setArabicSource] = useState(null);
  const [districtResolving, setDistrictResolving] = useState(false);
  const lastDistrictResolveKey = useRef("");
  const latestArabicLookup = useRef("");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPromptOpen, setAdminPromptOpen] = useState(false);
  const arabicForm = form.entry_language === "ar";
  const districtLabel = (district) => arabicForm ? (district.arabic_name || district.name) : (district.display_name || district.name);
  const fieldLabels = arabicForm
    ? { dakhila_no: "رقم التسجيل", name: "الاسم", father_name: "اسم الأب", village: "القرية", thana: "المركز", mobile_number: "رقم الهاتف", education_period: "عدد سنوات الدراسة" }
    : { dakhila_no: "দাখিলা নং", name: "নাম", father_name: "বাবার নাম", village: "গ্রাম", thana: "থানা/উপজেলা", mobile_number: "মোবাইল নম্বর", education_period: "শিক্ষাকাল (কত বছর)" };

  const loadData = async () => {
    const [stateResponse, districtResponse, entryResponse] = await Promise.all([
      request("/state/"), request("/districts/"), request("/entries/"),
    ]);
    const state = await stateResponse.json();
    setExpiresAt(state.expires_at);
    const loadedDistricts = await districtResponse.json();
    setDistricts(loadedDistricts);
    setDistrictDrafts(Object.fromEntries(loadedDistricts.map((district) => [district.id, { name: district.name, name_bn: district.name_bn || district.display_name || "" }])));
    setEntries(await entryResponse.json());
    const lastDistrict = window.localStorage.getItem("as_sunnah_last_district");
    if (lastDistrict && loadedDistricts.some((district) => String(district.id) === lastDistrict)) {
      setForm((old) => ({ ...old, district: lastDistrict }));
    }
  };

  useEffect(() => {
    loadData().catch((err) => setError(err.message));
    request("/admin/status/").then((response) => response.json()).then((data) => setAdminAuthenticated(data.authenticated)).catch(() => {});
  }, []);

  useEffect(() => {
    const lookupKey = normalizeDigits(form.dakhila_no).trim();
    latestArabicLookup.current = lookupKey;
    if (form.entry_language !== "bn" || editingId || !form.dakhila_no.trim()) {
      if (!form.dakhila_no.trim()) setArabicSource(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await request(`/entries/arabic-source/?dakhila_no=${encodeURIComponent(lookupKey)}`);
        const source = await response.json();
        if (latestArabicLookup.current !== lookupKey) return;
        setArabicSource(source);
        setForm((old) => ({ ...old, mobile_number: source.mobile_number ? toBanglaDigits(source.mobile_number) : old.mobile_number, blood_group: source.blood_group ? normalizeBloodGroup(source.blood_group) : old.blood_group, education_period: source.education_period ? toBanglaDigits(source.education_period) : old.education_period, district: String(source.district.id) }));
        setDistricts((old) => old.some((item) => item.id === source.district.id) ? old.map((item) => item.id === source.district.id ? { ...item, ...source.district } : item) : [...old, source.district].sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name)));
      } catch (err) {
        if (!err.message.includes("Arabic entry পাওয়া যায়নি")) setError(err.message);
        setArabicSource(null);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [form.entry_language, form.dakhila_no, editingId]);

  useEffect(() => {
    if (form.entry_language !== "bn" || editingId || arabicSource || form.district || !form.name.trim() || !form.village.trim()) return undefined;
    const resolveKey = [form.name, form.father_name, form.village, form.thana].join("|");
    if (lastDistrictResolveKey.current === resolveKey) return undefined;
    lastDistrictResolveKey.current = resolveKey;
    const timer = setTimeout(async () => {
      setDistrictResolving(true);
      try {
        const response = await request("/districts/resolve/", { method: "POST", body: JSON.stringify({ name: form.name, father_name: form.father_name, village: form.village, thana: form.thana }) });
        const data = await response.json();
        if (data.district) {
          setDistricts((old) => [...old.filter((item) => item.id !== data.district.id), data.district].sort((a, b) => a.name.localeCompare(b.name)));
          setForm((old) => ({ ...old, district: String(data.district.id) }));
        }
      } catch (err) { setError(err.message); } finally { setDistrictResolving(false); }
    }, 900);
    return () => clearTimeout(timer);
  }, [form.entry_language, form.name, form.father_name, form.village, form.thana, form.district, form.dakhila_no, editingId, arabicSource]);

  const adminLogin = async () => {
    try { await request("/admin/login/", { method: "POST", body: JSON.stringify({ password: adminPassword }) }); setAdminAuthenticated(true); setAdminPassword(""); setAdminPromptOpen(true); }
    catch (err) { setError(err.message); }
  };
  const adminLogout = async () => { await request("/admin/logout/", { method: "POST" }).catch(() => {}); setAdminAuthenticated(false); setAdminPromptOpen(false); };
  const addApprovedEntries = (saved) => setEntries((old) => [...saved, ...old]);

  const updateField = (event) => {
    const { name, value } = event.target;
    if (name === "dakhila_no" && form.entry_language === "bn") {
      setArabicSource(null);
      setForm({ ...form, dakhila_no: value, mobile_number: "", blood_group: "", education_period: "", district: "" });
      return;
    }
    setForm({ ...form, [name]: value });
  };

  const updateDistrict = (event) => {
    const value = event.target.value;
    setForm({ ...form, district: value });
    if (value) window.localStorage.setItem("as_sunnah_last_district", value);
  };

  const getDakhilaStatus = (value, entryLanguage = form.entry_language, ignoredEntryId = null) => {
    const dakhila = normalizeDigits(value).trim();
    if (!dakhila) return null;
    const alreadyExists = entries.some((entry) => entry.id !== ignoredEntryId && entry.entry_language === entryLanguage && normalizeDigits(entry.dakhila_no).trim() === dakhila);
    return alreadyExists ? "duplicate" : "available";
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
        body: JSON.stringify({ entries: filledRows.map((row) => ({ ...normalizeEntryNumbers(row), district: form.district, entry_language: detectedLanguage(row, form.entry_language) })) }),
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
      const payload = { ...normalizeEntryNumbers(form), entry_language: detectedLanguage(form, form.entry_language) };
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

  const updateDistrictDraft = (id, field, value) => setDistrictDrafts((old) => ({ ...old, [id]: { ...old[id], [field]: value } }));

  const saveDistrict = async (district) => {
    try {
      const draft = districtDrafts[district.id] || district;
      const response = await request("/districts/" + district.id + "/", { method: "PATCH", body: JSON.stringify({ name: draft.name, name_bn: draft.name_bn }) });
      const updated = await response.json();
      setDistricts((old) => old.map((item) => item.id === updated.id ? updated : item));
      setDistrictDrafts((old) => ({ ...old, [updated.id]: { name: updated.name, name_bn: updated.name_bn || updated.display_name || "" } }));
    } catch (err) { setError(err.message); }
  };

  const mapDistrictEntries = async (district) => {
    const target = mappingTargets[district.id];
    if (!target) { setError("Target district নির্বাচন করুন"); return; }
    try {
      const response = await request("/districts/" + district.id + "/map/", { method: "POST", body: JSON.stringify({ target_district: target }) });
      const result = await response.json();
      await loadData();
      setError("Arabic ও Bangla district link হয়েছে; " + result.merged + "টি entry একই district-এ যুক্ত হয়েছে");
    } catch (err) { setError(err.message); }
  };

  const deleteDistrict = async (district) => {
    if (!confirm("এই district delete করবেন? Entry থাকলে target district-এ map হবে।")) return;
    try {
      await request("/districts/" + district.id + "/", { method: "DELETE", body: JSON.stringify({ replacement_district: mappingTargets[district.id] || "" }) });
      setDistricts((old) => old.filter((item) => item.id !== district.id));
      setEntries((old) => old.map((entry) => String(entry.district) === String(district.id) && mappingTargets[district.id] ? { ...entry, district: Number(mappingTargets[district.id]) } : entry));
    } catch (err) { setError(err.message); }
  };

  const deleteEntry = async (id) => {
    if (!confirm("এই তথ্যটি মুছে ফেলবেন?")) return;
    try { await request(`/entries/${id}/`, { method: "DELETE" }); setEntries((old) => old.filter((entry) => entry.id !== id)); }
    catch (err) { setError(err.message); }
  };

  const runArabicCorrection = async () => {
    const arabicIds = entries.filter((entry) => entry.entry_language === "ar" && ["not_checked", "rejected"].includes(entry.correction_status)).map((entry) => entry.id);
    if (!arabicIds.length) { setError("নতুন checking-এর জন্য কোনো Arabic entry নেই; approved ও pending suggestion skip করা হয়েছে"); return; }
    setCorrectionLoading(true); setError("");
    try {
      const response = await request("/corrections/", { method: "POST", body: JSON.stringify({ entry_ids: arabicIds }) });
      const corrected = await response.json();
      const byId = Object.fromEntries(corrected.map((entry) => [entry.id, entry]));
      setEntries((old) => old.map((entry) => byId[entry.id] || entry));
    } catch (err) { setError(err.message); } finally { setCorrectionLoading(false); }
  };

  const updateCorrectionStatus = async (id, action) => {
    try {
      const response = await request(`/entries/${id}/${action}-correction/`, { method: "POST" });
      const updated = await response.json();
      setEntries((old) => old.map((entry) => entry.id === updated.id ? updated : entry));
    } catch (err) { setError(err.message); }
  };

  const download = async (language, version = "original", layout = "default") => {
    try {
      const response = await request(`/export/?language=${language}&version=${version}&layout=${layout}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = language === "ar" ? `as-sunnah-arabic-${layout === "columns3" ? "columns-3-" : layout === "columns" ? "columns-" : ""}${version}.docx` : "as-sunnah-bangla.docx"; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  };

  const districtCounts = useMemo(() => entries.reduce((counts, entry) => {
    counts[entry.district] = (counts[entry.district] || 0) + 1;
    return counts;
  }, {}), [entries]);

  const visibleEntries = useMemo(() => entries.filter((entry) => {
    const matchesDistrict = !districtFilter || String(entry.district) === districtFilter;
    const value = `${entry.dakhila_no} ${entry.name} ${entry.mobile_number}`.toLowerCase();
    return matchesDistrict && value.includes(search.toLowerCase());
  }).sort((a, b) => {
    const districtDifference = (districtCounts[b.district] || 0) - (districtCounts[a.district] || 0);
    if (districtDifference) return districtDifference;
    const districtNameDifference = (a.district_name || "").localeCompare(b.district_name || "");
    if (districtNameDifference) return districtNameDifference;
    const left = Number(normalizeDigits(a.dakhila_no)), right = Number(normalizeDigits(b.dakhila_no));
    return (Number.isNaN(left) || Number.isNaN(right)) ? a.dakhila_no.localeCompare(b.dakhila_no) : left - right;
  }), [entries, search, districtFilter, districtCounts]);

  return (
    <main className="as-sunnah-page min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div><h1 className="text-3xl font-bold text-slate-900">As-Sunnah</h1><p className="text-sm text-slate-500">মেয়াদ শেষ: {expiresAt ? new Date(expiresAt).toLocaleDateString("bn-BD") : "—"}</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={runArabicCorrection} disabled={correctionLoading} className="rounded-xl bg-violet-600 text-white px-4 py-2">ع {correctionLoading ? "Checking..." : "Arabic AI Check"}</button><button onClick={() => download("ar", "original")} className="rounded-xl bg-amber-600 text-white px-4 py-2">Arabic Original</button><button onClick={() => download("ar", "corrected")} className="rounded-xl bg-blue-600 text-white px-4 py-2">Arabic Corrected</button><button onClick={() => download("ar", "original", "columns")} className="rounded-xl bg-orange-700 text-white px-4 py-2">Arabic Compact (2 Columns)</button><button onClick={() => download("ar", "corrected", "columns")} className="rounded-xl bg-cyan-700 text-white px-4 py-2">Arabic Compact Corrected</button><button onClick={() => download("ar", "original", "columns3")} className="rounded-xl bg-fuchsia-700 text-white px-4 py-2">Arabic Compact (3 Columns)</button><button onClick={() => download("ar", "corrected", "columns3")} className="rounded-xl bg-teal-700 text-white px-4 py-2">Arabic Compact 3 Corrected</button><button onClick={() => download("bn")} className="rounded-xl bg-emerald-600 text-white px-4 py-2">Bangla DOCX</button>{adminAuthenticated ? <button onClick={() => setAdminPromptOpen((old) => !old)} className="rounded-xl bg-slate-900 px-4 py-2 text-white">🔐 Prompt Settings</button> : <div className="flex gap-1"><input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Admin password" className="w-32 rounded-xl border px-3 py-2" /><button onClick={adminLogin} className="rounded-xl bg-slate-700 px-3 py-2 text-white">Admin Login</button></div>}</div>
        </div>
        {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 p-3">{error}</div>}
        {adminAuthenticated && adminPromptOpen && <AdminPromptSettings onLogout={adminLogout} />}
        <div className="flex flex-wrap gap-2 mb-4"><button onClick={() => { setEntryMode("single"); setEditingId(null); }} className={`rounded-xl px-4 py-2 ${entryMode === "single" ? "bg-indigo-600 text-white" : "bg-white text-slate-700"}`}>Single Entry</button><button onClick={() => { setEntryMode("bulk"); setEditingId(null); if (!bulkRows.length) setBulkRows(Array.from({ length: 5 }, newBulkRow)); }} className={`rounded-xl px-4 py-2 ${entryMode === "bulk" ? "bg-indigo-600 text-white" : "bg-white text-slate-700"}`}>Bulk Entry</button><button onClick={() => { setEntryMode("auto"); setEditingId(null); }} className={`rounded-xl px-4 py-2 ${entryMode === "auto" ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}>✨ AI Auto Field Fill</button></div>
        <section className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          {entryMode === "single" ? <>
          <h2 className="font-bold text-lg mb-4">{editingId ? "তথ্য পরিবর্তন করুন" : "নতুন তথ্য যোগ করুন"}</h2>
          <form onSubmit={submitEntry} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select name="entry_language" value={form.entry_language} onChange={updateField} dir={arabicForm ? "rtl" : "ltr"} className="border rounded-xl px-3 py-2.5"><option value="bn">{arabicForm ? "إدخال بالبنغالية" : "বাংলা এন্ট্রি"}</option><option value="ar">{arabicForm ? "إدخال بالعربية" : "আরবি এন্ট্রি"}</option></select>
            {Object.keys(fieldLabels).map((name) => name === "dakhila_no" ? <div key={name} className="flex items-center gap-2"><input name={name} value={form[name]} onChange={updateField} placeholder={fieldLabels[name]} dir={arabicForm ? "rtl" : "ltr"} className="min-w-0 flex-1 border rounded-xl px-3 py-2.5" required /><DakhilaStatus status={getDakhilaStatus(form[name], form.entry_language, editingId)} /></div> : <input key={name} name={name} value={form[name]} onChange={updateField} placeholder={fieldLabels[name]} dir={arabicForm ? "rtl" : "ltr"} readOnly={["mobile_number", "education_period"].includes(name) && form.entry_language === "bn" && Boolean(arabicSource)} className={`border rounded-xl px-3 py-2.5 ${["mobile_number", "education_period"].includes(name) && form.entry_language === "bn" && arabicSource ? "bg-slate-100" : ""}`} required={name !== "education_period"} />)}
            <select name="district" value={form.district} onChange={updateDistrict} disabled={form.entry_language === "bn" && Boolean(form.district)} dir={arabicForm ? "rtl" : "ltr"} className="border rounded-xl px-3 py-2.5 disabled:bg-slate-100" required><option value="">{districtResolving ? "AI জেলা খুঁজছে..." : arabicForm ? "اختر المنطقة" : "জেলা নির্বাচন করুন"}</option>{districts.map((district) => <option key={district.id} value={district.id}>{districtLabel(district)}</option>)}</select>
            {arabicSource && <p className="text-xs text-emerald-700 md:col-span-2">Arabic dakhila থেকে mobile, রক্তের গ্রুপ, শিক্ষাকাল ও district নেওয়া হয়েছে: {arabicSource.dakhila_no}</p>}
            <select name="blood_group" value={form.blood_group} onChange={updateField} disabled={form.entry_language === "bn" && Boolean(arabicSource)} dir={arabicForm ? "rtl" : "ltr"} className="border rounded-xl px-3 py-2.5 disabled:bg-slate-100"><option value="">{arabicForm ? "فصيلة الدم" : "রক্তের গ্রুপ"}</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select>
            <div className="flex gap-2"><button disabled={loading} className="flex-1 rounded-xl bg-indigo-600 text-white py-2.5">{loading ? "Saving..." : editingId ? (arabicForm ? "تحديث" : "Update") : (arabicForm ? "حفظ" : "Save")}</button>{editingId && <button type="button" onClick={() => {setEditingId(null); setForm({ ...emptyForm, district: form.district, entry_language: form.entry_language });}} className="rounded-xl bg-slate-200 px-4">Cancel</button>}</div>
          </form>
          <form onSubmit={addDistrict} className="flex gap-2 mt-4 max-w-md"><input value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} placeholder={arabicForm ? "إضافة منطقة جديدة" : "নতুন জেলা যোগ করুন"} className="border rounded-xl px-3 py-2.5 flex-1" /><button className="rounded-xl bg-slate-800 text-white px-4">{arabicForm ? "إضافة" : "জেলা যোগ"}</button></form>
          </> : entryMode === "bulk" ? <>
          <div className="flex flex-wrap gap-3 mb-4"><select value={form.entry_language} onChange={updateField} name="entry_language" dir={arabicForm ? "rtl" : "ltr"} className="border rounded-xl px-3 py-2.5"><option value="bn">{arabicForm ? "إدخال بالبنغالية" : "বাংলা এন্ট্রি"}</option><option value="ar">{arabicForm ? "إدخال بالعربية" : "আরবি এন্ট্রি"}</option></select><select value={form.district} onChange={updateDistrict} dir={arabicForm ? "rtl" : "ltr"} className="border rounded-xl px-3 py-2.5"><option value="">{arabicForm ? "اختر المنطقة للإدخال الجماعي" : "Bulk-এর জেলা নির্বাচন করুন"}</option>{districts.map((district) => <option key={district.id} value={district.id}>{districtLabel(district)}</option>)}</select><button type="button" onClick={() => setBulkRows((old) => [...old, newBulkRow()])} className="rounded-xl bg-slate-800 text-white px-4">+ Row যোগ করুন</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b text-left">{[["dakhila_no", arabicForm ? "رقم التسجيل" : "দাখিলা"],["name", fieldLabels.name],["father_name", fieldLabels.father_name],["village", fieldLabels.village],["thana", fieldLabels.thana],["mobile_number", arabicForm ? "الهاتف" : "মোবাইল"],["blood_group", arabicForm ? "فصيلة الدم" : "রক্তের গ্রুপ"],["education_period", fieldLabels.education_period]].map(([, label]) => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{bulkRows.map((row, index) => <tr key={index} className="border-b">{["dakhila_no","name","father_name","village","thana","mobile_number","blood_group","education_period"].map((field) => <td key={field} className="p-1">{field === "blood_group" ? <select value={row[field]} onChange={(event) => updateBulkRow(index, field, event.target.value)} dir={form.entry_language === "ar" ? "rtl" : "ltr"} className="w-full border rounded-lg px-2 py-2"><option value="">{arabicForm ? "فصيلة الدم" : "রক্তের গ্রুপ"}</option>{bloodGroups.map((group) => <option key={group} value={group}>{group}</option>)}</select> : field === "dakhila_no" ? <div className="flex items-center gap-1"><input value={row[field]} onChange={(event) => updateBulkRow(index, field, event.target.value)} placeholder={`${index + 1}`} dir={form.entry_language === "ar" ? "rtl" : "ltr"} className="min-w-0 flex-1 border rounded-lg px-2 py-2" /><DakhilaStatus status={getDakhilaStatus(row[field], detectedLanguage(row, form.entry_language))} /></div> : <input value={row[field]} onChange={(event) => updateBulkRow(index, field, event.target.value)} placeholder={field === "education_period" ? (arabicForm ? "مثال: 3" : "যেমন 3") : ""} dir={form.entry_language === "ar" ? "rtl" : "ltr"} className="w-full border rounded-lg px-2 py-2" />}</td>)}</tr>)}</tbody></table></div>
          <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => setBulkRows(Array.from({ length: 5 }, newBulkRow))} className="rounded-xl bg-slate-200 px-4 py-2">Clear Rows</button><button type="button" disabled={loading} onClick={saveBulkEntries} className="rounded-xl bg-indigo-600 text-white px-5 py-2">{loading ? "Saving..." : "সব Entry Save করুন"}</button></div>
          <form onSubmit={addDistrict} className="flex gap-2 mt-4 max-w-md"><input value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} placeholder={arabicForm ? "إضافة منطقة جديدة" : "নতুন জেলা যোগ করুন"} className="border rounded-xl px-3 py-2.5 flex-1" /><button className="rounded-xl bg-slate-800 text-white px-4">{arabicForm ? "إضافة" : "জেলা যোগ"}</button></form>
          </> : <AutoFieldFillPanel districts={districts} entryLanguage={form.entry_language} onApproved={addApprovedEntries} />}
        </section>
        {adminAuthenticated && <section className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <h2 className="font-bold text-lg mb-3">District Edit / Entry Mapping</h2>
          <p className="text-sm text-slate-500 mb-4">Arabic district-কে Bangla district-এর সাথে link করতে source ও target district নির্বাচন করুন। Link করলে দুই ভাষার entry একই district-এর অধীনে থাকবে।</p>
          <div className="space-y-3">{districts.map((district) => <div key={district.id} className="grid grid-cols-1 gap-2 rounded-xl border p-3 md:grid-cols-6 md:items-center">
            <input value={districtDrafts[district.id]?.name || district.name || ""} onChange={(event) => updateDistrictDraft(district.id, "name", event.target.value)} placeholder="Arabic district name" dir="rtl" className="rounded-lg border px-3 py-2" />
            <input value={districtDrafts[district.id]?.name_bn || district.display_name || ""} onChange={(event) => updateDistrictDraft(district.id, "name_bn", event.target.value)} placeholder="বাংলা জেলার নাম" className="rounded-lg border px-3 py-2" />
            <select value={mappingTargets[district.id] || ""} onChange={(event) => setMappingTargets((old) => ({ ...old, [district.id]: event.target.value }))} className="rounded-lg border px-3 py-2"><option value="">Target Bangla district</option>{districts.filter((target) => target.id !== district.id).map((target) => <option key={target.id} value={target.id}>{target.display_name || target.name}</option>)}</select>
            <button type="button" onClick={() => saveDistrict(district)} className="rounded-lg bg-indigo-600 px-3 py-2 text-white">Save</button>
            <div className="flex gap-2"><button type="button" onClick={() => mapDistrictEntries(district)} className="rounded-lg bg-amber-500 px-3 py-2 text-white">Map</button><button type="button" onClick={() => deleteDistrict(district)} className="rounded-lg bg-red-600 px-3 py-2 text-white">Delete</button></div>
          </div>)}</div>
        </section>}
        <section className="bg-white rounded-2xl shadow-sm p-5 overflow-x-auto">
          <div className="flex flex-wrap gap-3 mb-4"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম/দাখিলা/মোবাইল search" className="border rounded-xl px-3 py-2.5 flex-1 min-w-56" /><select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} className="border rounded-xl px-3 py-2.5"><option value="">সব জেলা</option>{districts.map((district) => <option key={district.id} value={district.id}>{districtLabel(district)}</option>)}</select></div>
          <table className="w-full min-w-[1350px] text-sm"><thead><tr className="text-left border-b"><th className="p-3">ভাষা</th><th className="p-3">দাখিলা</th><th className="p-3">নাম</th><th className="p-3">বাবার নাম</th><th className="p-3">ঠিকানা/গ্রাম</th><th className="p-3">থানা/উপজেলা</th><th className="p-3">জেলা</th><th className="p-3">মোবাইল</th><th className="p-3">রক্তের গ্রুপ</th><th className="p-3">শিক্ষাকাল</th><th className="p-3">Action</th></tr></thead><tbody>{visibleEntries.flatMap((entry, index) => { const showDistrict = index === 0 || visibleEntries[index - 1].district !== entry.district; return [showDistrict ? <tr key={`district-${entry.district}`} className="bg-indigo-50"><td colSpan={11} className="p-3 font-bold text-indigo-900">জেলা: {entry.district_name} <span className="font-normal text-indigo-700">· মোট {districtCounts[entry.district] || 0} জন</span></td></tr> : null, <tr key={entry.id} className={`border-b last:border-0 ${entry.entry_language === "ar" ? "bg-amber-50" : "bg-white"}`}><td className="p-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${entry.entry_language === "ar" ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{entry.entry_language === "ar" ? "عربي" : "বাংলা"}</span></td><td className="p-3">{entry.dakhila_no}</td><td className="p-3" dir={entry.entry_language === "ar" ? "rtl" : "ltr"}>{entry.name}</td><td className="p-3" dir={entry.entry_language === "ar" ? "rtl" : "ltr"}>{entry.father_name}</td><td className="p-3" dir={entry.entry_language === "ar" ? "rtl" : "ltr"}>{entry.village}</td><td className="p-3" dir={entry.entry_language === "ar" ? "rtl" : "ltr"}>{entry.thana}</td><td className="p-3" dir={entry.entry_language === "ar" ? "rtl" : "ltr"}>{entry.district_name}</td><td className="p-3">{entry.mobile_number}</td><td className="p-3">{entry.blood_group || "—"}</td><td className="p-3">{entry.education_period || "—"}</td><td className="p-3 whitespace-nowrap"><span className="text-xs text-slate-500 mr-3">{entry.correction_status}</span>{entry.correction_status === "suggested" && <><button onClick={() => setSuggestionEntry(entry)} className="text-violet-600 mr-3">View Suggestion</button><button onClick={() => updateCorrectionStatus(entry.id, "approve")} className="text-emerald-600 mr-3">Approve</button><button onClick={() => updateCorrectionStatus(entry.id, "reject")} className="text-amber-600 mr-3">Keep Original</button></>}<button onClick={() => {setEditingId(entry.id); setForm({...entry, district: String(entry.district)});}} className="text-indigo-600 mr-3">Edit</button><button onClick={() => deleteEntry(entry.id)} className="text-red-600">Delete</button></td></tr>]; })}</tbody></table>
          {!visibleEntries.length && <p className="text-center text-slate-500 py-8">কোনো তথ্য পাওয়া যায়নি</p>}
        </section>
        {suggestionEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSuggestionEntry(null)}>
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div><h2 className="text-xl font-bold text-slate-900">AI Arabic Correction Suggestion</h2><p className="text-sm text-slate-500">দাখিলা: {suggestionEntry.dakhila_no}</p></div>
                <button onClick={() => setSuggestionEntry(null)} className="text-slate-500 text-2xl">×</button>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Field</th><th className="p-3">Original</th><th className="p-3">AI Suggested</th></tr></thead><tbody>{[["name","নাম"],["father_name","পিতার নাম"],["village","গ্রাম"],["thana","থানা"]].map(([field, label]) => <tr key={field} className="border-b"><td className="p-3 font-semibold">{label}</td><td className="p-3" dir="rtl">{suggestionEntry.original_data?.[field] || suggestionEntry[field] || "—"}</td><td className="p-3 bg-violet-50" dir="rtl">{suggestionEntry.corrected_data?.[field] || "—"}</td></tr>)}</tbody></table></div>
              {suggestionEntry.correction_notes && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">AI note: {suggestionEntry.correction_notes}</p>}
              <div className="flex justify-end gap-2 mt-5"><button onClick={() => { updateCorrectionStatus(suggestionEntry.id, "reject"); setSuggestionEntry(null); }} className="rounded-xl bg-amber-100 px-4 py-2 text-amber-700">Keep Original</button><button onClick={() => { updateCorrectionStatus(suggestionEntry.id, "approve"); setSuggestionEntry(null); }} className="rounded-xl bg-emerald-600 px-4 py-2 text-white">Approve Correction</button></div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
