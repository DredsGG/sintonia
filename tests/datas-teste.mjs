// Parser de data relativa (PT/EN/ES) e tipo do item. node datas-teste.mjs
import { createRequire } from 'module'; import path from 'path';
import { EXT, check, fim } from './lib.mjs';
const D = createRequire(import.meta.url)(path.join(EXT, 'src', 'datas.js'));
const casos = [
  ['há 5 minutos', 5 / 60], ['há 1 hora', 1], ['há 23 horas', 23], ['há 1 dia', 24], ['há 2 dias', 48], ['há 6 dias', 144], ['há 1 semana', 168], ['há 3 meses', 2190], ['há 1 ano', 8760],
  ['Transmitido há 3 horas', 3], ['Estreou há 2 dias', 48], ['há 1 mês', 730],
  ['5 minutes ago', 5 / 60], ['1 hour ago', 1], ['2 days ago', 48], ['Streamed 5 hours ago', 5], ['1 week ago', 168], ['Premiered 1 day ago', 24], ['an hour ago', 1],
  ['hace 5 minutos', 5 / 60], ['hace 1 hora', 1], ['hace 2 días', 48], ['Transmitido hace 3 horas', 3], ['hace 1 semana', 168], ['hace 1 año', 8760], ['Se estrenó hace 1 día', 24],
  ['há 2 dias', 48],
];
for (const [t, h] of casos) { const r = D.idade(t); check(`"${t}" → ${h} h`, r && Math.abs(r.min - h) < 1e-6, r); }
for (const t of ['1,3 mi de visualizações', 'YouTube', '8:59', 'Programado para 12/11/26, 20:00', '']) check(`"${t}" não é data`, D.idade(t) === null);
// janelas: min < limite
const entra = (t, lim) => D.idade(t).min < lim;
check('Hoje (24 h): "há 23 horas" entra, "há 1 dia" não', entra('há 23 horas', 24) && !entra('há 1 dia', 24));
check('3 dias: "há 2 dias" entra, "há 3 dias" não', entra('há 2 dias', 72) && !entra('há 3 dias', 72));
check('7 dias: "há 6 dias" entra, "há 1 semana" não', entra('há 6 dias', 168) && !entra('há 1 semana', 168));
const tipos = [
  [['AO VIVO', '1,2 mil assistindo agora'], 'aoVivo'], [['LIVE', '1.2K watching'], 'aoVivo'], [['EN VIVO', '1,2 k espectadores'], 'aoVivo'],
  [['148 assistindo'], 'aoVivo'], [['1,2 mil assistindo'], 'aoVivo'], [['Transmitido há 2 dias'], 'live'], [['Streamed 2 days ago'], 'live'], [['Transmitido hace 2 días'], 'live'],
  [['Estreia em 12/11/2026, 20:00'], 'estreia'], [['Premieres 11/12/26, 8:00 PM'], 'estreia'], [['Se estrena el 12/11/26'], 'estreia'],
  [['Programado para 12/11/26, 20:00', 'EM BREVE'], 'agendado'], [['Scheduled for 11/12/26', 'UPCOMING'], 'agendado'], [['Programado para el 12/11/26', 'PRÓXIMAMENTE'], 'agendado'],
  [['Estreou há 2 dias', '10:00'], 'video'], [['1,3 mi de visualizações', 'há 7 dias', '8:59'], 'video'], [['1.3M views', '7 days ago'], 'video'],
];
for (const [ts, esp] of tipos) check(`tipo ${JSON.stringify(ts)} → ${esp}`, D.tipo(ts) === esp, D.tipo(ts));
fim();
