"use client";
import AuthGate from "@/components/AuthGate";
import { useRole } from "@/lib/useRole";

const GUIA = [
  { titulo: "🏠 Página inicial — \"O que preciso de você\"", roles: ["admin","financeiro","juridico"],
    txt: "Ao entrar, o quadro dourado mostra as tarefas do mês pedidas a você, por ordem de urgência (🔴 urgente · 🟡 no mês · ⚪ quando der). Clica em \"ir lá →\" pra ir direto ao lugar certo. Pra concluir, marca o ✓ — algumas tarefas pedem uma resposta escrita ou um arquivo anexado antes de fechar: é de propósito, é a entrega que o Angelo vai ler." },
  { titulo: "📋 Contas do Mês", roles: ["admin","financeiro"],
    txt: "Tudo que vence no mês: valor previsto, data e situação (vence dia X · ATRASADA · sem data ⚠️ · ✅ paga). Pagou uma conta? \"Marcar pago\" e informa o valor real. Errou algo? \"editar\". Conta nova? Formulário no fim. Use as setas ◀ ▶ pra ver setembro, outubro... (já estão montados) e meses passados. Pendência de mês anterior não some: aparece no quadro vermelho até ser paga. E o campo 💬 embaixo de cada conta é seu espaço de comentário — \"veio mais caro porque...\", \"boleto não chegou\" — o Angelo e o Claude leem." },
  { titulo: "💸 Caixa", roles: ["admin","financeiro"],
    txt: "O registro de cada pagamento FEITO: data, favorecido, valor, categoria e comprovante anexado. Regra de ouro: pagou → registra na hora, com comprovante. Errou o valor? Não se apaga: \"estornar\" (fica riscado, com rastro) e lança de novo certo. A categoria de cada linha é um menu — os marcados \"Outros\" em amarelo estão esperando classificação." },
  { titulo: "💰 Receitas", roles: ["admin","financeiro"],
    txt: "O espelho do Caixa: tudo que ENTRA — reserva da Villa, TIM, Natural Talks. Data, origem, valor, categoria e comprovante quando houver. É daqui (junto com o Caixa) que os números do grupo se enxergam de verdade." },
  { titulo: "🔍 Conciliação", roles: ["admin","financeiro"],
    txt: "A conferência automática do fechamento: escolhe o extrato (CSV) arquivado + o mês → \"Conciliar\". O sistema lê o extrato do banco e compara com o que foi registrado. O que o banco viu e o sistema não tem, aparece em lista com botão \"+ lançar\" — um clique e entra. Meta do fechamento: 🎉 conciliação perfeita." },
  { titulo: "📄 Extratos & Faturas", roles: ["admin","financeiro"],
    txt: "O arquivo oficial: todo início de mês, sobe aqui o extrato da conta (CSV — o app do Inter exporta) e a fatura do cartão (PDF) do mês que fechou. É desse arquivo que a Conciliação e o Claude trabalham." },
  { titulo: "🏷️ Fornecedores", roles: ["admin","financeiro"],
    txt: "O cadastro de quem recebe: nome, contato, PIX/conta, categoria. Já vem com os recorrentes semeados — falta completar PIX e telefone de cada um. Os nomes daqui viram autocomplete no Caixa." },
  { titulo: "🗺 Mapa do Mês", roles: ["admin","financeiro"],
    txt: "A foto inteira do mês em 6 cards: previsto, pago, falta, atrasadas, saiu pelo Caixa, entrou por Receitas — e a tabela única ordenada por urgência. É a página de \"como estamos?\" em 5 segundos." },
  { titulo: "📊 Relatórios", roles: ["admin","financeiro"],
    txt: "As tabelas de análise: Previsto × Realizado por categoria (as contas contra o que foi pago), Em aberto (com ação direta na linha), histórico mês a mês e ranking de favorecidos. Cresce sozinho conforme o Caixa enche." },
  { titulo: "⚖️ Mesa Legal", roles: ["admin","juridico"],
    txt: "O diário do jurídico-administrativo: todo documento, andamento, recado ou decisão entra aqui como registro — com categoria e anexo (pode fotografar o documento direto do celular). O que não entra na Mesa, não existe pro sistema." },
  { titulo: "📁 Advogados & Processos", roles: ["admin","juridico"],
    txt: "Quem cuida do quê: os processos (já carregados dos controles) com número, empresa, advogado, status e PRÓXIMO PRAZO — a data é o mais importante: com ela o sistema avisa sozinho (vermelho = vencido, dourado = próximos 7 dias). O status se muda na própria tabela." },
  { titulo: "⚖️ Mapa Legal", roles: ["admin","juridico"],
    txt: "A situação total do contencioso: quantos ativos, prazos vencidos, próximos 7 e 30 dias, sem prazo cadastrado — e a distribuição por empresa, tipo e advogado. A seção \"🚨 Atenção imediata\" só aparece quando algo queima." },
  { titulo: "🏢 Empresas do Grupo", roles: ["admin","financeiro","juridico"],
    txt: "Cada empresa com sua situação e o contador de processos ativos (vem do jurídico). Serve de mapa societário: o que está ativo, pausado, e onde estão os problemas." },
  { titulo: "📰 Briefing pro Claude", roles: ["admin"],
    txt: "Compila tudo que a equipe colocou desde a data escolhida — pagamentos, receitas, registros, tarefas concluídas com respostas, comentários, arquivos — num texto com botão copiar. Ritual: copiar → colar no Claude → \"elabora\". Ele lê tudo (inclusive os documentos, pelos links) e devolve análise + o que virar dado." },
  { titulo: "👥 Atividade", roles: ["admin"],
    txt: "Quem fez o quê, dia a dia, com hora: lançamentos, contas pagas, tarefas concluídas, uploads. O diário de bordo automático da equipe — 3, 7 ou 30 dias." },
  { titulo: "✅ Tarefas do Mês", roles: ["admin"],
    txt: "Onde o Angelo cria o que o sistema vai pedir de cada um: título, pra quem, prioridade, link do módulo e o que exige pra concluir (nada / resposta escrita / arquivo). Aparece guiado na entrada da pessoa." },
  { titulo: "✈️ Cockpit", roles: ["admin"],
    txt: "O painel de comando: 9 meses de fluxo de caixa, cenários (Só confirmado / Plano / Otimista), Envelope Viareggio. Células douradas editam e salvam no banco — receitas por mês e os custos fixos na primeira coluna. Base revisada: R$ 189.229/mês. Potes: Social 4k · Viagens & Hospitalidade 5k (média anual)." },
  { titulo: "🔍 \"Ver como\" (topo da página inicial)", roles: ["admin"],
    txt: "O seletor 👁 troca tua visão pra enxergar exatamente o que a Letícia ou a Priscilla veem — módulos e tarefas delas. Pra conferir se o sistema pede o que você quer que peça." },
];

export default function Ajuda() {
  return <AuthGate>{({ session }) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }) {
  const perfil = useRole(session);
  if (!perfil) return <div className="container muted">Carregando…</div>;
  const meus = GUIA.filter((g) => g.roles.includes(perfil.role));
  return (
    <div className="container" style={{ maxWidth: 780 }}>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← início</a>
      <div className="eyebrow" style={{ marginTop: 10 }}>Angelo's Life Companion</div>
      <h1 className="display">Como funciona</h1>
      <p className="muted" style={{ fontSize: 14, margin: "4px 0 20px" }}>
        O guia de bordo — o que é cada coisa e como usar, sem mistério.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {meus.map((g) => (
          <div key={g.titulo} className="card">
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, marginBottom: 6 }}>{g.titulo}</div>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text)" }}>{g.txt}</div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 20 }}>
        Dúvida que o guia não resolve? Fala com o Angelo — ou ele pergunta ao Claude, que conhece cada parafuso daqui. 🙂
      </p>
    </div>
  );
}
