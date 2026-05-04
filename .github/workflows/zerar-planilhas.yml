const admin = require('firebase-admin');

// Inicializa Firebase Admin com service account
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

async function salvarEZerar() {
  try {
    const agora = new Date();
    // Horário de Brasília (UTC-3)
    const horaBrasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
    const dataStr = horaBrasilia.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo'
    });
    const horaStr = horaBrasilia.toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    });
    const chave = dataStr.replace(/\//g, '-') + '_' + horaStr.replace(':', '-');

    console.log(`🕐 Iniciando zeragem: ${dataStr} às ${horaStr}`);

    // Busca todos os usuários
    const memoriaSnap = await db.ref('memoria').once('value');
    const todaMemoria = memoriaSnap.val();

    if (!todaMemoria) {
      console.log('Nenhum dado encontrado.');
      process.exit(0);
    }

    const usuarios = Object.keys(todaMemoria);
    console.log(`👥 Usuários encontrados: ${usuarios.length}`);

    for (const usuario of usuarios) {
      const memoria = todaMemoria[usuario];
      if (!memoria || typeof memoria !== 'object') continue;

      const setores = Object.keys(memoria);
      const snapshot = {};
      let temItens = false;

      // Monta snapshot com itens que têm qtd > 0
      setores.forEach(setor => {
        const itens = memoria[setor];
        if (Array.isArray(itens) && itens.length > 0) {
          const itensComQtd = itens.filter(i => parseInt(i.qtd) > 0);
          if (itensComQtd.length > 0) {
            snapshot[setor] = itensComQtd;
            temItens = true;
          }
        }
      });

      if (temItens) {
        // Salva histórico
        await db.ref(`historico_planilhas/${usuario}/${chave}`).set({
          data: dataStr,
          hora: horaStr,
          planilhas: snapshot
        });
        console.log(`✅ Histórico salvo para: ${usuario}`);
      }

      // Zera todas as quantidades
      setores.forEach(setor => {
        const itens = memoria[setor];
        if (Array.isArray(itens)) {
          itens.forEach(item => { item.qtd = 0; });
        }
      });

      await db.ref(`memoria/${usuario}`).set(memoria);
      console.log(`🔄 Planilhas zeradas para: ${usuario}`);
    }

    console.log('✅ Processo concluído com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
}

salvarEZerar();
