import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  criarToken,
  criarSessao,
  terminarSessao,
  exigirToken,
  erro
} from './autenticacao.js';

const app = express();
app.use(express.json());

const sugestoes = JSON.parse(
  readFileSync(new URL('./dados/sugestoes.json', import.meta.url), 'utf-8')
);

const novasSugestoes = [];

const contrato = readFileSync(new URL('../sugestoes.openapi.yaml', import.meta.url), 'utf-8');

app.get('/v2/openapi.yaml', (req, res) => {
  res.type('application/yaml').send(contrato);
});

const CATEGORIAS = [
  { codigo: 'instalacoes', descricao: 'Instalações' },
  { codigo: 'ensino', descricao: 'Ensino' },
  { codigo: 'servicos', descricao: 'Serviços' },
  { codigo: 'atividades', descricao: 'Atividades' },
  { codigo: 'outra', descricao: 'Outra' }
];

app.get('/v2/categorias', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  return res.status(200).json(CATEGORIAS);
});

app.post('/v2/tokens', criarToken);

app.post('/v2/sessao', criarSessao);

app.delete('/v2/sessao', terminarSessao);

app.post('/v2/sugestoes', exigirToken, (req, res) => {
  res.set('Cache-Control', 'no-store');

  if (req.utilizador.papel !== 'aluno') {
    return res.status(403).json(
      erro(403, 'Apenas os alunos podem criar sugestões')
    );
  }

  const corpo = req.body && typeof req.body === 'object' ? req.body : {};

  const detalhes = [];
  if (
    typeof corpo.titulo !== 'string' ||
    corpo.titulo.length < 10 ||
    corpo.titulo.length > 120
  ) {
    detalhes.push({ campo: 'titulo', problema: 'deve ter entre 10 e 120 caracteres' });
  }
  if (
    typeof corpo.descricao !== 'string' ||
    corpo.descricao.length < 20 ||
    corpo.descricao.length > 2000
  ) {
    detalhes.push({ campo: 'descricao', problema: 'deve ter entre 20 e 2000 caracteres' });
  }
  if (!CATEGORIAS.some((c) => c.codigo === corpo.categoria)) {
    detalhes.push({ campo: 'categoria', problema: 'deve ser uma das cinco categorias' });
  }
  if (detalhes.length > 0) {
    return res.status(400).json(erro(400, 'Dados da sugestão inválidos', detalhes));
  }

  const id = Math.max(
    0,
    ...sugestoes.map((s) => Number(s.id) || 0),
    ...novasSugestoes.map((s) => s.id)
  ) + 1;

  const agora = new Date().toISOString();

  const novaSugestao = {
    id: id,
    titulo: corpo.titulo,
    descricao: corpo.descricao,
    categoria: corpo.categoria,
    numeroAluno: req.utilizador.sub,
    estado: 'submetida',
    dataCriacao: agora,
    dataAtualizacao: agora,
    dataResolucao: null
  };

  novasSugestoes.push(novaSugestao);

  res.location(`/v2/sugestoes/${id}`);

  return res.status(201).json(novaSugestao);
});

app.get('/v2/sessao', exigirToken, (req, res) => {
  res.set('Cache-Control', 'no-store');

  return res.status(200).json({
    utilizador: req.utilizador.sub,
    nome: req.utilizador.nome,
    papel: req.utilizador.papel,
    expiracao: new Date(req.utilizador.exp * 1000).toISOString()
  });
});

app.get('/v2/sugestoes', exigirToken, (req, res) => {
  const { papel, sub } = req.utilizador;
  const todasSugestoes = [...sugestoes, ...novasSugestoes];
  const itens = papel === 'aluno'
  ? todasSugestoes.filter((s) => s.numeroAluno === sub)
  : todasSugestoes;

  res
    .set('Cache-Control', 'private, no-cache') // depende da identidade: nunca public
    .json({ pagina: 1, tamanhoPagina: 20, total: itens.length, itens });
});

app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));

app.use((err, req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json(erro(400, 'Corpo do pedido com JSON mal formado'));
  }
  console.error(err); // o detalhe fica só no registo do servidor
  return res.status(500).json(erro(500, 'Erro interno do servidor'));
});

app.listen(3000, () => console.log('Servidor em http://localhost:3000'));