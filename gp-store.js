/* 골든픽 배틀 - 데이터 저장소 (게임·관리자 공용)
   Firebase 설정이 비어 있으면 데모 모드(localStorage)로 동작해요. */
(function () {
  'use strict';
  const C = window.GP_CONFIG;
  const COL = C.collections;
  const demo = !C.firebase || /YOUR_/.test(C.firebase.apiKey || '');
  const RANK_MUL = 1e10;                       // rankKey = 점수 * 1e10 + (먼저 달성할수록 큰 값)
  const rankKeyOf = score => score * RANK_MUL + (RANK_MUL - 1 - Math.floor(Date.now() / 1000));
  const nickKey = n => String(n).trim().toLowerCase().replace(/[\/\s.#$\[\]]+/g, '_').slice(0, 40);

  async function sha256(s) {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) {                               // 보안 컨텍스트가 아닐 때의 대체(간이 해시)
      let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
      return 'x' + h.toString(16);
    }
  }
  const HASH_SALT = 'gp-battle:';
  const pwHash = pw => sha256(HASH_SALT + pw);

  const api = { demo, nickKey, sha256, pwHash, rankKeyOf, RANK_MUL };

  /* ------------------------------------------------------------------ 데모 */
  if (demo) {
    const KEY = 'gp_demo_v1';
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const save = d => localStorage.setItem(KEY, JSON.stringify(d));
    const get = () => Object.assign({ users: {}, ranks: {}, event: {}, game: {}, adminHash: null }, load());
    const subs = new Set();
    const fire = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    window.addEventListener('storage', e => { if (e.key === KEY) fire(); });
    const sub = (fn) => { subs.add(fn); fn(); return () => subs.delete(fn); };
    const mutate = fn => { const d = get(); const r = fn(d); save(d); fire(); return r; };

    Object.assign(api, {
      async init() {},
      onEvent: cb => sub(() => cb(get().event)),
      onGame: cb => sub(() => cb(get().game)),
      async setEvent(startTime, endTime) { mutate(d => { d.event = { startTime, endTime }; }); },
      async setGame(obj) { mutate(d => { d.game = obj; }); },
      async enter(nickname, phone4) {
        const id = nickKey(nickname); const d = get(); const u = d.users[id];
        if (u) return u.phone4 === phone4 ? { ok: true, user: Object.assign({ id }, u) } : { error: 'pin' };
        const nu = { nickname, phone4, topScore: 0, topLevel: 0, plays: 0, createdAt: new Date().toISOString() };
        mutate(d2 => { d2.users[id] = nu; d2.ranks[id] = { nickname, topScore: 0, topLevel: 0, rankKey: 0 }; });
        return { ok: true, user: Object.assign({ id }, nu) };
      },
      async submitScore(user, score, level, sec) {
        return mutate(d => {
          const u = d.users[user.id]; if (!u) return { best: score, improved: false };
          u.plays = (u.plays || 0) + 1;
          const improved = score > (u.topScore || 0);
          if (improved) {
            u.topScore = score; u.topLevel = level;
            d.ranks[user.id] = { nickname: u.nickname, topScore: score, topLevel: level, rankKey: rankKeyOf(score), updatedAt: Date.now() };
          }
          return { best: u.topScore, improved };
        });
      },
      onTop(limit, cb) {
        return sub(() => cb(Object.entries(get().ranks).filter(([, r]) => r.topScore > 0)
          .sort((a, b) => b[1].rankKey - a[1].rankKey).slice(0, limit).map(([id, r]) => Object.assign({ id }, r))));
      },
      onAllRanks(cb) {
        return sub(() => {
          const d = get();
          cb(Object.entries(d.ranks).map(([id, r]) => Object.assign({ id, plays: (d.users[id] || {}).plays || 0, createdAt: (d.users[id] || {}).createdAt }, r))
            .sort((a, b) => b.rankKey - a.rankKey));
        });
      },
      async getUser(id) { const u = get().users[id]; return u ? Object.assign({ id }, u) : null; },
      async deleteUser(id) { mutate(d => { delete d.users[id]; delete d.ranks[id]; }); },
      async resetScores() { mutate(d => { Object.values(d.users).forEach(u => { u.topScore = 0; u.topLevel = 0; u.plays = 0; });
        Object.keys(d.ranks).forEach(id => { d.ranks[id] = { nickname: d.ranks[id].nickname, topScore: 0, topLevel: 0, rankKey: 0 }; }); }); },
      async deleteAll() { mutate(d => { d.users = {}; d.ranks = {}; }); },
      async getAdminHash() { return get().adminHash; },
      async setAdminHash(h) { mutate(d => { d.adminHash = h; }); }
    });
    return void (window.GPStore = api);
  }

  /* ------------------------------------------------------------- Firebase */
  let db, FV;
  const loadScript = src => new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('load ' + src)); document.head.appendChild(s);
  });
  const col = n => db.collection(COL[n]);
  const cfgDoc = n => db.collection(COL.config).doc(n);
  const chunked = async (refs, fn) => { for (let i = 0; i < refs.length; i += 400) { const b = db.batch(); refs.slice(i, i + 400).forEach(r => fn(b, r)); await b.commit(); } };

  Object.assign(api, {
    async init() {
      const v = '10.12.2';
      await loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-firestore-compat.js');
      firebase.initializeApp(C.firebase); db = firebase.firestore(); FV = firebase.firestore.FieldValue;
    },
    onEvent: cb => cfgDoc('event').onSnapshot(s => cb(s.exists ? s.data() : {}), () => cb({})),
    onGame: cb => cfgDoc('game').onSnapshot(s => cb(s.exists ? s.data() : {}), () => cb({})),
    async setEvent(startTime, endTime) { await cfgDoc('event').set({ startTime, endTime, updatedAt: FV.serverTimestamp() }); },
    async setGame(obj) { await cfgDoc('game').set(Object.assign({}, obj, { updatedAt: FV.serverTimestamp() })); },
    async enter(nickname, phone4) {
      const id = nickKey(nickname); const ref = col('users').doc(id); const s = await ref.get();
      if (s.exists) { const u = s.data(); return u.phone4 === phone4 ? { ok: true, user: Object.assign({ id }, u) } : { error: 'pin' }; }
      const nu = { nickname, phone4, topScore: 0, topLevel: 0, plays: 0 };
      await ref.set(Object.assign({}, nu, { createdAt: FV.serverTimestamp() }));
      await col('ranks').doc(id).set({ nickname, topScore: 0, topLevel: 0, rankKey: 0, updatedAt: FV.serverTimestamp() });
      return { ok: true, user: Object.assign({ id }, nu) };
    },
    async submitScore(user, score, level, sec) {
      const uref = col('users').doc(user.id), rref = col('ranks').doc(user.id);
      const s = await uref.get(); const prev = s.exists ? (s.data().topScore || 0) : 0;
      const improved = score > prev;
      const upd = { plays: FV.increment(1), lastSec: sec };
      if (improved) { upd.topScore = score; upd.topLevel = level; }
      await uref.update(upd);
      if (improved) await rref.update({ topScore: score, topLevel: level, rankKey: rankKeyOf(score), updatedAt: FV.serverTimestamp() });
      return { best: improved ? score : prev, improved };
    },
    onTop(limit, cb) {
      return col('ranks').where('rankKey', '>', 0).orderBy('rankKey', 'desc').limit(limit)
        .onSnapshot(s => cb(s.docs.map(d => Object.assign({ id: d.id }, d.data()))), e => { console.error(e); cb(null, e); });
    },
    onAllRanks(cb) {
      return col('ranks').orderBy('rankKey', 'desc').onSnapshot(s => cb(s.docs.map(d => Object.assign({ id: d.id }, d.data()))), e => { console.error(e); cb(null, e); });
    },
    async getUser(id) { const s = await col('users').doc(id).get(); return s.exists ? Object.assign({ id }, s.data()) : null; },
    async deleteUser(id) { await col('users').doc(id).delete(); await col('ranks').doc(id).delete(); },
    async resetScores() {
      const rs = await col('ranks').get();
      await chunked(rs.docs.map(d => d.ref), (b, r) => b.update(r, { topScore: 0, topLevel: 0, rankKey: 0 }));
      // users 문서는 목록 조회가 막혀 있어서, 순위 문서 기준으로 하나씩 갱신해요.
      await chunked(rs.docs.map(d => col('users').doc(d.id)), (b, r) => b.update(r, { topScore: 0, topLevel: 0, plays: 0 }));
    },
    async deleteAll() {
      const rs = await col('ranks').get();
      await chunked(rs.docs.map(d => d.ref), (b, r) => b.delete(r));
      await chunked(rs.docs.map(d => col('users').doc(d.id)), (b, r) => b.delete(r));
    },
    async getAdminHash() { const s = await cfgDoc('admin').get(); return s.exists ? s.data().hash : null; },
    async setAdminHash(h) { await cfgDoc('admin').set({ hash: h, updatedAt: FV.serverTimestamp() }); }
  });
  window.GPStore = api;
})();
