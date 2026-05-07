'use strict';
process.env.LANG = 'pt_BR.UTF-8';

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// Setores que serão salvos no histórico e zerados
const SETORES_PARA_ZERAR = ['Triados', 'N\u00e3o Triado', 'Prega\u00e7\u00e3o', 'Invent\u00e1rio'];

function parseMoeda(str) {
  if (!str) return 0;
  return parseFloat(str.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function calcularValorSetores(memoria, nomes) {
  let total = 0;
  nomes.forEach(nome => {
    const itens = memoria[nome];
    if (!Array.isArray(itens)) return;
    itens.forEach(item => {
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
  const valGrupo = calcularValorSetores(memoria, ['N\u00e3o Triado', 'Prega\u00e7\u00e3o']);

  await db.ref('historico_grafico/' + chaveHoje).set({
    data: hoje,
    triados: valTriados,
    grupo: valGrupo
  });

  console.log('Grafico salvo - Triados: R$' + valTriados.toFixed(2) + ' | Grupo: R$' + valGrupo.toFixed(2));
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
        cod: item.cod || '',
        item: item.item || '',
        qtd: item.qtd || 0,
        preco: item.preco || 'R$ 0,00'
      }));
    }
  });

  if (Object.keys(snapshot).length === 0) {
    console.log('Aviso: ' + usuarioNode + ' sem itens para historico.');
    return;
  }

  await db.ref('historico_planilhas/' + usuarioNode + '/' + firebaseKey).set({
    firebaseKey,
    data,
    hora,
    timestamp: agora.getTime(),
    setores: snapshot
  });

  console.log('Historico salvo: ' + usuarioNode + ' (' + firebaseKey + ')');
}

async function zerarPlanilhas() {
  try {
    console.log('Iniciando fechamento diario...');

    const snapshot = await db.ref('memoria').once('value');
    const todosUsuarios = snapshot.val();

    if (!todosUsuarios) {
      console.log('Nenhum dado encontrado.');
      process.exit(0);
    }

    const usuarios = Object.keys(todosUsuarios);
    console.log('Usuarios encontrados: ' + usuarios.length);

    for (const usuario of usuarios) {
      const memoriaUsuario = todosUsuarios[usuario];
      if (!memoriaUsuario || typeof memoriaUsuario !== 'object') continue;

      console.log('\nProcessando: ' + usuario);

      // 1. Salva grafico
      await salvarHistoricoGrafico(memoriaUsuario);

      // 2. Salva snapshot historico
      await salvarSnapshotHistorico(usuario, memoriaUsuario);

      // 3. Zera os setores
      for (const setor of SETORES_PARA_ZERAR) {
        const itens = memoriaUsuario[setor];
        if (!Array.isArray(itens) || itens.length === 0) {
          console.log('Pulando (vazio): ' + usuario + '/' + setor);
          continue;
        }
        const itensZerados = itens.map(item => Object.assign({}, item, { qtd: 0 }));
        await db.ref('memoria/' + usuario + '/' + setor).set(itensZerados);
        console.log('Zerado: ' + usuario + ' -> ' + setor + ' (' + itens.length + ' itens)');
      }
    }

    console.log('\nFechamento diario concluido!');
    await db.app.delete();
    process.exit(0);

  } catch (err) {
    console.error('ERRO: ' + err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

zerarPlanilhas();
