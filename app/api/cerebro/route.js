import { createClient } from "@supabase/supabase-js";
import { processarExtrato, processarFatura, indexarLinhas } from "./rodar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function hojeBR() {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  return { iso: `${g("year")}-${g("month")}-${g("day")}`, hora: `${g("hour")}:${g("minute")}`, mes: `${g("year")}-${g("month")}` };
}

const REGRAS = `
Você é o CONSIGLIERE financeiro do Angelo's Life Companion — o sistema de gestão do Angelo Salvetti (Rio de Janeiro).
Fala português do Brasil, direto, caloroso, sem enrolação. TEXTO SIMPLES: sem markdown, sem asteriscos, sem títulos com #; uma ideia por linha, linhas curtas. No máximo 8 linhas na nota do dia. Números em R$ inteiros.
CONTEXTO DA CASA:
- Villa Irvana (hospedagem de luxo, sócio operacional Mauricio 15% de comissão sobre reservas). "Banco Inter Sa" recebido = repasse de reserva Villa. Ar12 Viagens = agência de reserva.
- "Itsfw Desenvolvimento" = pagamentos da TIM Brasil (categoria TIM Brasil), padrão: parcela ~6k dia 15 + ~27-29k dia 16-18. Nada a ver com Natural Talks.
- Natural Talks = só quando vier da NT. "Commisao pw" = comissão Parallel World (US$16k) — CONTRATO AINDA NÃO ASSINADO: trate como incerta.
- Pix de "Angelo Salvetti" para a conta = empréstimo do sócio (mútuo), não receita. Genco = interno.
- José Luiz Afonso Pereira = aluguel do escritório Downtown (~5.8k, dias 14-17). Denis Afonso Pereira = reembolsos HAION.
- Cartão Inter: recargas diárias "Banco Inter S A" = pagamento do cartão (nunca conta a vencer).
- Bradesco (financiamento Villa) ~65k dia 25 = a maior obrigação do mês.
- Prioridade de pagamento: vencidas → serviços que cortam (luz/água/gás/internet/alarme) → pessoas (salários, rescisões, VR) → saúde/seguro → demais → banco.
- Receita não confirmada com data passada = alerta (⚠️): pode não ter caído.
- Nunca invente números: use só o contexto fornecido. Se faltar dado, diga o que falta.
- CARIMBO DE DATA: o saldo vale até "saldo_valido_ate" (data do último extrato) — se hoje é depois disso e a pergunta envolver saldo, avise que pode ter mudado.
`;

async function contexto(sb) {
  const { iso, mes } = hojeBR();
  const ini = mes + "-01", fim = mes + "-31";
  const [meta, recs, cts, pags, futuras, velhas, cart] = await Promise.all([
    sb.from("cockpit_config").select("valor").eq("chave", "meta").maybeSingle(),
    sb.from("receitas").select("data,origem,valor,categoria,confirmada").gte("data", ini).lte("data", fim).order("data"),
    sb.from("contas").select("descricao,categoria,valor_previsto,vencimento,standby,obs").eq("mes", mes).eq("pago", false).order("vencimento"),
    sb.from("pagamentos").select("data,favorecido,valor,categoria").eq("estornado", false).gte("data", ini).lte("data", fim).order("data", { ascending: false }).limit(40),
    sb.from("receitas").select("data,origem,valor").gt("data", fim).lte("data", "2026-12-31").order("data").limit(20),
    sb.from("contas").select("descricao,valor_previsto,mes").lt("mes", mes).eq("pago", false),
    sb.from("cartao_resumo").select("mes,pessoa,categoria,valor").order("mes", { ascending: false }).limit(60),
  ]);
  const { data: ultArq } = await sb.from("cerebro_arquivos").select("nome,processado_em").order("processado_em", { ascending: false }).limit(3);
  return {
    agora_brasilia: `${iso} ${hojeBR().hora}`,
    hoje: iso, saldo: meta.data?.valor?.saldoInicial ?? null,
    saldo_valido_ate: meta.data?.valor?.saldoData || "desconhecido (informado à mão)",
    saldo_fonte: meta.data?.valor?.saldoFonte || null,
    ultimos_arquivos_processados: ultArq || [],
    receitas_mes: recs.data || [], contas_mes: cts.data || [], pagos_recentes: pags.data || [],
    receitas_futuras: futuras.data || [], atrasados_meses_anteriores: velhas.data || [], cartao: cart.data || [],
  };
}

async function gemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente no Vercel");
  const modelos = [process.env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-pro"].filter(Boolean);
  const configs = [
    { temperature: 0.3, maxOutputTokens: 4000, thinkingConfig: { thinkingBudget: 0 } },
    { temperature: 0.3, maxOutputTokens: 4000 },
    { temperature: 0.3, maxOutputTokens: 2000 },
  ];
  const tentativas = [];
  for (const modelo of modelos) {
    for (const generationConfig of configs) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
        });
        const j = await r.json();
        if (!r.ok) { tentativas.push(`${modelo}/${generationConfig.thinkingConfig ? "think0" : "plain" + generationConfig.maxOutputTokens}: ${r.status} ${j.error?.message || ""}`.slice(0, 160)); continue; }
        const parts = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought && p.text);
        const texto = parts.map((p) => p.text).join("").trim();
        if (texto) return texto;
        tentativas.push(`${modelo}: vazio (${j.candidates?.[0]?.finishReason || "?"})`);
      } catch (e) { tentativas.push(`${modelo}: ${String(e.message || e)}`.slice(0, 120)); }
    }
  }
  throw new Error("Gemini não respondeu. Tentativas → " + tentativas.join(" | "));
}

function sbFrom(req) {
  const auth = req.headers.get("authorization");
  if (auth) return createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (svc) return createClient(URL, svc);
  return null;
}

async function gerar(req, tipo, pergunta, historico = []) {
  const sb = sbFrom(req);
  if (!sb) return Response.json({ erro: "sem credencial (login ou SUPABASE_SERVICE_ROLE_KEY)" }, { status: 401 });
  const ctx = await contexto(sb);
  const { hora } = hojeBR();
  const fio = (historico || []).slice(-8).map((m) => `${m.q ? "ANGELO: " + m.q : ""}${m.a ? "\nANGELITO: " + m.a : ""}`).join("\n");
  const pedido = tipo === "resposta"
    ? `MODO CONVERSA. Você é o Angelito. Responda SÓ o que foi perguntado, curto e direto (1 a 5 linhas), como num chat. Não faça relatório se não pedirem; não abra com "Dados até" nem cumprimentos longos. Se a pergunta for "relatório", "resumo", "como estamos" → aí sim dê o panorama completo. Se pedirem opinião ou decisão, recomende e diga o porquê em uma linha. Se não souber pelos dados, diga o que falta. Use o histórico pra manter o fio.\n\nHISTÓRICO:\n${fio}\n\nANGELO: ${pergunta}\nANGELITO:`
    : `Escreva a NOTA DO DIA (${ctx.hoje} ${hora}). Comece com "Dados até <data do extrato> · agora <data hora>". Depois: 1) o que caiu/saiu de novo, 2) saldo e o que vem nos próximos dias, 3) prioridade de pagamento hoje, 4) riscos (vencidas, Bradesco, receitas incertas, ⚠️ não confirmadas), 5) uma pergunta/pendência que só o Angelo resolve, se houver. Máx 8 linhas, tom de consigliere.`;
  const prompt = `${REGRAS}\n\nDADOS (JSON):\n${JSON.stringify(ctx).slice(0, 60000)}\n\n${pedido}`;
  const texto = await gemini(prompt);
  await sb.from("cerebro_notas").insert({ tipo, pergunta: pergunta || null, texto, motor: "gemini" });
  return Response.json({ ok: true, texto });
}

async function rodar(req) {
  const sb = sbFrom(req);
  if (!sb) return Response.json({ erro: "sem credencial" }, { status: 401 });
  const { mes } = hojeBR();
  const log = [];
  const { data: arqs, error } = await sb.storage.from("docs").list("extratos", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
  if (error) return Response.json({ erro: "storage: " + error.message }, { status: 500 });
  const { data: feitos } = await sb.from("cerebro_arquivos").select("nome");
  const jaFeitos = new Set((feitos || []).map((x) => x.nome));
  // chave = nome + tamanho: o Inter repete o nome do arquivo em exports diferentes do mesmo dia
  for (const a of (arqs || []).filter((x) => x.name && !jaFeitos.has(`${x.name}#${x.metadata?.size || 0}`) && !jaFeitos.has(x.name))) {
    const nome = a.name;
    const chave = `${nome}#${a.metadata?.size || 0}`;
    try {
      const { data: blob } = await sb.storage.from("docs").download("extratos/" + nome);
      const texto = await blob.text();
      let resumo;
      // reconhece pelo CONTEÚDO (o nome pode ser qualquer coisa)
      const ehExtrato = /Data Lan[cç]amento;Hist[oó]rico;Descri[cç][aã]o;Valor/i.test(texto) || /^\s*Extrato Conta Corrente/im.test(texto);
      const ehFatura = /Despesas da fatura|CART[ÃA]O 5554/i.test(texto);
      if (ehExtrato) resumo = { tipo: "extrato", ...(await processarExtrato(sb, texto, nome, mes)) };
      else if (ehFatura) resumo = { tipo: "fatura", ...(await processarFatura(sb, texto, nome, gemini)) };
      else if (/\.pdf$/i.test(nome)) resumo = { tipo: "ignorado", motivo: "PDF — cola o texto na caixa da página Extratos" };
      else resumo = { tipo: "ignorado", motivo: "não reconheci como extrato Inter (CSV) nem fatura (TXT) — primeiras letras: " + texto.slice(0, 60).replace(/\s+/g, " ") };
      await sb.from("cerebro_arquivos").insert({ nome: chave, resumo });
      log.push({ nome, ...resumo });
    } catch (e) { log.push({ nome, erro: String(e.message || e) }); }
  }
  // nota do dia com o que aconteceu
  const ctx = await contexto(sb);
  const { hora } = hojeBR();
  const prompt = `${REGRAS}\n\nDADOS (JSON):\n${JSON.stringify(ctx).slice(0, 60000)}\n\nO COMPANION ACABOU DE RODAR (${ctx.hoje} ${hora}) e fez isto: ${JSON.stringify(log)}.\nEscreva a NOTA DO DIA: 1) o que ele acabou de fazer (lançou, confirmou, marcou pago, saldo novo) em 1-2 linhas, 2) saldo e o que vem, 3) prioridade de pagamento hoje, 4) riscos, 5) o que só o Angelo resolve. Máx 9 linhas.`;
  const texto = await gemini(prompt);
  await sb.from("cerebro_notas").insert({ tipo: "nota_dia", texto, motor: "gemini" });
  return Response.json({ ok: true, processados: log, texto });
}

async function reindexar(req) {
  const sb = sbFrom(req);
  if (!sb) return Response.json({ erro: "sem credencial" }, { status: 401 });
  const { data: arqs, error } = await sb.storage.from("docs").list("extratos", { limit: 500 });
  if (error) return Response.json({ erro: "storage: " + error.message }, { status: 500 });
  const log = [];
  for (const a of arqs || []) {
    try {
      const { data: blob } = await sb.storage.from("docs").download("extratos/" + a.name);
      const texto = await blob.text();
      if (!/Data Lan[cç]amento;Hist/i.test(texto)) continue;
      const n = await indexarLinhas(sb, texto, a.name);
      log.push({ nome: a.name, linhas: n });
    } catch (e) { log.push({ nome: a.name, erro: String(e.message || e) }); }
  }
  return Response.json({ ok: true, arquivos: log });
}

export async function GET(req) {
  const u = new URL(req.url);
  try { if (u.searchParams.get("acao") === "rodar") return await rodar(req); if (u.searchParams.get("acao") === "reindexar") return await reindexar(req); return await gerar(req, u.searchParams.get("tipo") || "nota_dia", null); }
  catch (e) { return Response.json({ erro: String(e.message || e) }, { status: 500 }); }
}
export async function POST(req) {
  try { const b = await req.json().catch(() => ({})); if (b.acao === "rodar") return await rodar(req); if (b.acao === "reindexar") return await reindexar(req); return await gerar(req, b.pergunta ? "resposta" : "nota_dia", b.pergunta, b.historico || []); }
  catch (e) { return Response.json({ erro: String(e.message || e) }, { status: 500 }); }
}
