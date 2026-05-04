/* PixelQuest – UI preview (téléphone + montre + debugger). */
(function () {
  'use strict';

  const PQ = window.PixelQuest;
  const PS = window.PixelSprites;
  const PT = window.PixelTests;
  const PSync = window.PixelSync;

  const STORE_KEY = 'pixelquest_state_v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return PQ.defaultState();
      const s = JSON.parse(raw);
      // run autoFix au chargement, au cas où
      PT.autoFix(s);
      return s;
    } catch (e) {
      console.warn('Erreur chargement, état neuf', e);
      return PQ.defaultState();
    }
  }
  function saveState(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  let state = loadState();
  let activeTab = 'map';
  let activeWatchTab = 'main';
  let lastDialogue = null;
  let tickerHandle = null;

  // ------ Personnage par défaut si premier lancement ------
  if (!state.character) {
    state.character = {
      name: 'Aventurier',
      classId: 'guerrier',
      hair: 'short',
      hairColor: '#8b4513',
      skin: '#f4c79a',
    };
    saveState(state);
  }

  // ------ Helpers UI --------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ------ Heros canvas ------------------------------------------------------
  function paintHeroInto(canvas, charOverride) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const c = charOverride || state.character;
    const sprite = PS.makeSprite('hero', { skin: c.skin, hairColor: c.hairColor, classId: c.classId });
    ctx.drawImage(sprite, 0, 0, canvas.width, canvas.height);
  }

  // ------ Render PHONE ------------------------------------------------------
  function renderPhone() {
    // HUD
    paintHeroInto($('#phoneHero'));
    $('#phoneName').textContent = state.character.name + ' · ' + (PQ.CLASSES.find(c=>c.id===state.character.classId)||{name:'?'}).name;
    $('#phoneLvl').textContent = state.level;
    $('#phoneCoins').textContent = state.coins;
    const need = PQ.xpForLevel(state.level);
    $('#phoneXpFill').style.width = Math.min(100, (state.xp/need)*100) + '%';
    $('#phoneXpLabel').textContent = state.xp + ' / ' + need + ' XP';
    $('#phoneDailySteps').textContent = state.dailySteps;
    const thresh = PQ.CONFIG.DAILY_BONUS_THRESHOLD;
    $('#phoneThreshold').textContent = state.dailySteps >= thresh
      ? '✓ Bonus x2 actif !'
      : 'Seuil ' + thresh + ' : ' + Math.max(0, thresh-state.dailySteps) + ' restants';
    const wx = PQ.WEATHERS.find(w=>w.id===state.weatherId) || PQ.WEATHERS[0];
    $('#phoneWeather').innerHTML = '';
    $('#phoneWeather').appendChild(PS.makeSprite('wx_'+wx.id, {scale:2}, 16));
    $('#phoneWeather').appendChild(document.createTextNode(' ' + wx.name + ' · ' + PQ.seasonNow()));

    // Tab content
    if (activeTab === 'map')          renderMap();
    if (activeTab === 'quests')       renderQuests();
    if (activeTab === 'shop')         renderShop();
    if (activeTab === 'bestiary')     renderBestiary();
    if (activeTab === 'pets')         renderPets();
    if (activeTab === 'raid')         renderRaid();
    if (activeTab === 'char')         renderChar();
    if (activeTab === 'achievements') renderAchievements();
  }

  function renderMap() {
    const grid = $('#phoneMap');
    grid.innerHTML = '';
    const tiles = makeWorld();
    for (let y=0; y<9; y++) {
      for (let x=0; x<9; x++) {
        const cell = el('div', 'map-cell');
        const c = PS.makeSprite('tile_'+tiles[y][x], { scale: 2 }, 16);
        c.style.width = '100%'; c.style.height = '100%';
        cell.appendChild(c);
        if (x === state.pos.x && y === state.pos.y) {
          const m = el('div','marker','🧙');
          cell.appendChild(m);
        } else {
          const npc = npcAt(x, y);
          if (npc) {
            const m = el('div','marker', npcEmoji(npc.id));
            cell.appendChild(m);
          }
        }
        grid.appendChild(cell);
      }
    }
    // Dialogue : si on est sur un NPC, parle
    const npcHere = npcAt(state.pos.x, state.pos.y);
    const d = $('#phoneDialogue');
    if (npcHere) {
      const lines = npcHere.dialogues;
      const line = lines[Math.abs(PQ.hashStr(state.totalSteps + npcHere.id)) % lines.length];
      d.innerHTML = '<span class="who">' + escapeHtml(npcHere.name) + ' :</span>' + escapeHtml(line);
      lastDialogue = npcHere.id + ':' + line;
    } else {
      d.innerHTML = '<span class="who">Narrateur :</span>Tu marches sur le sentier. (Pas d\'approche : ouvre l\'onglet Quêtes.)';
    }
  }

  function makeWorld() {
    // Monde 9x9 déterministe (les types de tuiles).
    const rows = [];
    const seed = 'world-v1';
    for (let y=0;y<9;y++){
      const row = [];
      for (let x=0;x<9;x++){
        const h = Math.abs(PQ.hashStr(seed+':'+x+':'+y));
        let kind = 'grass';
        const m = h % 100;
        if (m < 8) kind = 'water';
        else if (m < 22) kind = 'forest';
        else if (m < 30) kind = 'sand';
        else if (m < 36) kind = 'stone';
        else if (m < 40) kind = 'snow';
        row.push(kind);
      }
      rows.push(row);
    }
    return rows;
  }
  function npcAt(x,y) {
    const positions = {
      'taverniere': [4,4],
      'forgeron':   [2,6],
      'sage':       [6,2],
      'eleveur':    [7,7],
    };
    for (const id in positions) {
      const [px,py] = positions[id];
      if (px===x && py===y) return PQ.NPCS.find(n=>n.id===id);
    }
    return null;
  }
  function npcEmoji(id) {
    return ({ taverniere:'🍺', forgeron:'🔨', sage:'📜', eleveur:'🥚' })[id] || '👤';
  }

  function renderQuests() {
    const active = $('#phoneActiveQuests');
    const avail  = $('#phoneAvailableQuests');
    active.innerHTML = ''; avail.innerHTML = '';
    if (state.activeQuests.length === 0) active.innerHTML = '<i style="color:#b9aee0">Aucune quête active.</i>';
    state.activeQuests.forEach(q => {
      const tpl = PQ.QUEST_TEMPLATES.find(t=>t.id===q.id); if (!tpl) return;
      const giver = PQ.NPCS.find(n=>n.id===tpl.giver);
      const div = el('div','quest');
      const pct = Math.min(100, Math.floor((q.progress/tpl.goal)*100));
      div.innerHTML =
        '<div class="qhead"><span class="qname">'+escapeHtml(tpl.name)+'</span>'+
        '<span class="qprog">'+q.progress+' / '+tpl.goal+'</span></div>'+
        '<div style="font-size:13px;color:#b9aee0">de '+escapeHtml(giver?giver.name:'?')+
        ' · récompense '+tpl.reward.xp+' XP, '+tpl.reward.coin+'🪙</div>'+
        '<div class="qbar"><div class="qfill" style="width:'+pct+'%"></div></div>'+
        '<div class="qact"></div>';
      const acts = div.querySelector('.qact');
      if (q.progress >= tpl.goal) {
        const b = document.createElement('button'); b.textContent = 'Rendre'; b.onclick = () => {
          const r = PQ.turnInQuest(state, q.id);
          if (r.ok) flashLog('ok', 'Quête « '+tpl.name+' » rendue. +'+r.reward.xp+' XP, +'+r.reward.coin+'🪙');
          syncAndRender();
        };
        acts.appendChild(b);
      }
      active.appendChild(div);
    });
    PQ.QUEST_TEMPLATES.forEach(tpl => {
      const isActive = state.activeQuests.find(q=>q.id===tpl.id);
      const isDone   = state.completedQuests.includes(tpl.id);
      if (isActive || isDone) return;
      const giver = PQ.NPCS.find(n=>n.id===tpl.giver);
      const div = el('div','quest');
      div.innerHTML =
        '<div class="qhead"><span class="qname">'+escapeHtml(tpl.name)+'</span>'+
        '<span class="qprog">objectif '+tpl.goal+(tpl.type?' '+(tpl.type==='kill'?tpl.target:tpl.type):'')+'</span></div>'+
        '<div style="font-size:13px;color:#b9aee0">de '+escapeHtml(giver?giver.name:'?')+
        ' · récompense '+tpl.reward.xp+' XP, '+tpl.reward.coin+'🪙</div>'+
        '<div class="qact"></div>';
      const b = document.createElement('button'); b.textContent = 'Accepter'; b.onclick = () => {
        if (PQ.acceptQuest(state, tpl.id)) {
          flashLog('ok', 'Quête « '+tpl.name+' » acceptée.');
        }
        syncAndRender();
      };
      div.querySelector('.qact').appendChild(b);
      avail.appendChild(div);
    });
  }

  function renderShop() {
    const g = $('#phoneShop'); g.innerHTML = '';
    PQ.SHOP_ITEMS.forEach(it => {
      const card = el('div','item');
      card.innerHTML =
        '<div class="iname">'+escapeHtml(it.name)+'</div>'+
        '<div class="idesc">'+escapeHtml(it.desc)+'</div>'+
        '<div class="iprice">'+it.price+'🪙</div>';
      const b = document.createElement('button'); b.textContent='Acheter'; b.onclick=()=>{
        const r = PQ.buy(state, it.id);
        if (r.ok) flashLog('ok','Acheté : '+it.name);
        else flashLog('ko','Achat impossible : '+r.reason);
        syncAndRender();
      };
      card.appendChild(b);
      g.appendChild(card);
    });

    const inv = $('#phoneInv'); inv.innerHTML = '';
    $('#phoneInvCount').textContent = PQ.inventoryWeight(state);
    state.inventory.forEach(it => {
      const def = PQ.SHOP_ITEMS.find(s=>s.id===it.id) || { name: it.id, desc:'objet', price: 5, type:'misc' };
      const card = el('div','item');
      card.innerHTML =
        '<div class="iname">'+escapeHtml(def.name)+' x'+it.qty+'</div>'+
        '<div class="idesc">'+escapeHtml(def.desc||'objet')+'</div>'+
        '<div class="iprice">vente '+Math.floor(def.price*0.4)+'🪙</div>';
      const b = document.createElement('button'); b.textContent='Vendre'; b.onclick=()=>{
        const r = PQ.sell(state, it.id);
        if (r.ok) flashLog('ok','Vendu : '+def.name+' (+'+r.refund+'🪙)');
        syncAndRender();
      };
      card.appendChild(b);
      // Equip pour armes/armures
      if (def.type === 'weapon' || def.type === 'armor') {
        const e = document.createElement('button'); e.textContent='Équiper';
        e.onclick = () => {
          const slot = def.type;
          state.equipped[slot] = it.id;
          flashLog('ok','Équipé : '+def.name);
          syncAndRender();
        };
        card.appendChild(e);
      }
      inv.appendChild(card);
    });
    $('#phoneEncumbered').textContent = PQ.isEncumbered(state)
      ? '⚠ Encombrement : 110 pas pour 100 XP. Vendez ou déposez à la Taverne.'
      : '';
  }

  function renderBestiary() {
    const g = $('#phoneBestiary'); g.innerHTML = '';
    PQ.MONSTERS.forEach(m => {
      const seen = (state.bestiary[m.id]||0) > 0;
      const card = el('div','bestiary-card' + (seen?'':' locked'));
      const c = PS.makeSprite(m.sprite, { scale: 2 });
      c.style.width = '48px'; c.style.height = '48px';
      card.appendChild(c);
      const info = el('div','info');
      info.innerHTML =
        '<div class="name">'+escapeHtml(seen?m.name:'???')+'</div>'+
        '<div class="meta">PV '+m.hp+' · XP '+m.xp+' · Tier '+m.tier+'</div>'+
        '<div class="meta">Vaincus : '+(state.bestiary[m.id]||0)+'</div>';
      card.appendChild(info);
      const b = document.createElement('button'); b.textContent='Combattre'; b.onclick=()=>{
        const r = PQ.fight(state, m.id);
        if (r.ok) flashLog('ok','Vaincu : '+m.name);
        else     flashLog('ko','Trop fort. Reviens plus tard.');
        syncAndRender();
      };
      card.appendChild(b);
      g.appendChild(card);
    });
  }

  function renderPets() {
    const eggDiv = $('#phoneEgg');
    if (state.eggIncubating) {
      const def = PQ.PETS.find(p=>p.id===state.eggIncubating.petId);
      const c = PS.makeSprite('item_egg', {scale:2});
      eggDiv.innerHTML = '';
      eggDiv.appendChild(c);
      const info = el('div','');
      const pct = Math.min(100, Math.floor((state.eggIncubating.steps/def.hatchSteps)*100));
      info.innerHTML = '<div class="iname">Œuf en couvée</div>'+
        '<div class="idesc">Marche pour faire éclore… ('+state.eggIncubating.steps+' / '+def.hatchSteps+' pas — '+pct+'%)</div>';
      eggDiv.appendChild(info);
    } else {
      eggDiv.innerHTML = '<i style="color:#b9aee0">Aucun œuf en couvée. Achète un Œuf Mystère à la boutique.</i>';
    }
    const g = $('#phonePets'); g.innerHTML = '';
    PQ.PETS.forEach(p => {
      const owned = state.pets.find(x=>x.id===p.id && x.hatched);
      const card = el('div','pet-card' + (owned?'':' locked'));
      if (!owned) card.style.filter = 'grayscale(1) brightness(0.5)';
      const c = PS.makeSprite(p.sprite, { scale: 2 });
      c.style.width = '64px'; c.style.height = '64px';
      card.appendChild(c);
      card.appendChild(el('div','iname',escapeHtml(p.name)));
      card.appendChild(el('div','idesc','éclot à '+p.hatchSteps+' pas'));
      card.appendChild(el('div','idesc',escapeHtml(p.trait)));
      g.appendChild(card);
    });
  }

  function renderRaid() {
    const div = $('#phoneRaid');
    div.innerHTML = '';
    const boss = PQ.RAID_BOSSES.find(b=>b.id===state.raid.bossId) || PQ.RAID_BOSSES[0];
    const c = PS.makeSprite('boss_dragon', { scale: 4 }, 32);
    c.style.width = '128px'; c.style.height = '128px';
    div.appendChild(c);
    div.appendChild(el('div','raid-name','BOSS · '+escapeHtml(boss.name)));
    const total = boss.hp;
    const cur = state.raid.hp;
    const pct = Math.max(0, Math.min(100, (cur/total)*100));
    const bar = el('div','raid-bar');
    bar.innerHTML = '<div class="rfill" style="width:'+pct+'%"></div><span>'+cur+' / '+total+' PV</span>';
    div.appendChild(bar);
    div.appendChild(el('div','raid-info',
      'Chaque pas = 1 dégât. Tu as jusqu\'à dimanche soir. ' +
      (cur===0 ? '🏆 BOSS VAINCU ! Récompense : '+boss.reward : 'Total infligé : '+state.raid.participated)
    ));
  }

  function renderChar() {
    const root = $('#phoneCharBuilder');
    root.innerHTML = '';
    // preview
    const prev = el('div','preview-hero');
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    c.style.width = '128px'; c.style.height = '128px'; c.style.imageRendering = 'pixelated';
    prev.appendChild(c);
    paintHeroInto(c);
    root.appendChild(prev);

    // name
    const nameRow = el('div','char-row');
    nameRow.innerHTML = '<label>Nom</label>';
    const inp = document.createElement('input'); inp.type='text'; inp.value = state.character.name;
    inp.maxLength = 16;
    inp.oninput = () => { state.character.name = inp.value || 'Aventurier'; saveState(state); syncAndRender(); };
    nameRow.appendChild(inp);
    root.appendChild(nameRow);

    // class
    const cl = el('div','char-row'); cl.innerHTML = '<label>Classe</label>';
    const grid = el('div','class-grid');
    PQ.CLASSES.forEach(k => {
      const card = el('div','class-card' + (state.character.classId===k.id?' active':''));
      card.innerHTML = '<div class="iname">'+escapeHtml(k.name)+'</div><div class="idesc" style="font-size:11px">'+escapeHtml(k.desc)+'</div>';
      card.onclick = () => { state.character.classId = k.id; saveState(state); syncAndRender(); };
      grid.appendChild(card);
    });
    cl.appendChild(grid);
    root.appendChild(cl);

    // hair color
    const hc = el('div','char-row'); hc.innerHTML = '<label>Cheveux</label>';
    const hg = el('div','color-grid');
    PQ.HAIR_COLORS.forEach(col => {
      const sw = el('div','swatch'+(state.character.hairColor===col?' active':''));
      sw.style.background = col;
      sw.onclick = () => { state.character.hairColor = col; saveState(state); syncAndRender(); };
      hg.appendChild(sw);
    });
    hc.appendChild(hg);
    root.appendChild(hc);

    // skin
    const sk = el('div','char-row'); sk.innerHTML = '<label>Peau</label>';
    const sg = el('div','color-grid');
    PQ.SKIN_TONES.forEach(col => {
      const sw = el('div','swatch'+(state.character.skin===col?' active':''));
      sw.style.background = col;
      sw.onclick = () => { state.character.skin = col; saveState(state); syncAndRender(); };
      sg.appendChild(sw);
    });
    sk.appendChild(sg);
    root.appendChild(sk);

    // hairstyle (textuel pour l'instant)
    const hs = el('div','char-row'); hs.innerHTML = '<label>Coiffure</label>';
    PQ.HAIRSTYLES.forEach(h => {
      const b = document.createElement('button');
      b.textContent = h;
      if (state.character.hair===h) b.style.background = '#d36cb0';
      b.onclick = () => { state.character.hair = h; saveState(state); syncAndRender(); };
      hs.appendChild(b);
    });
    root.appendChild(hs);
  }

  function renderAchievements() {
    const g = $('#phoneAchievements'); g.innerHTML = '';
    PQ.ACHIEVEMENTS.forEach(a => {
      const got = state.achievements.includes(a.id);
      const div = el('div','ach ' + (got?'unlocked':'locked'));
      div.innerHTML = '<div class="aname">'+(got?'★ ':'')+escapeHtml(a.name)+'</div>';
      g.appendChild(div);
    });
  }

  // ------ Render WATCH ------------------------------------------------------
  function renderWatch() {
    const root = $('#watchContent');
    root.innerHTML = '';
    if (activeWatchTab === 'main') {
      // Heros + Niveau + XP + steps
      const c = document.createElement('canvas'); c.width=16; c.height=16;
      c.style.width='48px'; c.style.height='48px'; c.style.imageRendering='pixelated';
      paintHeroInto(c);
      root.appendChild(c);
      root.appendChild(rowNum('Niv.', state.level));
      const need = PQ.xpForLevel(state.level);
      const bar = el('div','watch-bar');
      bar.innerHTML = '<div class="fill" style="width:'+Math.min(100,(state.xp/need)*100)+'%"></div>';
      root.appendChild(bar);
      root.appendChild(rowNum('Pas', state.dailySteps));
      root.appendChild(rowNum('🪙', state.coins));
    } else if (activeWatchTab === 'quest') {
      const q = state.activeQuests[0];
      if (!q) { root.appendChild(rowLbl('Aucune quête')); }
      else {
        const tpl = PQ.QUEST_TEMPLATES.find(t=>t.id===q.id);
        root.appendChild(rowLbl(tpl?tpl.name:'?'));
        root.appendChild(rowNum(q.progress, tpl?tpl.goal:'?'));
        const bar = el('div','watch-bar');
        bar.innerHTML = '<div class="fill" style="background:#2ecc71;width:'+
          Math.min(100, Math.floor((q.progress/(tpl?tpl.goal:1))*100))+'%"></div>';
        root.appendChild(bar);
      }
    } else if (activeWatchTab === 'raid') {
      const boss = PQ.RAID_BOSSES.find(b=>b.id===state.raid.bossId);
      const c = PS.makeSprite('boss_dragon',{scale:2},32);
      c.style.width='64px'; c.style.height='64px';
      root.appendChild(c);
      root.appendChild(rowLbl(boss?boss.name:'?'));
      const bar = el('div','watch-bar');
      bar.innerHTML = '<div class="fill" style="background:linear-gradient(90deg,#7a1a1a,#ff5d6c);width:'+
        Math.min(100, (state.raid.hp/(boss?boss.hp:1))*100)+'%"></div>';
      root.appendChild(bar);
      root.appendChild(rowLbl(state.raid.hp+' PV'));
    } else if (activeWatchTab === 'pet') {
      if (state.eggIncubating) {
        const c = PS.makeSprite('item_egg',{scale:2});
        c.style.width='48px'; c.style.height='48px';
        root.appendChild(c);
        const def = PQ.PETS.find(p=>p.id===state.eggIncubating.petId);
        const bar = el('div','watch-bar');
        bar.innerHTML = '<div class="fill" style="background:#d36cb0;width:'+
          Math.min(100, Math.floor((state.eggIncubating.steps/def.hatchSteps)*100))+'%"></div>';
        root.appendChild(bar);
        root.appendChild(rowLbl(state.eggIncubating.steps+'/'+def.hatchSteps));
      } else if (state.pets.length) {
        const p = state.pets[0];
        const def = PQ.PETS.find(P=>P.id===p.id);
        const c = PS.makeSprite(def.sprite,{scale:2});
        c.style.width='48px'; c.style.height='48px';
        root.appendChild(c);
        root.appendChild(rowLbl(def.name));
      } else {
        root.appendChild(rowLbl('Aucun familier'));
      }
    }
  }
  function rowNum(label, num) {
    const r = el('div','w-row');
    r.innerHTML = '<span class="w-lbl">'+escapeHtml(String(label))+'</span><span class="w-num">'+escapeHtml(String(num))+'</span>';
    return r;
  }
  function rowLbl(t) {
    const r = el('div','w-row');
    r.innerHTML = '<span class="w-lbl">'+escapeHtml(String(t))+'</span>';
    return r;
  }

  // ------ Sync + render ----------------------------------------------------
  function syncAndRender() {
    // Auto-fix systématique : protège l'UI
    const fixed = PT.autoFix(state);
    if (fixed.length) flashLog('fix', 'Auto-fix : ' + fixed.join(', '));

    saveState(state);
    PSync.emit('state', state);
    renderPhone(); renderWatch();
    renderCheatLog();
    renderSyncStatus();
  }

  PSync.on('state', () => { /* autres consumers en hook */ });
  PSync.on('synced', () => { renderSyncStatus(); });

  function renderSyncStatus() {
    const st = PSync.status();
    const dot = $('#syncDot');
    const lbl = $('#syncLabel');
    if (st.pending > 0) { dot.classList.remove('ok'); lbl.textContent = 'Sync en cours…'; }
    else { dot.classList.add('ok'); lbl.textContent = 'Sync ✓ Phone ↔ Watch (' + new Date(st.lastSync).toLocaleTimeString() + ')'; }
  }
  function renderCheatLog() {
    const recent = state.flags.slice(-6).reverse().map(f =>
      new Date(f.t).toLocaleTimeString() + ' — ' + f.issues.join(', ') + ' (raw '+f.raw+', kept '+f.kept+')'
    );
    $('#cheatLog').textContent = recent.length ? recent.join('\n') : 'Aucune anomalie détectée.';
  }

  function flashLog(cls, msg) {
    const log = $('#debugLog');
    const span = '<span class="'+cls+'">' + escapeHtml(new Date().toLocaleTimeString()) + ' ' + escapeHtml(msg) + '</span>\n';
    log.innerHTML += span;
    log.scrollTop = log.scrollHeight;
  }

  // ------ Tabs handlers ----------------------------------------------------
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    activeTab = t.dataset.tab;
    $$('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane===activeTab));
    renderPhone();
  }));
  $$('.wtab').forEach(t => t.addEventListener('click', () => {
    $$('.wtab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    activeWatchTab = t.dataset.wtab;
    renderWatch();
  }));

  // ------ Top-bar handlers -------------------------------------------------
  $('#btnAddSteps').addEventListener('click', () => {
    const n = parseInt($('#simSteps').value, 10) || 50;
    const r = PQ.ingestSteps(state, n, Date.now());
    flashLog('info', '+'+r.gainedXp+' XP, +'+r.gainedCoins+'🪙'
      + (r.levelUps.length ? ' · LEVEL UP → '+r.levelUps.join(',') : '')
      + (r.issues.length ? ' · ⚠ '+r.issues.join('; ') : ''));
    syncAndRender();
  });
  $('#btnTick').addEventListener('click', () => {
    if (tickerHandle) { clearInterval(tickerHandle); tickerHandle = null; flashLog('info','Tick auto arrêté.'); return; }
    flashLog('info', 'Tick auto démarré : 50 pas / 5s');
    tickerHandle = setInterval(() => {
      const r = PQ.ingestSteps(state, 50, Date.now());
      if (r.levelUps.length) flashLog('ok', 'LEVEL UP → niv. '+r.levelUps.join(','));
      syncAndRender();
    }, 5000);
  });
  $('#btnReset').addEventListener('click', () => {
    if (!confirm('Réinitialiser TOUTE la progression ?')) return;
    state = PQ.defaultState();
    state.character = {
      name: 'Aventurier', classId: 'guerrier',
      hair: 'short', hairColor: '#8b4513', skin: '#f4c79a'
    };
    saveState(state);
    flashLog('info', 'État réinitialisé.');
    syncAndRender();
  });
  $('#simDate').valueAsDate = new Date();

  // ------ Debug actions ----------------------------------------------------
  $('#btnRunTests').addEventListener('click', () => {
    const log = $('#debugLog');
    log.innerHTML = '<span class="info">▶ Tests fonctionnels</span>\n';
    const fr = PT.runFunctionalTests();
    let pass = 0, fail = 0;
    fr.forEach(r => {
      const cls = r.ok ? 'ok' : 'ko';
      log.innerHTML += '<span class="'+cls+'">'+(r.ok?'✓':'✗')+' ['+r.id+'] '+escapeHtml(r.desc)+(r.msg?' — '+escapeHtml(r.msg):'')+'</span>\n';
      if (r.ok) pass++; else fail++;
    });
    log.innerHTML += '<span class="info">\n▶ Invariants sur état actuel</span>\n';
    const ir = PT.runInvariants(state);
    let ipass = 0, ifail = 0;
    ir.forEach(r => {
      const cls = r.ok ? 'ok' : 'ko';
      log.innerHTML += '<span class="'+cls+'">'+(r.ok?'✓':'✗')+' ['+r.id+']'+(r.err?' err:'+escapeHtml(r.err):'')+'</span>\n';
      if (r.ok) ipass++; else ifail++;
    });
    log.innerHTML += '<span class="info">\nRésumé : '+pass+'/'+fr.length+' fn, '+ipass+'/'+ir.length+' inv.</span>\n';
    if (fail+ifail>0) log.innerHTML += '<span class="fix">→ Cliquez « Auto-fix » pour réparer les invariants en échec.</span>\n';
    log.scrollTop = log.scrollHeight;
  });
  $('#btnAutoFix').addEventListener('click', () => {
    const fixed = PT.autoFix(state);
    if (fixed.length === 0) flashLog('ok', 'Aucun fix nécessaire — état sain.');
    else flashLog('fix', 'Auto-fix appliqué : ' + fixed.join(', '));
    syncAndRender();
  });
  $('#btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixelquest-state-'+Date.now()+'.json';
    a.click();
  });

  // Easter egg : Konami (↑↑↓↓←→←→BA)
  const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let konamiIdx = 0;
  document.addEventListener('keydown', (e) => {
    const want = konami[konamiIdx];
    if (e.key === want || e.key.toLowerCase() === want) {
      konamiIdx++;
      if (konamiIdx === konami.length) {
        konamiIdx = 0;
        state.coins += 1000;
        flashLog('ok', '🎉 Easter egg Konami ! +1000🪙');
        syncAndRender();
      }
    } else {
      konamiIdx = 0;
    }
  });

  // Init render
  syncAndRender();
  // Lance les tests une fois au démarrage pour confirmer que tout fonctionne
  setTimeout(() => $('#btnRunTests').click(), 200);
})();
