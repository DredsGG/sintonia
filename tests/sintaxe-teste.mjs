// Todos os .js da extensão compilam, o manifest é válido, os arquivos citados existem e as listas de reinjeção batem.
import fs from 'fs'; import path from 'path';
import { EXT, check, fim } from './lib.mjs';
const arquivos = [];
const andar = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) andar(p); else if (p.endsWith('.js')) arquivos.push(p); } };
andar(EXT);
for (const f of arquivos) { let ok = true, err = ''; try { new Function(fs.readFileSync(f, 'utf8')); } catch (e) { ok = false; err = e.message; } check(`compila: ${path.relative(EXT, f)}`, ok, err || undefined); }
const mf = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
check('manifest: MV3, versão X.Y.Z, service worker', mf.manifest_version === 3 && /^\d+\.\d+\.\d+$/.test(mf.version) && mf.background.service_worker === 'src/sw.js' && !mf.background.scripts && !mf.browser_specific_settings);
const citados = [mf.background.service_worker, mf.options_page, ...Object.values(mf.icons), ...mf.content_scripts.flatMap((c) => c.js)];
check('manifest: todos os arquivos citados existem', citados.every((f) => fs.existsSync(path.join(EXT, f))), citados.filter((f) => !fs.existsSync(path.join(EXT, f))));
check('manifest: permissões só as previstas', JSON.stringify(mf.permissions.sort()) === JSON.stringify(['alarms', 'downloads', 'scripting', 'storage']) && JSON.stringify(mf.host_permissions.sort()) === JSON.stringify(['https://api.github.com/*', 'https://sponsor.ajay.app/*', 'https://www.youtube.com/*']), { p: mf.permissions, h: mf.host_permissions });
const sw = fs.readFileSync(path.join(EXT, 'src', 'sw.js'), 'utf8');
const lista = sw.match(/const CONTENT = \[([^\]]+)\]/)[1].replace(/['\s]/g, '').split(',');
check('sw.js reinjeta exatamente os scripts do manifest (mundo isolado)', JSON.stringify(lista) === JSON.stringify(mf.content_scripts[1].js));
check('mundo MAIN só com o main.js, em document_start', mf.content_scripts[0].world === 'MAIN' && mf.content_scripts[0].run_at === 'document_start' && JSON.stringify(mf.content_scripts[0].js) === '["src/main.js"]');
// rede: só os 2 hosts permitidos aparecem em fetch/URLs de API
const todo = arquivos.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const fetches = [...todo.matchAll(/fetch\(\s*[`'"]([^`'"]+)/g)].map((m) => m[1]);
check('rede: fetch só para api.github.com, sponsor.ajay.app ou a própria extensão', fetches.every((u) => /^https:\/\/(api\.github\.com|sponsor\.ajay\.app)\//.test(u) || u.startsWith('${')), fetches);
fim();
