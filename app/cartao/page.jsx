"use client";
import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

const R$ = (v) => "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR");
const CORES = { Angelo: "var(--gold)", Costanza: "#B06A8F" };
const ROTULO = { "4305": "físico", "9542": "virtual", "9994": "dependente" };

export default function Cartao() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}
function Inner({ session }) {
  const perfil = useRole(session);
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from("cartao_resumo").select("*").order("mes", { ascending: false }).order("valor", { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, []);
  if (perfil && perfil.role !== "admin") return <div className="container muted">Página do capo.</div>;
  if (!rows) return <div className="container muted">Carregando os cartões…</div>;

  const meses = [...new Set(rows.map((r) => r.mes))];
  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">💳 Cartões</h1>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 18px" }}>
        Fatura Inter aberta por pessoa e categoria — recargas pagam no dia (nada a vencer). 4305 físico · 9542 virtual · 9994 Costanza.
      </p>
      {meses.map((mes) => {
        const doMes = rows.filter((r) => r.mes === mes);
        const total = doMes.reduce((a, r) => a + Number(r.valor), 0);
        const pessoas = [...new Set(doMes.map((r) => r.pessoa))];
        return (
          <div key={mes} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, margin: 0 }}>Fatura {mes.slice(5)}/{mes.slice(2, 4)}</h2>
              <span className="num" style={{ fontSize: 18, fontWeight: 800 }}>{R$(total)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {pessoas.map((p) => {
                const dele = doMes.filter((r) => r.pessoa === p);
                const tot = dele.reduce((a, r) => a + Number(r.valor), 0);
                const max = Math.max(...dele.map((r) => Number(r.valor)));
                const cartoes = [...new Set(dele.map((r) => r.cartao))];
                return (
                  <div key={p} className="card" style={{ borderTop: `4px solid ${CORES[p] || "var(--muted)"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <div>
                        <b>{p}</b>
                        <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{cartoes.map((c) => `${c} ${ROTULO[c] || ""}`).join(" · ")}</span>
                      </div>
                      <span className="num" style={{ fontWeight: 800, fontSize: 16 }}>{R$(tot)}</span>
                    </div>
                    {dele.map((r) => (
                      <div key={r.id} style={{ margin: "5px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                          <span>{r.categoria}{r.cartao === "9542" ? " 🌐" : ""}</span>
                          <span className="num" style={{ fontWeight: 600 }}>{R$(r.valor)}</span>
                        </div>
                        <div style={{ height: 5, background: "var(--surface2)", borderRadius: 3 }}>
                          <div style={{ height: 5, width: `${(Number(r.valor) / max) * 100}%`, background: CORES[p] || "var(--muted)", borderRadius: 3, opacity: 0.75 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="muted" style={{ fontSize: 11.5 }}>
        Fonte: faturas em Extratos & Faturas → Claude lê e alimenta esta tabela. Sensor de rotativo: se a fatura vier com encargos &gt; 0, alarme na Mesa.
      </p>
    </div>
  );
}
