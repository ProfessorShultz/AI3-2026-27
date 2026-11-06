import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { lerCookie } from './cookies.js';

const segredo = process.env.JWT_SEGREDO;
if (!segredo || segredo.length < 32) {
  console.error('ERRO: JWT_SEGREDO em falta ou com menos de 32 caracteres. ' +
    'Defina-o no ficheiro .env e arranque com: node --env-file=.env servidor.js');
  process.exit(1);
}
const validade = Number(process.env.JWT_VALIDADE) || 900; // segundos

const utilizadores = JSON.parse(
  readFileSync(new URL('./dados/utilizadores.json', import.meta.url), 'utf-8')
);

