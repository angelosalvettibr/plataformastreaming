"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const CATS = ["Villa fixo", "Materiais e reparos", "HAION", "Angelo PJ", "Angelo PF", "Comissão Mauricio", "Impostos", "Outros"];
const proxMes = (m) => { const [y, mm] = m.split("-").map(Number); return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`; };
const fmt = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function Caixa() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  const [rows, setRows] = useState([]);
  const [forns, setForns] = useState([]);
  const [form, setForm] = useState({ data: new Date().toISOString().slice(0, 10), favorecido: "", valor: "", categoria: "Villa fixo", obs: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [verEstornados, setVerEstornados] = useState(false);
  const [editando, setEditando] = useState(null);
  const [ed, setEd] = useState({});

  const carregar = useCallback(async () => {
    const ini = mes + "-01";
    const fim = proxMes(mes) + "-01";
    const { data } = await supabase.from("pagamentos").select("*")
      .gte("data", ini).lt("data", fim).order("data", { ascending: false }).order("created_at", { ascending: false });
    setRows(data || []);
    const { data: f } = await supabase.from("fornecedores").select("nome").order("nome");
    setForns((f || []).map((x) => x.nome));
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      let comprovante_url = null;
      if (file) {
        const path = `${mes}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("docs").upload(path, file);
        if (upErr) throw upErr;
        comprovante_url = supabase.storage.from("docs").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("pagamentos").insert({
        data: form.data, favorecido: form.favorecido.trim(),
        valor: Number(String(form.valor).replace(/\./g, "").replace(",", ".")),
        categoria: form.categoria, obs: form.obs.trim() || null, comprovante_url,
        criado_por: session.user.email,
      });
      if (error) throw error;
      setForm({ ...form, favorecido: "", valor: "", obs: "" }); setFile(null);
      await carregar();
    } catch (e2) { setErr(e2.message || "Erro ao salvar"); }
    setBusy(false);
  };

  const mudarCategoria = async (id, categoria) => {
    await supabase.from("pagamentos").update({ categoria }).eq("id", id);
    carregar();
  };

  const abrirEdicao = (r) => {
    setEditando(r.id);
    setEd({ data: r.data, favorecido: r.favorecido, valor: String(r.valor), obs: r.obs || "" });
  };
  const salvarEdicao = async (id) => {
    const { error } = await supabase.from("pagamentos").update({
      data: ed.data, favorecido: ed.favorecido.trim(),
      valor: Number(String(ed.valor).replace(/\./g, "").replace(",", ".")) || 0,
      obs: ed.obs.trim() || null,
    }).eq("id", id);
    if (error) alert("Erro: " + error.message);
    setEditando(null);
    carregar();
  };

  const anexarComprovante = async (id, file) => {
    if (!file) return;
    const path = `comprovantes/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("docs").upload(path, file);
    if (upErr) { alert("Erro no upload: " + upErr.message); return; }
    const url = supabase.storage.from("docs").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("pagamentos").update({ comprovante_url: url }).eq("id", id);
    if (error) { alert("Erro: " + error.message); return; }
    carregar();
  };

  const estornar = async (r) => {
    if (!confirm(`Estornar "${r.favorecido}" de ${fmt(r.valor)}? O lançamento fica riscado, com rastro.`)) return;
    await supabase.from("pagamentos").update({
      estornado: true, estornado_por: session.user.email, estornado_em: new Date().toISOString(),
    }).eq("id", r.id);
    carregar();
  };

  const ativos = rows.filter((r) => !r.estornado);
  const mostrados = verEstornados ? rows : ativos;
  const total = ativos.reduce((s, r) => s + Number(r.valor), 0);

  if (perfil && !["admin", "financeiro"].includes(perfil.role))
    return <div className="container muted">Sem acesso a este módulo.</div>;

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Caixa</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 20px" }}>
        Cada pagamento entra na hora: data, favorecido, valor, categoria, comprovante. Errou? Estorna — fica riscado com rastro, nada some.
      </p>

      <form onSubmit={salvar} className="card" style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 150px", gap: 10 }}>
          <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          <input required list="forns" placeholder="Favorecido (ex.: Bradesco, Uillian, Light...)" value={form.favorecido} onChange={(e) => setForm({ ...form, favorecido: e.target.value })} />
          <input required placeholder="Valor (R$)" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          <datalist id="forns">{forns.map((f) => <option key={f} value={f} />)}</datalist>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10 }}>
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Observação (opcional)" value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ width: "auto", fontSize: 12 }} />
          {err && <span style={{ color: "var(--neg)", fontSize: 13 }}>{err}</span>}
          <button className="primary" disabled={busy} style={{ marginLeft: "auto" }}>{busy ? "Salvando…" : "Registrar pagamento"}</button>
        </div>
      </form>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: 170 }} />
        <span className="muted" style={{ fontSize: 13 }}>{ativos.length} lançamentos ·</span>
        <b className="num">{fmt(total)}</b>
        <label className="muted" style={{ fontSize: 12, marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={verEstornados} onChange={(e) => setVerEstornados(e.target.checked)} style={{ width: "auto" }} />
          mostrar estornados
        </label>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Data</th><th>Favorecido</th><th style={{ textAlign: "right" }}>Valor</th><th>Categoria</th><th>Obs</th><th>💬</th><th>Por</th><th></th></tr></thead>
          <tbody>
            {mostrados.map((r) => (
              <tr key={r.id} style={r.estornado ? { opacity: 0.45, textDecoration: "line-through" } : undefined}>
                <td className="num">{r.data?.slice(8, 10)}/{r.data?.slice(5, 7)}</td>
                <td>{r.favorecido} {r.comprovante_url
                    ? <a href={r.comprovante_url} target="_blank" rel="noreferrer">📎</a>
                    : (r.obs === "via conciliação" || r.criado_por === "extrato-import") ? null : <label title="Sem comprovante — clica pra anexar" style={{ cursor: "pointer", color: "var(--neg)", fontSize: 11, border: "1px dashed var(--neg)", borderRadius: 6, padding: "1px 6px", marginLeft: 4, whiteSpace: "nowrap" }}>
                        sem 📎 <input type="file" style={{ display: "none" }} onChange={(e) => anexarComprovante(r.id, e.target.files?.[0])} />
                      </label>}</td>
                <td className="num" style={{ textAlign: "right" }}>{fmt(r.valor)}</td>
                <td>
                  {r.estornado ? <span className="badge">{r.categoria}</span> : (
                    <select value={r.categoria} onChange={(e) => mudarCategoria(r.id, e.target.value)}
                      style={{ padding: "4px 8px", fontSize: 12, width: "auto", background: r.categoria === "Outros" ? "#F3E4C2" : "var(--surface)" }}>
                      {CATS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  )}
                </td>
                <td className="muted" style={{ maxWidth: 200, fontSize: 12 }}>{r.obs}{r.estornado && <div style={{ color: "var(--neg)" }}>estornado por {r.estornado_por?.split("@")[0]}</div>}</td>
                <td className="muted" style={{ fontSize: 11 }}>{r.criado_por?.split("@")[0]}</td>
                <td><input defaultValue={r.comentario || ""} placeholder="💬" title="Comentário — explica o porquê (vai pro briefing)"
                    onBlur={(e) => e.target.value !== (r.comentario || "") && supabase.from("pagamentos").update({ comentario: e.target.value.trim() || null }).eq("id", r.id)}
                    style={{ fontSize: 11.5, padding: "4px 7px", width: 130, background: r.comentario ? "#FFFBF0" : "var(--surface)" }} /></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {!r.estornado && <>
                    <a href="#" className="muted" onClick={(e) => { e.preventDefault(); editando === r.id ? setEditando(null) : abrirEdicao(r); }} style={{ fontSize: 12, marginRight: 8 }}>{editando === r.id ? "fechar" : "editar"}</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); estornar(r); }} style={{ color: "var(--neg)", fontSize: 12 }}>estornar</a>
                  </>}
                </td>
              </tr>
            ))}
            {editando && rows.find((r) => r.id === editando) && !rows.find((r) => r.id === editando).estornado && (
              <tr>
                <td colSpan={7} style={{ background: "var(--surface2)", padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 130px 1fr auto", gap: 8, alignItems: "center" }}>
                    <input type="date" value={ed.data} onChange={(e) => setEd({ ...ed, data: e.target.value })} />
                    <input value={ed.favorecido} onChange={(e) => setEd({ ...ed, favorecido: e.target.value })} />
                    <input inputMode="decimal" value={ed.valor} onChange={(e) => setEd({ ...ed, valor: e.target.value })} style={{ textAlign: "right" }} />
                    <input value={ed.obs} onChange={(e) => setEd({ ...ed, obs: e.target.value })} placeholder="Obs" />
                    <button className="primary" onClick={() => salvarEdicao(editando)} style={{ padding: "7px 14px", fontSize: 12 }}>Salvar</button>
                  </div>
                </td>
              </tr>
            )}
            {mostrados.length === 0 && <tr><td colSpan={7} className="muted" style={{ padding: 20, fontStyle: "italic" }}>Nenhum lançamento nesse mês.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
