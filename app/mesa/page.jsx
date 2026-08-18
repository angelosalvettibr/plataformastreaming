"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const CATS = ["Recado", "Documento", "Pendência", "Processo", "Contrato", "Villa", "Escritório", "Outro"];

export default function Mesa() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [rows, setRows] = useState([]);
  const [cat, setCat] = useState("Recado");
  const [texto, setTexto] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("registros").select("*").order("created_at", { ascending: false }).limit(300);
    setRows(data || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      let doc_url = null;
      if (file) {
        const path = `mesa/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("docs").upload(path, file);
        if (upErr) throw upErr;
        doc_url = supabase.storage.from("docs").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("registros").insert({
        categoria: cat, texto: texto.trim(), doc_url, criado_por: session.user.email,
      });
      if (error) throw error;
      setTexto(""); setFile(null);
      await carregar();
    } catch (e2) { setErr(e2.message || "Erro ao salvar"); }
    setBusy(false);
  };

  const remover = async (id) => {
    if (!confirm("Remover esse registro?")) return;
    await supabase.from("registros").delete().eq("id", id);
    carregar();
  };

  if (perfil && !["admin", "juridico"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  return (
    <div className="container">
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Mesa Legal</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 20px" }}>
        Registros, documentos e comentários do jurídico-administrativo. Foto de documento vale — anexa direto do celular.
      </p>

      <form onSubmit={salvar} className="card" style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10 }}>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
          <input type="file" accept="*/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
        </div>
        <textarea rows={3} required placeholder="Escreve o registro…" value={texto} onChange={(e) => setTexto(e.target.value)} style={{ resize: "vertical" }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
          <button className="primary" disabled={busy} style={{ marginLeft: "auto" }}>{busy ? "Salvando…" : "Salvar registro"}</button>
        </div>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.id} className="card" style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
              <span><b>{r.criado_por?.split("@")[0]}</b> <span className="badge" style={{ marginLeft: 6 }}>{r.categoria}</span></span>
              <span className="muted">
                {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                <a href="#" onClick={(e) => { e.preventDefault(); remover(r.id); }} style={{ color: "var(--neg)", marginLeft: 10 }}>×</a>
              </span>
            </div>
            <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.texto}</div>
            {r.doc_url && <a href={r.doc_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, display: "inline-block", marginTop: 6 }}>📎 anexo</a>}
          </div>
        ))}
        {rows.length === 0 && <div className="muted" style={{ fontStyle: "italic" }}>Nenhum registro ainda — o primeiro é teu, Pri. 🙂</div>}
      </div>
    </div>
  );
}
