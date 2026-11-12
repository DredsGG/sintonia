// Três idiomas sem texto faltando (regra 13): mesmas chaves em pt, en e es, mesmo número de passos, novidades da versão nos três.
import fs from 'fs'; import path from 'path'; import vm from 'vm';
import { EXT, VER, check, fim } from './lib.mjs';
const ctx = { navigator: { language: 'pt-BR' }, globalThis: {} }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['i18n.js', 'novidades.js']) vm.runInContext(fs.readFileSync(path.join(EXT, 'src', f), 'utf8'), ctx);
const T = ctx.SINT_I18N.T, N = ctx.SINT_NOVIDADES;
const chaves = (o, pre = '') => Object.keys(o).flatMap((k) => (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? chaves(o[k], pre + k + '|') : [pre + k]));
const base = chaves(T.pt).sort();
for (const l of ['en', 'es']) {
  const c = chaves(T[l]).sort();
  const falta = base.filter((k) => !c.includes(k)), sobra = c.filter((k) => !base.includes(k));
  check(`${l}: mesmas chaves que pt`, !falta.length && !sobra.length, { falta, sobra });
  check(`${l}: mesmo número de passos do tutorial`, T[l].steps.length === T.pt.steps.length);
}
const tipos = (o) => chaves(o).map((k) => k + ':' + typeof k.split('|').reduce((a, x) => a[x], o));
check('mesmos tipos (texto × função) nos três', JSON.stringify(tipos(T.pt).sort()) === JSON.stringify(tipos(T.en).sort()) && JSON.stringify(tipos(T.pt).sort()) === JSON.stringify(tipos(T.es).sort()));
const v = VER.split('.').slice(0, 3).join('.');
for (const l of ['pt', 'en', 'es']) check(`novidades da v${v} em ${l}`, N[l] && N[l][v] && N[l][v].length > 0);
const def = fs.readFileSync(path.join(EXT, 'src', 'defaults.js'), 'utf8');
const ks = [...def.matchAll(/\{ k: '(\w+)'/g)].map((m) => m[1]);
for (const k of ks) check(`ajuste "${k}" tem título nos três idiomas`, ['pt', 'en', 'es'].every((l) => T[l]['set.' + k]));
fim();
