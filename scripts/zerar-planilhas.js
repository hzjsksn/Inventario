const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// Apenas estes setores serão zerados
const SETORES_PARA_ZERAR = ['Triados', 'Não Triado', 'Pregação', 'Inventário'];

function parseMoeda(str) {
  if (!str) return 0;
  return parseFloat(str.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function calcularValorSetores(memoria, nomes) {
  let total = 0;
  nomes.forEach(nome => {
    (memoria[nome] || []).forEach(item => {
      const qtd = parseInt(item.qtd) || 0;
      const preco = parseMoeda(item.preco);
      total += qtd * preco;
    });
  });
  return total;
}

async function salvarHistoricoGrafico(memoria) {
  const agora = new Date();
  const hoje = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const chaveHoje = hoje.replace(/\//g, '-');

  const valTriados = calcularValorSetores(memoria, ['Triados']);
  const valGrupo = calcularValorSetores(memoria, ['Não Triado', 'Pregação']);

  await db.ref('historico_grafico/' + chaveHoje).set({
    data: hoje,
    triados: valTriados,
    grupo: valGrupo
  });

  console.log(`📊 Gráfico salvo: Triados R$${valTriados.toFixed(2)} | Grupo R$${valGrupo.toFixed(2)}`);
}

async function salvarSnapshotHistorico(usuarioNode, memoria) {
  const agora = new Date();
  const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const firebaseKey = 'reg_' + agora.getTime();

  const snapshot = {};
  SETORES_PARA_ZERAR.forEach(s => {
    const itens = memoria[s];
    if (Array.isArray(itens) && itens.length > 0) {
      snapshot[s] = itens.map(item => ({
        cod: item.cod,
        item: item.item,
        qtd: item.qtd,
        preco: item.preco
      }));
    }
  });

  if (Object.keys(snapshot).length === 0) {
    console.log(`⚠️ ${usuarioNode}: nenhum item para salvar no histórico.`);
    return;
  }

  await db.ref('historico_planilhas/' + usuarioNode + '/' + firebaseKey).set({
    firebaseKey,
    data,
    hora,
    timestamp: agora.getTime(),
    setores: snapshot
  });

  console.log(`📋 Histórico salvo: ${usuarioNode} (${firebaseKey})`);
}

async function zerarPlanilhas() {
  try {
    console.log('🔄 Iniciando processo de fechamento diário...');

    const snapshot = await db.ref('memoria').once('value');
    const todosUsuarios = snapshot.val();

    if (!todosUsuarios) {
      console.log('⚠️ Nenhum dado encontrado.');
      process.exit(0);
    }

    for (const usuario of Object.keys(todosUsuarios)) {
      const memoriaUsuario = todosUsuarios[usuario];

      console.log(`\n👤 Processando usuário: ${usuario}`);

      // 1. Salva histórico do gráfico (só uma vez, com a memória atual)
      await salvarHistoricoGrafico(memoriaUsuario);

      // 2. Salva snapshot no histórico de planilhas
      await salvarSnapshotHistorico(usuario, memoriaUsuario);

      // 3. Zera apenas os setores definidos
      for (const setor of SETORES_PARA_ZERAR) {
        const itens = memoriaUsuario[setor];
        if (!Array.isArray(itens) || itens.length === 0) {
          console.log(`⚠️ ${usuario}/${setor}: vazio, pulando.`);
          continue;
        }
        const itensZerados = itens.map(item => ({ ...item, qtd: 0 }));
        await db.ref(`memoria/${usuario}/${setor}`).set(itensZerados);
        console.log(`✅ Zerado: ${usuario} → ${setor} (${itens.length} itens)`);
      }
    }

    console.log('\n✅ Fechamento diário concluído!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

zerarPlanilhas();
