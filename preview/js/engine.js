/* PixelQuest – Moteur de jeu (preview JS).
 * Toute la logique métier est ici. Elle est conçue pour être 1:1 avec la
 * version Kotlin partagée (android/shared). Les noms de fonctions, formules
 * et structures de données sont volontairement identiques.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constantes de game design
  // ---------------------------------------------------------------------------
  const CONFIG = {
    XP_BASE: 100,
    XP_GROWTH: 1.18,            // courbe exponentielle
    XP_PER_STEP: 1,             // 1 pas = 1 XP de base
    COIN_PER_100_STEPS: 5,      // 100 pas = 5 pièces
    DAILY_BONUS_THRESHOLD: 8000,
    DAILY_BONUS_MULT: 2.0,
    INVENTORY_SOFT_CAP: 25,     // au-delà : malus encombrement
    INVENTORY_HARD_CAP: 40,
    ENCUMBRANCE_PENALTY: 1.10,  // 110 pas pour 100 XP
    MAX_STEPS_PER_MINUTE: 220,  // anti-triche : seuil humain max
    MAX_STEPS_PER_SECOND: 5,    // ~300/min en sprint, on coupe à 5/s
    SUSPICIOUS_BURST: 500,      // saut soudain suspect
    WEEKLY_BOSS_BASE_HP: 75000,
    RAID_RESET_DOW: 1,          // lundi (ISO : 1)
    WORLD_TILES_PER_STEP: 0.02, // 50 pas = 1 tuile
  };

  // ---------------------------------------------------------------------------
  // Données statiques (catalogues)
  // ---------------------------------------------------------------------------
  const CLASSES = [
    { id: 'guerrier', name: 'Guerrier',  desc: '+10% PV, robuste', sprite: 'hero_warrior' },
    { id: 'mage',     name: 'Mage',      desc: '+10% XP sur quêtes mentales', sprite: 'hero_mage' },
    { id: 'rodeur',   name: 'Rôdeur',    desc: '+5% pièces par pas', sprite: 'hero_ranger' },
    { id: 'barde',    name: 'Barde',     desc: '+1 dialogue easter egg', sprite: 'hero_bard' },
  ];

  const HAIRSTYLES = ['short', 'long', 'mohawk', 'ponytail', 'bald', 'curly'];
  const SKIN_TONES = ['#f4c79a', '#d39660', '#a06840', '#5c3a1e', '#f7d8b2', '#e8b27a'];
  const HAIR_COLORS = ['#2a1a0d', '#8b4513', '#d4a017', '#c0392b', '#e8e8e8', '#5b2a83'];

  const NPCS = [
    {
      id: 'taverniere',
      name: 'Hilda la Taverniere',
      sprite: 'npc_tavern',
      bio: 'Tient la Taverne du Pas-Vert. Achète vos objets, vous repose.',
      dialogues: [
        'Encore toi ? Marche un peu et reviens avec des sous !',
        'On dit qu\'au-delà de 10 000 pas, le ciel pleut des pièces.',
        'Easter egg : tape « konami » dans la console pour un cadeau.',
      ],
    },
    {
      id: 'forgeron',
      name: 'Brom le Forgeron',
      sprite: 'npc_smith',
      bio: 'Forge des armes à partir de minerais récoltés en marchant.',
      dialogues: [
        'Apporte-moi du minerai et je te ferai trembler les boss.',
        'Le Dragon de Fer ? Je l\'ai vu une fois, j\'ai couru.',
      ],
    },
    {
      id: 'sage',
      name: 'Mira la Sage',
      sprite: 'npc_sage',
      bio: 'Donne les quêtes principales et les énigmes.',
      dialogues: [
        'Le vrai voyage, c\'est celui des pas.',
        'Si tu marches sans bouger, le système le saura.',
      ],
    },
    {
      id: 'eleveur',
      name: 'Pip l\'Éleveur',
      sprite: 'npc_breeder',
      bio: 'Couve les œufs et apprivoise les familiers.',
      dialogues: [
        'Cet œuf éclora dans 5000 pas, sois patient.',
        'Mon cochon-licorne ? Une légende vivante.',
      ],
    },
  ];

  const MONSTERS = [
    { id: 'slime',     name: 'Slime baveux',   hp: 50,   xp: 20,  loot: ['gel', 'piece'],         tier: 1, sprite: 'mob_slime' },
    { id: 'gobelin',   name: 'Gobelin',        hp: 120,  xp: 60,  loot: ['cuir', 'piece'],        tier: 2, sprite: 'mob_goblin' },
    { id: 'loup',      name: 'Loup d\'ombre',  hp: 200,  xp: 110, loot: ['croc', 'fourrure'],     tier: 3, sprite: 'mob_wolf' },
    { id: 'golem',     name: 'Golem de Pierre',hp: 500,  xp: 300, loot: ['minerai', 'cristal'],   tier: 4, sprite: 'mob_golem' },
  ];

  const RAID_BOSSES = [
    { id: 'dragon_fer', name: 'Dragon de Fer',     hp: 75000,  reward: 'epee_titan' },
    { id: 'liche',      name: 'Liche du Crépuscule',hp: 90000, reward: 'sceptre_obscur' },
    { id: 'kraken',     name: 'Kraken des Sables', hp: 110000, reward: 'trident_dunes' },
  ];

  const SHOP_ITEMS = [
    { id: 'potion_pv',     name: 'Potion de Vie',         price: 25,   type: 'consumable', desc: 'Restaure 50 PV.' },
    { id: 'potion_xp',     name: 'Élixir d\'XP (+10%, 1h)', price: 120, type: 'buff',       desc: 'Boost XP temporaire.' },
    { id: 'sac_grand',     name: 'Grand Sac (+5 slots)',  price: 400,  type: 'upgrade',    desc: 'Augmente l\'inventaire.' },
    { id: 'oeuf_mystere',  name: 'Œuf Mystère',           price: 250,  type: 'pet',        desc: 'À couver en marchant.' },
    { id: 'epee_bois',     name: 'Épée en Bois',          price: 80,   type: 'weapon',     desc: '+5 dégâts.' },
    { id: 'epee_fer',      name: 'Épée en Fer',           price: 350,  type: 'weapon',     desc: '+15 dégâts.' },
    { id: 'baton_eclat',   name: 'Bâton d\'Éclat',        price: 280,  type: 'weapon',     desc: '+12 magie.' },
    { id: 'cape_voyageur', name: 'Cape du Voyageur',      price: 200,  type: 'armor',      desc: '-1 encombrement.' },
  ];

  const PETS = [
    { id: 'slimon',   name: 'Slimon',   hatchSteps: 3000,  sprite: 'pet_slime',  trait: '+1 pièce / 100 pas' },
    { id: 'foxy',     name: 'Foxy',     hatchSteps: 6000,  sprite: 'pet_fox',    trait: '+2% XP global' },
    { id: 'griffon',  name: 'Griffon',  hatchSteps: 12000, sprite: 'pet_griff',  trait: '-5% encombrement' },
    { id: 'pixiel',   name: 'Pixiel',   hatchSteps: 20000, sprite: 'pet_pixiel', trait: 'Détecte les easter eggs' },
  ];

  const ACHIEVEMENTS = [
    { id: 'premiers_pas',   name: 'Premiers Pas',       cond: s => s.totalSteps >= 100 },
    { id: 'marathonien',    name: 'Marathonien',        cond: s => s.totalSteps >= 42195 },
    { id: 'niveau_10',      name: 'Niveau 10',          cond: s => s.level >= 10 },
    { id: 'niveau_25',      name: 'Maître Aventurier',  cond: s => s.level >= 25 },
    { id: 'collectionneur', name: 'Collectionneur',     cond: s => Object.keys(s.bestiary).length >= MONSTERS.length },
    { id: 'eleveur',        name: 'Éleveur Expert',     cond: s => s.pets.filter(p=>p.hatched).length >= 2 },
    { id: 'tueur_boss',     name: 'Tueur de Boss',      cond: s => (s.raidsWon||0) >= 1 },
    { id: 'riche',          name: 'Riche du Royaume',   cond: s => s.coins >= 5000 },
    { id: 'huit_mille',     name: 'Au-delà du Seuil',   cond: s => (s.dailyStepsBest||0) >= CONFIG.DAILY_BONUS_THRESHOLD },
  ];

  const SEASONS = ['printemps', 'ete', 'automne', 'hiver'];
  const WEATHERS = [
    { id: 'soleil',  name: 'Soleil',     mod: { xp: 1.05, coin: 1.0 }, sprite: 'wx_sun' },
    { id: 'pluie',   name: 'Pluie',      mod: { xp: 0.95, coin: 1.10 }, sprite: 'wx_rain' },
    { id: 'orage',   name: 'Orage',      mod: { xp: 1.15, coin: 0.90 }, sprite: 'wx_storm' },
    { id: 'neige',   name: 'Neige',      mod: { xp: 1.00, coin: 1.05 }, sprite: 'wx_snow' },
    { id: 'brume',   name: 'Brume',      mod: { xp: 1.10, coin: 1.0 }, sprite: 'wx_fog' },
  ];

  // ---------------------------------------------------------------------------
  // Quêtes
  // ---------------------------------------------------------------------------
  const QUEST_TEMPLATES = [
    { id: 'q_walk_500',  giver: 'taverniere', name: 'Petite balade',  goal: 500,  reward: { xp: 60,  coin: 30 } },
    { id: 'q_walk_2000', giver: 'taverniere', name: 'Tour du village',goal: 2000, reward: { xp: 250, coin: 120 } },
    { id: 'q_walk_5000', giver: 'sage',       name: 'Pèlerinage',     goal: 5000, reward: { xp: 700, coin: 250 } },
    { id: 'q_walk_8000', giver: 'sage',       name: 'Au-delà du Seuil',goal: 8000, reward: { xp: 1500, coin: 500 } },
    { id: 'q_kill_slime',giver: 'forgeron',   name: 'Premier sang',   goal: 3,    reward: { xp: 200, coin: 80 }, type:'kill', target:'slime' },
    { id: 'q_hatch_pet', giver: 'eleveur',    name: 'Premier familier',goal:1,    reward: { xp: 400, coin: 150 }, type:'hatch' },
  ];

  // ---------------------------------------------------------------------------
  // État par défaut
  // ---------------------------------------------------------------------------
  function defaultState() {
    return {
      version: 1,
      character: null,             // {name, classId, hair, hairColor, skin}
      level: 1,
      xp: 0,
      totalSteps: 0,
      lifetimeSteps: 0,
      coins: 50,
      // Sessions de pas (anti-triche)
      stepEvents: [],              // [{t, n}]
      // Inventaire & équipement
      inventory: [],               // [{id, qty}]
      equipped: { weapon: null, armor: null },
      // Familiers
      pets: [],                    // [{id, hatched:bool, progress:steps}]
      eggIncubating: null,         // {petId, steps}
      // Quêtes
      activeQuests: [],            // {id, progress}
      completedQuests: [],
      // Bestiaire (kills)
      bestiary: {},                // {monsterId: count}
      // Achievements
      achievements: [],            // [id]
      // Raid
      raid: { bossId: 'dragon_fer', hp: CONFIG.WEEKLY_BOSS_BASE_HP, week: weekKey(), participated: 0 },
      raidsWon: 0,
      // Météo & saison
      weatherId: 'soleil',
      weatherDay: dayKey(),
      // Carte
      pos: { x: 4, y: 4 },         // tuile sur la grille du monde
      worldStepsBuffer: 0,
      // Quotidien
      dailySteps: 0,
      dailyStepsBest: 0,
      dailyKey: dayKey(),
      doubledToday: false,
      // Anti-cheat
      flags: [],
    };
  }

  function dayKey(d) {
    d = d || new Date();
    return d.getUTCFullYear() + '-' + (d.getUTCMonth()+1) + '-' + d.getUTCDate();
  }
  function weekKey(d) {
    d = d || new Date();
    const onejan = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay()+1)/7);
    return d.getUTCFullYear() + '-W' + week;
  }
  function seasonNow(d) {
    d = d || new Date();
    const m = d.getUTCMonth();
    if (m<2 || m===11) return 'hiver';
    if (m<5) return 'printemps';
    if (m<8) return 'ete';
    return 'automne';
  }

  // ---------------------------------------------------------------------------
  // Calculs (purs, testables)
  // ---------------------------------------------------------------------------
  function xpForLevel(level) {
    // Coût pour passer de `level` à `level+1`. Exponentiel.
    return Math.floor(CONFIG.XP_BASE * Math.pow(CONFIG.XP_GROWTH, level - 1));
  }
  function totalXpToReach(level) {
    let s = 0;
    for (let i = 1; i < level; i++) s += xpForLevel(i);
    return s;
  }
  function levelFromTotalXp(totalXp) {
    let lvl = 1, cum = 0;
    while (cum + xpForLevel(lvl) <= totalXp) { cum += xpForLevel(lvl); lvl++; if (lvl > 999) break; }
    return { level: lvl, xpInLevel: totalXp - cum, xpForNext: xpForLevel(lvl) };
  }

  function inventoryWeight(state) {
    return state.inventory.reduce((a, it) => a + it.qty, 0);
  }
  function isEncumbered(state) {
    return inventoryWeight(state) >= CONFIG.INVENTORY_SOFT_CAP;
  }

  // ---------------------------------------------------------------------------
  // Anti-triche : valide un lot de pas avant ingestion
  // ---------------------------------------------------------------------------
  function validateSteps(state, n, now) {
    now = now || Date.now();
    const issues = [];
    if (!Number.isFinite(n) || n < 0) return { ok:false, accepted:0, issues:['valeur invalide'] };
    if (n > CONFIG.SUSPICIOUS_BURST) {
      issues.push('burst suspect (>'+CONFIG.SUSPICIOUS_BURST+' pas en un coup)');
    }
    // Cadence : pas plus de MAX_STEPS_PER_MINUTE sur 60s glissantes.
    const oneMinuteAgo = now - 60000;
    const recent = state.stepEvents.filter(e => e.t >= oneMinuteAgo).reduce((a,e)=>a+e.n, 0);
    if (recent + n > CONFIG.MAX_STEPS_PER_MINUTE) {
      issues.push('cadence > '+CONFIG.MAX_STEPS_PER_MINUTE+' pas/min');
    }
    // Cadence ultra-courte 1s
    const oneSecAgo = now - 1000;
    const veryRecent = state.stepEvents.filter(e => e.t >= oneSecAgo).reduce((a,e)=>a+e.n, 0);
    if (veryRecent + n > CONFIG.MAX_STEPS_PER_SECOND * 5) {
      issues.push('cadence > '+(CONFIG.MAX_STEPS_PER_SECOND*5)+' pas/s');
    }
    // Si suspect : on accepte mais on cap à un plafond raisonnable
    let accepted = n;
    if (issues.length) {
      const allowed = Math.max(0, CONFIG.MAX_STEPS_PER_MINUTE - recent);
      accepted = Math.min(n, allowed);
    }
    return { ok: issues.length === 0, accepted, issues };
  }

  // ---------------------------------------------------------------------------
  // Application d'un lot de pas valides
  // ---------------------------------------------------------------------------
  function ingestSteps(state, rawN, now) {
    now = now || Date.now();
    rotateDayIfNeeded(state, now);
    rotateWeekIfNeeded(state, now);
    rotateWeatherIfNeeded(state, now);

    const v = validateSteps(state, rawN, now);
    if (v.issues.length) state.flags.push({ t: now, issues: v.issues, raw: rawN, kept: v.accepted });

    let n = v.accepted;
    if (n <= 0) return { gainedXp:0, gainedCoins:0, levelUps:[], issues:v.issues };

    // Encombrement : 110 pas pour 100 XP
    let effectiveSteps = n;
    if (isEncumbered(state)) {
      effectiveSteps = Math.floor(n / CONFIG.ENCUMBRANCE_PENALTY);
    }

    // Multiplicateurs
    const weather = WEATHERS.find(w=>w.id===state.weatherId) || WEATHERS[0];
    let xpMult = weather.mod.xp;
    let coinMult = weather.mod.coin;

    // Classe
    const klass = state.character ? CLASSES.find(c=>c.id===state.character.classId) : null;
    if (klass && klass.id === 'rodeur') coinMult *= 1.05;

    // Familiers
    state.pets.forEach(p => {
      const def = PETS.find(P=>P.id===p.id);
      if (p.hatched && def) {
        if (def.id==='foxy') xpMult *= 1.02;
        if (def.id==='slimon') coinMult *= 1.0;
      }
    });

    // Seuil journalier
    if (state.dailySteps >= CONFIG.DAILY_BONUS_THRESHOLD) {
      xpMult *= CONFIG.DAILY_BONUS_MULT;
      state.doubledToday = true;
    }

    let gainedXp = Math.floor(effectiveSteps * CONFIG.XP_PER_STEP * xpMult);
    let coinsRaw = effectiveSteps * (CONFIG.COIN_PER_100_STEPS / 100) * coinMult;
    if (klass && klass.id==='rodeur') coinsRaw *= 1.0;
    let gainedCoins = Math.floor(coinsRaw);

    // Pet slimon bonus
    if (state.pets.some(p=>p.id==='slimon' && p.hatched)) {
      gainedCoins += Math.floor(effectiveSteps / 100);
    }

    // Application
    state.totalSteps += n;
    state.lifetimeSteps += n;
    state.dailySteps += n;
    if (state.dailySteps > state.dailyStepsBest) state.dailyStepsBest = state.dailySteps;
    state.stepEvents.push({ t: now, n });
    if (state.stepEvents.length > 200) state.stepEvents = state.stepEvents.slice(-200);

    state.coins += gainedCoins;
    const before = state.level;
    addXp(state, gainedXp);
    const levelUps = [];
    while (state.level > before + levelUps.length) levelUps.push(state.level);

    // Quêtes de marche & raid & couvée & monde
    state.activeQuests.forEach(q => {
      const tpl = QUEST_TEMPLATES.find(t=>t.id===q.id);
      if (!tpl) return;
      if (!tpl.type || tpl.type === undefined) {
        q.progress = Math.min(tpl.goal, q.progress + n);
      }
    });
    // Raid : chaque pas = 1 dégât
    if (state.raid && state.raid.hp > 0) {
      const dmg = n; // 1 pas = 1 PV
      state.raid.hp = Math.max(0, state.raid.hp - dmg);
      state.raid.participated += n;
      if (state.raid.hp === 0) {
        state.raidsWon = (state.raidsWon || 0) + 1;
        const boss = RAID_BOSSES.find(b=>b.id===state.raid.bossId);
        if (boss) addItem(state, boss.reward, 1);
      }
    }
    // Œuf en couvée
    if (state.eggIncubating) {
      state.eggIncubating.steps += n;
      const def = PETS.find(p=>p.id===state.eggIncubating.petId);
      if (def && state.eggIncubating.steps >= def.hatchSteps) {
        state.pets.push({ id: def.id, hatched: true, progress: def.hatchSteps });
        // satisfait quête hatch
        state.activeQuests.forEach(q=>{
          const tpl = QUEST_TEMPLATES.find(t=>t.id===q.id);
          if (tpl && tpl.type==='hatch') q.progress = tpl.goal;
        });
        state.eggIncubating = null;
      }
    }
    // Carte : déplacer le héros
    state.worldStepsBuffer += n;
    while (state.worldStepsBuffer >= 50) {
      state.worldStepsBuffer -= 50;
      stepWorld(state);
    }

    // Achievements
    refreshAchievements(state);

    return { gainedXp, gainedCoins, levelUps, issues: v.issues };
  }

  function addXp(state, amount) {
    state.xp += amount;
    while (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level += 1;
    }
  }

  function rotateDayIfNeeded(state, now) {
    const today = dayKey(new Date(now));
    if (state.dailyKey !== today) {
      state.dailyKey = today;
      state.dailySteps = 0;
      state.doubledToday = false;
    }
  }
  function rotateWeekIfNeeded(state, now) {
    const w = weekKey(new Date(now));
    if (state.raid.week !== w) {
      // si non vaincu, on garde quand même la mémoire de l'effort, on reset
      const idx = (Math.abs(hashStr(w)) % RAID_BOSSES.length);
      const boss = RAID_BOSSES[idx];
      state.raid = { bossId: boss.id, hp: boss.hp, week: w, participated: 0 };
    }
  }
  function rotateWeatherIfNeeded(state, now) {
    const today = dayKey(new Date(now));
    if (state.weatherDay !== today) {
      const seed = hashStr(today + (state.character?state.character.name:''));
      state.weatherId = WEATHERS[Math.abs(seed) % WEATHERS.length].id;
      state.weatherDay = today;
    }
  }

  function hashStr(s) {
    let h = 0;
    for (let i=0;i<s.length;i++) { h = (h<<5) - h + s.charCodeAt(i); h |= 0; }
    return h;
  }

  function stepWorld(state) {
    // Déplacement RPG sur grille 9x9. Boucle.
    // Direction selon hash du tick pour varier.
    const seed = hashStr(state.totalSteps + ':' + state.dailyKey);
    const dirs = [[1,0],[0,1],[-1,0],[0,-1]];
    const d = dirs[Math.abs(seed) % 4];
    state.pos.x = (state.pos.x + d[0] + 9) % 9;
    state.pos.y = (state.pos.y + d[1] + 9) % 9;
  }

  function addItem(state, id, qty) {
    qty = qty || 1;
    if (inventoryWeight(state) >= CONFIG.INVENTORY_HARD_CAP) return false;
    const ex = state.inventory.find(it=>it.id===id);
    if (ex) ex.qty += qty;
    else state.inventory.push({ id, qty });
    return true;
  }
  function removeItem(state, id, qty) {
    qty = qty || 1;
    const ex = state.inventory.find(it=>it.id===id);
    if (!ex || ex.qty < qty) return false;
    ex.qty -= qty;
    if (ex.qty <= 0) state.inventory = state.inventory.filter(it=>it.id!==id);
    return true;
  }

  function buy(state, itemId) {
    const item = SHOP_ITEMS.find(i=>i.id===itemId);
    if (!item) return { ok:false, reason:'item inconnu' };
    if (state.coins < item.price) return { ok:false, reason:'pas assez de pièces' };
    if (inventoryWeight(state) >= CONFIG.INVENTORY_HARD_CAP) return { ok:false, reason:'inventaire plein' };
    state.coins -= item.price;
    addItem(state, item.id, 1);
    if (item.id === 'oeuf_mystere') {
      // démarre une couvée si aucune en cours
      if (!state.eggIncubating) {
        const idx = Math.abs(hashStr(itemId+state.totalSteps)) % PETS.length;
        state.eggIncubating = { petId: PETS[idx].id, steps: 0 };
      }
    }
    return { ok:true, item };
  }
  function sell(state, itemId) {
    const item = SHOP_ITEMS.find(i=>i.id===itemId);
    if (!item) return { ok:false };
    if (!removeItem(state, itemId, 1)) return { ok:false, reason:'aucun en stock' };
    const refund = Math.floor(item.price * 0.4);
    state.coins += refund;
    return { ok:true, refund };
  }

  function acceptQuest(state, questId) {
    if (state.activeQuests.find(q=>q.id===questId)) return false;
    if (state.completedQuests.includes(questId)) return false;
    const tpl = QUEST_TEMPLATES.find(t=>t.id===questId);
    if (!tpl) return false;
    state.activeQuests.push({ id: questId, progress: 0 });
    return true;
  }
  function turnInQuest(state, questId) {
    const q = state.activeQuests.find(x=>x.id===questId);
    if (!q) return { ok:false };
    const tpl = QUEST_TEMPLATES.find(t=>t.id===questId);
    if (!tpl) return { ok:false };
    if (q.progress < tpl.goal) return { ok:false, reason:'objectif non atteint' };
    state.activeQuests = state.activeQuests.filter(x=>x.id!==questId);
    state.completedQuests.push(questId);
    addXp(state, tpl.reward.xp);
    state.coins += tpl.reward.coin;
    return { ok:true, reward: tpl.reward };
  }

  function fight(state, monsterId) {
    const m = MONSTERS.find(x=>x.id===monsterId);
    if (!m) return { ok:false };
    // dégâts du joueur basés sur niveau + arme
    const weapon = state.equipped.weapon ? SHOP_ITEMS.find(i=>i.id===state.equipped.weapon) : null;
    const wDmg = weapon ? (weapon.id.includes('fer') ? 15 : weapon.id.includes('eclat') ? 12 : 5) : 2;
    const dmg = state.level * 4 + wDmg;
    const win = dmg >= m.hp / 4; // simplifié
    if (win) {
      state.bestiary[m.id] = (state.bestiary[m.id] || 0) + 1;
      addXp(state, m.xp);
      state.coins += Math.floor(m.xp / 4);
      // loot aléatoire
      const lootId = m.loot[Math.abs(hashStr(state.totalSteps+m.id)) % m.loot.length];
      addItem(state, lootId, 1);
      state.activeQuests.forEach(q=>{
        const tpl = QUEST_TEMPLATES.find(t=>t.id===q.id);
        if (tpl && tpl.type==='kill' && tpl.target===m.id) q.progress = Math.min(tpl.goal, q.progress+1);
      });
      refreshAchievements(state);
    }
    return { ok: win, monster: m };
  }

  function refreshAchievements(state) {
    ACHIEVEMENTS.forEach(a => {
      if (!state.achievements.includes(a.id) && a.cond(state)) {
        state.achievements.push(a.id);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------
  global.PixelQuest = {
    CONFIG, CLASSES, HAIRSTYLES, SKIN_TONES, HAIR_COLORS, NPCS, MONSTERS,
    RAID_BOSSES, SHOP_ITEMS, PETS, ACHIEVEMENTS, SEASONS, WEATHERS, QUEST_TEMPLATES,
    defaultState,
    // calculs
    xpForLevel, totalXpToReach, levelFromTotalXp,
    inventoryWeight, isEncumbered,
    // mutations
    validateSteps, ingestSteps, addXp,
    addItem, removeItem,
    buy, sell,
    acceptQuest, turnInQuest, fight,
    refreshAchievements,
    // utils
    dayKey, weekKey, seasonNow, hashStr,
    rotateDayIfNeeded, rotateWeekIfNeeded, rotateWeatherIfNeeded,
  };
})(typeof window !== 'undefined' ? window : globalThis);
