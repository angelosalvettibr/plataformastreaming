// ═══ O TRABALHADOR: lê storage novo → lança → concilia → marca pago → confirma → saldo → cartão ═══
const num = (s) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const iso = (d) => { const [dd, mm, yy] = d.split("/"); return `${yy}-${mm}-${dd}`; };
const dias = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
const norm = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const APELIDOS = [ // nome no extrato → palavras que identificam a conta
  [/jose luiz/i, /downtown|aluguel/], [/amil/i, /amil/], [/light/i, /light/], [/novo mundo/i, /agua|água/], [/crase/i, /condom/],
  [/verisure/i, /verisure/], [/claro/i, /claro/], [/william/i, /william/], [/priscilla/i, /priscilla/], [/leticia/i, /let[ií]cia/],
  [/edson/i, /edson/], [/pluxee/i, /pluxee/], [/kaiqui/i, /kaiqui/], [/alzenira/i, /alzenira/], [/bradesco/i, /bradesco/],
  [/elevadores/i, /elevador/], [/comgas|ceg/i, /g[aá]s/], [/gpsico/i, /psic/], [/luciana/i, /luciana/], [/haion/i, /haion/],
];
const casaConta = (contas, nome, v) => {
  const n = norm(nome);
  const ap = APELIDOS.find(([re]) => re.test(n));
  return contas.find((c) => {
    if (c._usada) return false;
    const cv = Number(c.valor_previsto) || 0;
    if (Math.abs(cv - v) < 2) return true;                                   // valor bate
    const parecido = cv > 0 && Math.abs(cv - v) / cv < 0.12;                 // ±12%
    if (!parecido) return false;
    if (ap && ap[1].test(norm(c.descricao))) return true;                    // apelido bate
    const primeira = n.split(" ")[0]; return primeira.length > 3 && norm(c.descricao).includes(primeira);
  });
};

const CAT_ENTRADA = [
  [/itsfw/i, "TIM Brasil"], [/banco inter sa$/i, "Villa Irvana"], [/ar12|viagens|turismo/i, "Villa Irvana"],
  [/natural talks/i, "Natural Talks"], [/haion|denis afonso/i, "HAION"],
];
const INTERNO = /angelo salvetti|genco administracao/i;
const CAT_SAIDA = [
  [/banco inter s a$/i, "Angelo PF"], [/mauricio canazaro/i, "Comissão Mauricio"],
  [/light |novo mundo|crase|verisure|claro$|starlink|elevadores|piscinas|maria roselange|kaiqui|alzenira|daniely|uilian|luciana sant/i, "Villa fixo"],
  [/haion/i, "HAION"],
  [/jose luiz afonso|william pinto|priscilla|leticia souza|edson bibiano|pluxee|arrp|google cloud|receita federal|wooba/i, "Angelo PJ"],
  [/amil|raissa|washington|tabatha|luiza helena|ana julia|ptc|gpsicoterapia|ceg$|rd saude|99 food|uber|zona sul/i, "Angelo PF"],
];
const cat = (tabela, nome) => (tabela.find(([re]) => re.test(nome || "")) || [null, tabela === CAT_ENTRADA ? "Outros" : "Angelo PF"])[1];

export async function indexarLinhas(sb, texto, nome) {
  const linhas = texto.split(/\r?\n/);
  const hi = linhas.findIndex((l) => l.startsWith("Data Lançamento"));
  if (hi < 0) return 0;
  const rows = linhas.slice(hi + 1).map((l) => l.split(";")).filter((r) => r.length >= 4 && /^\d{2}\/\d{2}\/\d{4}$/.test(r[0].trim()))
    .map((r) => ({ data: iso(r[0].trim()), historico: r[1].trim(), descricao: r[2].trim(), valor: num(r[3]), saldo: r[4] ? num(r[4]) : null, arquivo: nome }));
  let n = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("extrato_linhas").upsert(rows.slice(i, i + 200), { onConflict: "data,descricao,valor,saldo", ignoreDuplicates: true });
    if (!error) n += Math.min(200, rows.length - i);
  }
  return n;
}

export async function processarExtrato(sb, texto, nome, mesAtual) {
  try { await indexarLinhas(sb, texto, nome); } catch (e) {}
  const linhas = texto.split(/\r?\n/);
  // cabeçalho do Inter: alguma linha do topo com "Saldo" e um valor tipo 5.891,09 (com ou sem R$)
  const topo = linhas.slice(0, 15);
  const saldoL = topo.find((l) => /saldo/i.test(l) && /-?[\d.]+,\d{2}/.test(l));
  const saldo = saldoL ? num((saldoL.match(/-?[\d.]+,\d{2}/) || [""])[0]) : null;
  const hi = linhas.findIndex((l) => l.startsWith("Data Lançamento"));
  const rows = linhas.slice(hi + 1).map((l) => l.split(";")).filter((r) => r.length >= 4 && /^\d{2}\/\d{2}\/\d{4}$/.test(r[0].trim()))
    .map((r) => ({ data: iso(r[0].trim()), hist: r[1].trim(), nome: r[2].trim(), valor: num(r[3]) }))
    .filter((r) => r.data >= "2026-08-01"); // só o horizonte vivo
  const R = { lancadas_saidas: 0, lancadas_entradas: 0, confirmadas: 0, contas_pagas: [], internas: 0, ja_existiam: 0, saldo };
  const ini = mesAtual + "-01";
  const [{ data: pags }, { data: recs }, { data: cts }] = await Promise.all([
    sb.from("pagamentos").select("id,data,valor").eq("estornado", false).gte("data", ini),
    sb.from("receitas").select("id,data,valor,confirmada,categoria").gte("data", ini),
    sb.from("contas").select("id,descricao,valor_previsto,pago,mes").eq("pago", false).lte("mes", mesAtual),
  ]);
  const P = pags || [], RC = recs || [], C = cts || [];
  const novosP = [], novasR = [];
  for (const r of rows) {
    if (r.valor < 0) {
      const v = -r.valor;
      if (P.some((p) => Math.abs(Number(p.valor) - v) < 0.01 && dias(p.data, r.data) <= 1)) { R.ja_existiam++; continue; }
      if (INTERNO.test(r.nome) || /devolvido/i.test(r.hist)) { R.internas++; continue; }
      novosP.push({ data: r.data, favorecido: r.nome || r.hist, valor: v, categoria: cat(CAT_SAIDA, r.nome), estornado: false, criado_por: "companion" });
      // marcar conta paga se bater valor (±2) ou nome+valor(±5%)
      const alvo = casaConta(C, r.nome, v);
      if (alvo) { alvo._usada = true; R.contas_pagas.push({ id: alvo.id, descricao: alvo.descricao, valor: v }); }
    } else {
      const v = r.valor;
      if (INTERNO.test(r.nome) || /devolvido/i.test(r.hist)) { R.internas++; continue; }
      const jaRec = RC.find((x) => Math.abs(Number(x.valor) - v) < 0.01 && dias(x.data, r.data) <= 5);
      if (jaRec) { if (!jaRec.confirmada) { await sb.from("receitas").update({ confirmada: true, data: r.data }).eq("id", jaRec.id); R.confirmadas++; } else R.ja_existiam++; continue; }
      // previstas próximas: ±12% de valor, até 7 dias, e mesma categoria (ITSFW→TIM, Ar12/Inter→Villa)
      const catE = cat(CAT_ENTRADA, r.nome);
      const prox = RC.find((x) => !x.confirmada && Math.abs(Number(x.valor) - v) / Math.max(v, 1) < 0.12 && dias(x.data, r.data) <= 7 && (!x.categoria || x.categoria === catE));
      if (prox) { await sb.from("receitas").update({ confirmada: true, valor: v, data: r.data, obs: `confirmada pelo Companion via ${nome}` }).eq("id", prox.id); R.confirmadas++; continue; }
      novasR.push({ data: r.data, origem: r.nome || r.hist, valor: v, categoria: cat(CAT_ENTRADA, r.nome), confirmada: true, obs: `extrato ${nome}`, criado_por: "companion" });
    }
  }
  if (novosP.length) { await sb.from("pagamentos").insert(novosP); R.lancadas_saidas = novosP.length; }
  if (novasR.length) { await sb.from("receitas").insert(novasR); R.lancadas_entradas = novasR.length; }
  for (const c of R.contas_pagas) await sb.from("contas").update({ pago: true, obs: `paga ${c.valor} (Companion via ${nome})` }).eq("id", c.id);
  if (saldo != null) {
    // data final do extrato: última data das linhas (ou do nome "...a-17-08-2026")
    const ultima = rows.map((r) => r.data).sort().pop();
    const mNome = nome.match(/a-(\d{2})-(\d{2})-(\d{4})/);
    const saldoData = mNome ? `${mNome[3]}-${mNome[2]}-${mNome[1]}` : ultima;
    const { data: m } = await sb.from("cockpit_config").select("valor").eq("chave", "meta").maybeSingle();
    await sb.from("cockpit_config").upsert({ chave: "meta", valor: { ...(m?.valor || {}), saldoInicial: saldo, saldoData, saldoFonte: nome } });
    R.saldoData = saldoData;
  }
  return R;
}

export async function processarFatura(sb, texto, nome, gemini) {
  const m = nome.match(/(\d{4}-\d{2})/); const mes = m ? m[1] : null;
  if (!mes) return { pulado: "sem mês no nome" };
  const prompt = `Você recebe o texto de uma fatura de cartão Inter. Cartões: 4305=Angelo físico, 9542=Angelo virtual (assinaturas), 9994=Costanza (dependente).
Classifique TODAS as despesas (ignore linhas "PGTO PIX", "PAGAMENTO ON LINE", estornos e encargos) em categorias curtas em português (Mercado, Restaurantes & delivery, Farmácia & saúde, Uber/99, Combustível, Beleza, Compras & moda, Tech & assinaturas, Streaming, Domínios, Viagem, Pet, Academia, Eventos, Cafés & miúdos...). Nunca use "Outros".
Responda SÓ um JSON array: [{"cartao":"4305","pessoa":"Angelo","categoria":"Mercado","valor":1234}] com valores somados por cartão+categoria, arredondados.
FATURA:\n${texto.slice(0, 90000)}`;
  const out = await gemini(prompt);
  const j = JSON.parse(out.replace(/```json|```/g, "").trim());
  await sb.from("cartao_resumo").delete().eq("mes", mes);
  await sb.from("cartao_resumo").insert(j.map((x) => ({ mes, cartao: String(x.cartao), pessoa: x.pessoa, categoria: x.categoria, valor: Number(x.valor) || 0 })));
  return { mes, linhas: j.length, total: j.reduce((a, x) => a + (Number(x.valor) || 0), 0) };
}
