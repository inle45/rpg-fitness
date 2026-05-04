/* PixelQuest – Tests + auto-fixer
 *
 * Le "debugger auto-correctif" :
 *   1. Tests d'invariants (purs) sur l'état du jeu : contraintes de
 *      cohérence (XP >= 0, niveau >= 1, inventaire <= cap, total >=
 *      lifetime, etc.).
 *   2. Tests fonctionnels sur les calculs (xpForLevel, levelFromTotalXp,
 *      validateSteps, ingestSteps).
 *   3. Auto-fix : pour chaque test échoué, une fonction de réparation est
 *      appelée. Elle modifie l'état pour le ramener dans un état valide
 *      sans perdre la progression légitime.
 */
(function (global) {
  'use strict';

  const PQ = global.PixelQuest;

  // -------- Tests fonctionnels (sans état) ----------------------------------
  const FN_TESTS = [
    {
      id: 'xp_curve_growth',
      desc: 'La courbe d\'XP est croissante (exponentielle)',
      run() {
        for (let l = 1; l < 50; l++) {
          if (PQ.xpForLevel(l+1) <= PQ.xpForLevel(l)) {
            return { ok:false, msg:'xpForLevel('+(l+1)+') <= xpForLevel('+l+')' };
          }
        }
        return { ok:true };
      }
    },
    {
      id: 'level_from_total_xp_round_trip',
      desc: 'levelFromTotalXp(totalXpToReach(N)) = N',
      run() {
        for (let n = 1; n < 30; n++) {
          const total = PQ.totalXpToReach(n);
          const r = PQ.levelFromTotalXp(total);
          if (r.level !== n) return { ok:false, msg:'attendu '+n+', obtenu '+r.level };
        }
        return { ok:true };
      }
    },
    {
      id: 'antifraud_burst',
      desc: 'L\'anti-triche bloque un burst de 5000 pas',
      run() {
        const s = PQ.defaultState();
        const v = PQ.validateSteps(s, 5000, Date.now());
        if (v.ok) return { ok:false, msg:'5000 pas en un coup acceptés sans flag' };
        if (v.accepted >= 5000) return { ok:false, msg:'accepté trop : '+v.accepted };
        return { ok:true };
      }
    },
    {
      id: 'antifraud_cadence',
      desc: 'L\'anti-triche bloque une cadence > MAX/min',
      run() {
        const s = PQ.defaultState();
        const t0 = Date.now();
        let total = 0;
        for (let i=0;i<5;i++) {
          const r = PQ.ingestSteps(s, 80, t0 + i*1000);
          total += r.gainedXp;
        }
        if (s.flags.length === 0) return { ok:false, msg:'aucun flag levé' };
        return { ok:true };
      }
    },
    {
      id: 'normal_steps_accepted',
      desc: '50 pas par minute = aucun flag',
      run() {
        const s = PQ.defaultState();
        const t0 = Date.now();
        for (let i=0;i<5;i++) PQ.ingestSteps(s, 10, t0 + i*60000);
        if (s.flags.length > 0) return { ok:false, msg:'flag injuste' };
        if (s.totalSteps !== 50) return { ok:false, msg:'totalSteps incorrect : '+s.totalSteps };
        return { ok:true };
      }
    },
    {
      id: 'daily_threshold_doubles',
      desc: 'Au-delà de 8000 pas/jour, l\'XP est doublée',
      run() {
        const s = PQ.defaultState();
        s.dailySteps = PQ.CONFIG.DAILY_BONUS_THRESHOLD; // déjà au seuil
        const t = Date.now();
        // simuler 100 pas tous espacés pour ne pas être anti-cheat-bloqué
        let xp = 0;
        for (let i=0;i<5;i++){
          const r = PQ.ingestSteps(s, 20, t + i*60000);
          xp += r.gainedXp;
        }
        // en théorie, 100 pas en weather neutre = 100 xp; doublé = 200
        // les conditions météo varient selon date, on tolère >=150
        if (xp < 150) return { ok:false, msg:'XP doublée non appliquée : '+xp };
        if (!s.doubledToday) return { ok:false, msg:'doubledToday=false' };
        return { ok:true };
      }
    },
    {
      id: 'encumbrance_penalty',
      desc: 'L\'inventaire encombré applique le malus 110/100',
      run() {
        const s = PQ.defaultState();
        // Forcer encombrement
        for (let i=0;i<PQ.CONFIG.INVENTORY_SOFT_CAP;i++) PQ.addItem(s, 'piece', 1);
        const t = Date.now();
        const r = PQ.ingestSteps(s, 110, t);
        // 110 pas / 1.10 = 100 pas effectifs => XP ~100 (puis météo)
        if (r.gainedXp > 110) return { ok:false, msg:'pas de malus appliqué : '+r.gainedXp };
        return { ok:true };
      }
    },
    {
      id: 'shop_buy_sell',
      desc: 'Achat puis vente cohérents',
      run() {
        const s = PQ.defaultState();
        s.coins = 1000;
        const before = s.coins;
        const buy = PQ.buy(s, 'epee_bois');
        if (!buy.ok) return { ok:false, msg:'achat échoué' };
        if (s.coins !== before - 80) return { ok:false, msg:'coins après achat incorrects' };
        const sell = PQ.sell(s, 'epee_bois');
        if (!sell.ok) return { ok:false, msg:'vente échouée' };
        if (sell.refund !== 32) return { ok:false, msg:'refund incorrect : '+sell.refund };
        return { ok:true };
      }
    },
    {
      id: 'raid_damage',
      desc: 'Le raid prend des dégâts à chaque pas',
      run() {
        const s = PQ.defaultState();
        const before = s.raid.hp;
        PQ.ingestSteps(s, 100, Date.now());
        if (s.raid.hp >= before) return { ok:false, msg:'pas de dégâts au boss' };
        return { ok:true };
      }
    },
    {
      id: 'quest_progress',
      desc: 'Une quête de marche progresse correctement',
      run() {
        const s = PQ.defaultState();
        PQ.acceptQuest(s, 'q_walk_500');
        // 5 lots de 100 pas espacés
        const t = Date.now();
        for (let i=0;i<5;i++) PQ.ingestSteps(s, 100, t + i*60000);
        const q = s.activeQuests.find(x=>x.id==='q_walk_500');
        if (!q) return { ok:false, msg:'quête perdue' };
        if (q.progress < 500) return { ok:false, msg:'progression : '+q.progress };
        const r = PQ.turnInQuest(s, 'q_walk_500');
        if (!r.ok) return { ok:false, msg:'turn-in échoué' };
        return { ok:true };
      }
    },
    {
      id: 'achievements_trigger',
      desc: 'Les succès se déclenchent',
      run() {
        const s = PQ.defaultState();
        s.totalSteps = 100; PQ.refreshAchievements(s);
        if (!s.achievements.includes('premiers_pas')) return { ok:false, msg:'premiers_pas non débloqué' };
        return { ok:true };
      }
    },
  ];

  // -------- Invariants sur un state vivant ----------------------------------
  const INVARIANTS = [
    {
      id: 'xp_non_negative',
      check: s => s.xp >= 0,
      fix:   s => { if (s.xp < 0) s.xp = 0; },
    },
    {
      id: 'level_min_1',
      check: s => s.level >= 1,
      fix:   s => { if (s.level < 1) s.level = 1; },
    },
    {
      id: 'level_max_999',
      check: s => s.level <= 999,
      fix:   s => { if (s.level > 999) s.level = 999; },
    },
    {
      id: 'coins_non_negative',
      check: s => s.coins >= 0,
      fix:   s => { if (s.coins < 0) s.coins = 0; },
    },
    {
      id: 'totalSteps_le_lifetime',
      check: s => s.totalSteps <= s.lifetimeSteps + 1,
      fix:   s => { if (s.totalSteps > s.lifetimeSteps) s.lifetimeSteps = s.totalSteps; },
    },
    {
      id: 'dailySteps_non_negative',
      check: s => s.dailySteps >= 0,
      fix:   s => { if (s.dailySteps < 0) s.dailySteps = 0; },
    },
    {
      id: 'inventory_under_hard_cap',
      check: s => PQ.inventoryWeight(s) <= PQ.CONFIG.INVENTORY_HARD_CAP,
      fix:   s => {
        while (PQ.inventoryWeight(s) > PQ.CONFIG.INVENTORY_HARD_CAP && s.inventory.length > 0) {
          const last = s.inventory[s.inventory.length - 1];
          last.qty -= 1;
          if (last.qty <= 0) s.inventory.pop();
        }
      },
    },
    {
      id: 'raid_hp_non_negative',
      check: s => s.raid && s.raid.hp >= 0,
      fix:   s => { if (s.raid && s.raid.hp < 0) s.raid.hp = 0; },
    },
    {
      id: 'pos_in_bounds',
      check: s => s.pos.x >= 0 && s.pos.x < 9 && s.pos.y >= 0 && s.pos.y < 9,
      fix:   s => {
        s.pos.x = ((s.pos.x % 9) + 9) % 9;
        s.pos.y = ((s.pos.y % 9) + 9) % 9;
      },
    },
    {
      id: 'xp_below_threshold',
      check: s => s.xp < PQ.xpForLevel(s.level) * 1.5,
      fix:   s => {
        while (s.xp >= PQ.xpForLevel(s.level)) {
          s.xp -= PQ.xpForLevel(s.level);
          s.level += 1;
        }
      },
    },
    {
      id: 'character_class_known',
      check: s => !s.character || PQ.CLASSES.find(c=>c.id===s.character.classId),
      fix:   s => { if (s.character && !PQ.CLASSES.find(c=>c.id===s.character.classId)) s.character.classId = 'guerrier'; },
    },
    {
      id: 'weather_known',
      check: s => PQ.WEATHERS.find(w=>w.id===s.weatherId),
      fix:   s => { if (!PQ.WEATHERS.find(w=>w.id===s.weatherId)) s.weatherId = 'soleil'; },
    },
    {
      id: 'inventory_qty_positive',
      check: s => s.inventory.every(it => it.qty > 0),
      fix:   s => { s.inventory = s.inventory.filter(it => it.qty > 0); },
    },
    {
      id: 'no_duplicate_quests',
      check: s => new Set(s.activeQuests.map(q=>q.id)).size === s.activeQuests.length,
      fix:   s => {
        const seen = new Set();
        s.activeQuests = s.activeQuests.filter(q => seen.has(q.id) ? false : (seen.add(q.id), true));
      },
    },
    {
      id: 'achievements_unique',
      check: s => new Set(s.achievements).size === s.achievements.length,
      fix:   s => { s.achievements = Array.from(new Set(s.achievements)); },
    },
  ];

  function runFunctionalTests() {
    const out = [];
    for (const t of FN_TESTS) {
      try {
        const r = t.run();
        out.push({ id: t.id, desc: t.desc, ok: r.ok, msg: r.msg || '' });
      } catch (e) {
        out.push({ id: t.id, desc: t.desc, ok:false, msg: 'EXCEPTION: '+e.message });
      }
    }
    return out;
  }

  function runInvariants(state) {
    const out = [];
    for (const inv of INVARIANTS) {
      let ok = false, err = null;
      try { ok = !!inv.check(state); } catch (e) { err = e.message; }
      out.push({ id: inv.id, ok, err });
    }
    return out;
  }

  function autoFix(state) {
    const fixed = [];
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const inv of INVARIANTS) {
        try {
          if (!inv.check(state)) {
            inv.fix(state);
            changed = true;
            if (inv.check(state)) fixed.push(inv.id);
          }
        } catch (e) {
          fixed.push(inv.id + ' (exception: '+e.message+')');
        }
      }
      if (!changed) break;
    }
    return fixed;
  }

  global.PixelTests = {
    FN_TESTS, INVARIANTS,
    runFunctionalTests, runInvariants, autoFix,
  };
})(typeof window !== 'undefined' ? window : globalThis);
