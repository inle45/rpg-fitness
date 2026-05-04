/* PixelQuest – UI mobile-first.
 * Logique : 3 vues (phone, watch, debug). Phone a 8 onglets en bottom-nav.
 * Tout est cliquable, tout doit fonctionner sur Android Chrome.
 */
(function () {
  'use strict';

  const PQ = window.PixelQuest;
  const PS = window.PixelSprites;
  const PT = window.PixelTests;
  const PSync = window.PixelSync;

  const STORE_KEY = 'pixelquest_state_v1';

  // Helpers DOM ---------------------------------------------------------------
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

  // State management ----------------------------------------------------------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return PQ.defaultState();
      const s = JSON.parse(raw);
      PT.autoFix(s);
      return s;
    } catch (e) {
      return PQ.defaultState();
    }
  }
  function saveState(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  let state = loadState();
  if (!state.character) {
    state.character = {
      name: 'Aventurier', classId: 'guerrier',
      hair: 'short', hairColor: '#8b4513', skin: '#f4c79a',
    };
    saveState(state);
  }

  let activeTab = 'map';
  let activeWatchTab = 'main';
  let activeView = 'phone';
  let tickerHandle = null;

  // ----- Sprites helpers -----------------------------------------------------
  /** Dessine un sprite généré (offscreen) sur un canvas cible (à n'importe
   *  quelle taille). Conserve le rendu pixel art. */
  function paintSpriteToCanvas(targetCanvas, kind, opts) {
    if (!targetCanvas) return;
    const sourceCanvas = PS.makeSprite(kind, opts || {}, kind === 'boss_dragon' ? 32 : 16);
    const ctx = targetCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    // Si le canvas cible a la même taille que la source, drawImage direct.
    // Sinon, on étire en pixelated (grâce à imageSmoothingEnabled=false).
    ctx.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
  }

  /** Retourne un nouveau canvas DOM avec le sprite voulu, à la taille
   *  d'affichage (px CSS). Le canvas interne reste en taille pixel art. */
  function spriteCanvas(kind, displaySize, opts) {
    const baseSize = kind === 'boss_dragon' ? 32 : 16;
    const c = document.createElement('canvas');
    c.width = baseSize; c.height = baseSize;
    c.style.width = displaySize + 'px';
    c.style.height = displaySize + 'px';
    c.style.imageRendering = 'pixelated';
    paintSpriteToCanvas(c, kind, opts);
    return c;
  }

  // ----- View switcher -------------------------------------------------------
  $$('.view-switcher button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      $$('.view-switcher button').forEach(b => b.classList.toggle('active', b === btn));
      $$('.view').forEach(v => v.classList.toggle('active', v.dataset.vid === target));
      activeView = target;
      // Cacher le FAB sauf en vue phone
      $('#btnAddSteps').style.display = target === 'phone' ? '' : 'none';
      $('#stepDrawer').classList.remove('visible');
      if (target === 'watch') renderWatch();
    });
  });

  // ----- Phone tabs ----------------------------------------------------------
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    activeTab = t.dataset.tab;
    $$('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === activeTab));
    renderPhonePane();
  }));

  // ----- Watch tabs ----------------------------------------------------------
  $$('.wtab').forEach(t => t.addEventListener('click', () => {
    $$('.wtab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    activeWatchTab = t.dataset.wtab;
    renderWatch();
  }));

  // ----- Toast ---------------------------------------------------------------
  let toastTimeout = null;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast visible' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => t.classList.remove('visible'), 2400);
  }

  // ----- Render PHONE --------------------------------------------------------
  function renderPhone() {
    // HUD
    paintSpriteToCanvas($('#phoneHero'), 'hero', {
      skin: state.character.skin,
      hairColor: state.character.hairColor,
      classId: state.character.classId,
    });
    const klass = PQ.CLASSES.find(c => c.id === state.character.classId);
    $('#phoneName').textContent = state.character.name + ' · ' + (klass ? klass.name : '?');
    $('#phoneLvl').textContent = state.level;
    $('#phoneCoins').textContent = state.coins;
    $('#phoneDailySteps').textContent = state.dailySteps;
    const need = PQ.xpForLevel(state.level);
    const pct = Math.max(0, Math.min(100, (state.xp / need) * 100));
    $('#phoneXpFill').style.width = pct + '%';
    $('#phoneXpLabel').textContent = state.xp + ' / ' + need + ' XP';

    // Météo
    const wx = PQ.WEATHERS.find(w => w.id === state.weatherId) || PQ.WEATHERS[0];
    paintSpriteToCanvas($('#phoneWeatherIcon'), 'wx_' + wx.id);
    $('#phoneWeatherName').textContent = wx.name;
    // Backup texte météo dans la barre de stats si l'icône est masquée
    const stepsSpan = $('#phoneDailySteps');
    if (stepsSpan && stepsSpan.parentElement) {
      stepsSpan.parentElement.title = 'Météo : ' + wx.name + ' · Saison : ' + PQ.seasonNow();
    }

    // Threshold
    const tBar = $('#phoneThreshold');
    const thresh = PQ.CONFIG.DAILY_BONUS_THRESHOLD;
    const tpct = Math.min(100, (state.dailySteps / thresh) * 100);
    $('#phoneTFill').style.width = tpct + '%';
    if (state.dailySteps >= thresh) {
      tBar.classList.add('active');
      $('#phoneTLabel').textContent = '✓ Bonus x2 !';
    } else {
      tBar.classList.remove('active');
      $('#phoneTLabel').textContent = state.dailySteps + ' / ' + thresh;
    }

    renderPhonePane();
  }

  function renderPhonePane() {
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
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const cell = el('div', 'map-cell');
        cell.style.background = tileColor(tiles[y][x]);
        if (state.pos.x === x && state.pos.y === y) {
          cell.classList.add('player');
          cell.textContent = '🧙';
        } else {
          const npc = npcAt(x, y);
          if (npc) {
            cell.textContent = npcEmoji(npc.id);
            cell.classList.add('npc-' + (npc.id === 'taverniere' ? 'tav' : npc.id === 'forgeron' ? 'smith' : npc.id === 'sage' ? 'sage' : 'breeder'));
          }
        }
        grid.appendChild(cell);
      }
    }
    const npcHere = npcAt(state.pos.x, state.pos.y);
    const d = $('#phoneDialogue');
    if (npcHere) {
      const lines = npcHere.dialogues;
      const line = lines[Math.abs(PQ.hashStr(state.totalSteps + npcHere.id)) % lines.length];
      d.innerHTML = '<span class="who">' + escapeHtml(npcHere.name) + ' :</span>' + escapeHtml(line);
    } else {
      d.innerHTML = '<span class="who">Narrateur :</span>Tu marches sur le sentier. Marche jusqu\'à un PNJ pour parler.';
    }
  }

  function makeWorld() {
    const rows = [];
    const seed = 'world-v1';
    for (let y = 0; y < 9; y++) {
      const row = [];
      for (let x = 0; x < 9; x++) {
        const h = Math.abs(PQ.hashStr(seed + ':' + x + ':' + y));
        const m = h % 100;
        let kind = 'grass';
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
  function tileColor(kind) {
    return ({
      grass: '#3a6f2a', forest: '#1f4a17', water: '#3498db',
      sand: '#e6c98a', stone: '#7f8c8d', snow: '#ecf0f1',
    })[kind] || '#3a6f2a';
  }
  function npcAt(x, y) {
    const positions = {
      taverniere: [4, 4],
      forgeron: [2, 6],
      sage: [6, 2],
      eleveur: [7, 7],
    };
    for (const id in positions) {
      const [px, py] = positions[id];
      if (px === x && py === y) return PQ.NPCS.find(n => n.id === id);
    }
    return null;
  }
  function npcEmoji(id) {
    return ({ taverniere: '🍺', forgeron: '🔨', sage: '📜', eleveur: '🥚' })[id] || '👤';
  }

  function renderQuests() {
    const active = $('#phoneActiveQuests');
    const avail = $('#phoneAvailableQuests');
    active.innerHTML = '';
    avail.innerHTML = '';
    if (state.activeQuests.length === 0) {
      active.innerHTML = '<p style="color:var(--muted);font-style:italic">Aucune quête active. Choisis-en une ci-dessous.</p>';
    }
    state.activeQuests.forEach(q => {
      const tpl = PQ.QUEST_TEMPLATES.find(t => t.id === q.id); if (!tpl) return;
      const giver = PQ.NPCS.find(n => n.id === tpl.giver);
      const card = el('div', 'card');
      const pct = Math.min(100, Math.floor((q.progress / tpl.goal) * 100));
      card.innerHTML =
        '<h4>' + escapeHtml(tpl.name) + '</h4>' +
        '<div class="desc">de ' + escapeHtml(giver ? giver.name : '?') + '</div>' +
        '<div class="meta">' + q.progress + ' / ' + tpl.goal + '</div>' +
        '<div class="qbar"><div class="qfill" style="width:' + pct + '%"></div></div>' +
        '<div class="meta qprice">+' + tpl.reward.xp + ' XP, +' + tpl.reward.coin + ' 🪙</div>' +
        '<div class="card-actions"></div>';
      const acts = card.querySelector('.card-actions');
      if (q.progress >= tpl.goal) {
        const b = el('button', 'btn primary small'); b.textContent = '✓ Rendre la quête';
        b.onclick = () => {
          const r = PQ.turnInQuest(state, q.id);
          if (r.ok) toast('Quête rendue : +' + r.reward.xp + ' XP, +' + r.reward.coin + ' 🪙', 'success');
          syncAndRender();
        };
        acts.appendChild(b);
      }
      active.appendChild(card);
    });
    PQ.QUEST_TEMPLATES.forEach(tpl => {
      const isActive = state.activeQuests.find(q => q.id === tpl.id);
      const isDone = state.completedQuests.includes(tpl.id);
      if (isActive || isDone) return;
      const giver = PQ.NPCS.find(n => n.id === tpl.giver);
      const card = el('div', 'card');
      card.innerHTML =
        '<h4>' + escapeHtml(tpl.name) + '</h4>' +
        '<div class="desc">de ' + escapeHtml(giver ? giver.name : '?') + '</div>' +
        '<div class="meta">objectif ' + tpl.goal + (tpl.type === 'kill' ? ' ' + tpl.target : tpl.type === 'hatch' ? ' éclosion' : ' pas') + '</div>' +
        '<div class="meta qprice">+' + tpl.reward.xp + ' XP, +' + tpl.reward.coin + ' 🪙</div>' +
        '<div class="card-actions"></div>';
      const b = el('button', 'btn small'); b.textContent = '+ Accepter';
      b.onclick = () => {
        if (PQ.acceptQuest(state, tpl.id)) {
          toast('Quête acceptée : ' + tpl.name, 'success');
        }
        syncAndRender();
      };
      card.querySelector('.card-actions').appendChild(b);
      avail.appendChild(card);
    });
  }

  function renderShop() {
    const g = $('#phoneShop');
    g.innerHTML = '';
    PQ.SHOP_ITEMS.forEach(it => {
      const card = el('div', 'item');
      const info = el('div', 'item-info');
      info.innerHTML =
        '<div class="item-name">' + escapeHtml(it.name) + '</div>' +
        '<div class="item-desc">' + escapeHtml(it.desc) + '</div>' +
        '<div class="item-price">' + it.price + ' 🪙</div>';
      card.appendChild(info);
      const actions = el('div', 'item-actions');
      const b = el('button', 'btn small'); b.textContent = 'Acheter';
      b.onclick = () => {
        const r = PQ.buy(state, it.id);
        if (r.ok) toast('Acheté : ' + it.name, 'success');
        else toast(r.reason, 'error');
        syncAndRender();
      };
      actions.appendChild(b);
      card.appendChild(actions);
      g.appendChild(card);
    });

    const inv = $('#phoneInv');
    inv.innerHTML = '';
    $('#phoneInvCount').textContent = PQ.inventoryWeight(state);
    if (state.inventory.length === 0) {
      inv.innerHTML = '<p style="color:var(--muted);font-style:italic">Inventaire vide.</p>';
    }
    state.inventory.forEach(it => {
      const def = PQ.SHOP_ITEMS.find(s => s.id === it.id) || { name: it.id, desc: 'objet', price: 5, type: 'misc' };
      const card = el('div', 'item');
      const info = el('div', 'item-info');
      info.innerHTML =
        '<div class="item-name">' + escapeHtml(def.name) + ' x' + it.qty + '</div>' +
        '<div class="item-desc">' + escapeHtml(def.desc || 'objet') + '</div>' +
        '<div class="item-price">vente ' + Math.floor(def.price * 0.4) + ' 🪙</div>';
      card.appendChild(info);
      const actions = el('div', 'item-actions');
      const sb = el('button', 'btn small'); sb.textContent = 'Vendre';
      sb.onclick = () => {
        const r = PQ.sell(state, it.id);
        if (r.ok) toast('Vendu : +' + r.refund + ' 🪙', 'success');
        syncAndRender();
      };
      actions.appendChild(sb);
      if (def.type === 'weapon' || def.type === 'armor') {
        const eb = el('button', 'btn small primary'); eb.textContent = 'Équiper';
        eb.onclick = () => {
          state.equipped[def.type] = it.id;
          toast('Équipé : ' + def.name, 'success');
          syncAndRender();
        };
        actions.appendChild(eb);
      }
      card.appendChild(actions);
      inv.appendChild(card);
    });

    $('#phoneEncumbered').style.display = PQ.isEncumbered(state) ? '' : 'none';
  }

  function renderBestiary() {
    const g = $('#phoneBestiary');
    g.innerHTML = '';
    PQ.MONSTERS.forEach(m => {
      const seen = (state.bestiary[m.id] || 0) > 0;
      const card = el('div', 'beast-card' + (seen ? '' : ' locked'));
      const sprite = spriteCanvas(m.sprite, 64);
      sprite.classList.add('beast-sprite');
      card.appendChild(sprite);
      const info = el('div', 'beast-info');
      info.innerHTML =
        '<div class="item-name">' + escapeHtml(seen ? m.name : '???') + '</div>' +
        '<div class="item-desc">PV ' + m.hp + ' · XP ' + m.xp + ' · Tier ' + m.tier + '</div>' +
        '<div class="meta">Vaincus : ' + (state.bestiary[m.id] || 0) + '</div>';
      card.appendChild(info);
      const b = el('button', 'btn small'); b.textContent = '⚔';
      b.onclick = () => {
        const r = PQ.fight(state, m.id);
        if (r.ok) toast('Vaincu : ' + m.name, 'success');
        else toast('Trop fort. Reviens plus tard.', 'error');
        syncAndRender();
      };
      card.appendChild(b);
      g.appendChild(card);
    });
  }

  function renderPets() {
    const eggDiv = $('#phoneEgg');
    eggDiv.innerHTML = '';
    if (state.eggIncubating) {
      const def = PQ.PETS.find(p => p.id === state.eggIncubating.petId);
      const card = el('div', 'egg-card');
      const sprite = spriteCanvas('item_egg', 48);
      card.appendChild(sprite);
      const info = el('div', 'item-info');
      const pct = Math.min(100, Math.floor((state.eggIncubating.steps / def.hatchSteps) * 100));
      info.innerHTML =
        '<div class="item-name">Œuf en couvée</div>' +
        '<div class="item-desc">Marche pour faire éclore (' + state.eggIncubating.steps + ' / ' + def.hatchSteps + ')</div>' +
        '<div class="qbar"><div class="qfill" style="width:' + pct + '%"></div></div>';
      card.appendChild(info);
      eggDiv.appendChild(card);
    } else {
      eggDiv.innerHTML = '<p style="color:var(--muted);font-style:italic">Aucun œuf en couvée. Achète un Œuf Mystère à la boutique.</p>';
    }

    const g = $('#phonePets');
    g.innerHTML = '';
    PQ.PETS.forEach(p => {
      const owned = state.pets.some(x => x.id === p.id && x.hatched);
      const card = el('div', 'pet-card' + (owned ? '' : ' locked'));
      const sprite = spriteCanvas(p.sprite, 64);
      sprite.classList.add('beast-sprite');
      card.appendChild(sprite);
      const info = el('div', 'item-info');
      info.innerHTML =
        '<div class="item-name">' + escapeHtml(p.name) + (owned ? ' ★' : '') + '</div>' +
        '<div class="item-desc">éclot à ' + p.hatchSteps + ' pas</div>' +
        '<div class="meta">' + escapeHtml(p.trait) + '</div>';
      card.appendChild(info);
      g.appendChild(card);
    });
  }

  function renderRaid() {
    const div = $('#phoneRaid');
    div.innerHTML = '';
    const boss = PQ.RAID_BOSSES.find(b => b.id === state.raid.bossId) || PQ.RAID_BOSSES[0];
    const card = el('div', 'raid-card');
    const sprite = spriteCanvas('boss_dragon', 128);
    sprite.classList.add('raid-sprite');
    card.appendChild(sprite);
    card.appendChild(el('div', 'raid-name', 'BOSS · ' + escapeHtml(boss.name)));
    const total = boss.hp;
    const cur = state.raid.hp;
    const pct = Math.max(0, Math.min(100, (cur / total) * 100));
    const bar = el('div', 'raid-bar');
    bar.innerHTML = '<div class="rfill" style="width:' + pct + '%"></div><span>' + cur + ' / ' + total + ' PV</span>';
    card.appendChild(bar);
    card.appendChild(el('p', 'meta', 'Chaque pas = 1 dégât. Tu as jusqu\'à dimanche soir.'));
    card.appendChild(el('p', 'meta', 'Total infligé : ' + state.raid.participated));
    if (cur === 0) {
      card.appendChild(el('p', 'qprice', '🏆 BOSS VAINCU ! Récompense : ' + boss.reward));
    }
    div.appendChild(card);
  }

  function renderChar() {
    const root = $('#phoneCharBuilder');
    root.innerHTML = '';

    // Preview
    const prev = el('div', 'char-preview');
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    paintSpriteToCanvas(c, 'hero', {
      skin: state.character.skin,
      hairColor: state.character.hairColor,
      classId: state.character.classId,
    });
    prev.appendChild(c);
    root.appendChild(prev);

    // Name
    const nameRow = el('div', 'char-row');
    nameRow.innerHTML = '<label>Nom</label>';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = state.character.name; inp.maxLength = 16;
    inp.oninput = () => {
      state.character.name = inp.value || 'Aventurier';
      saveState(state);
      // Pas de full re-render pour ne pas perdre le focus, juste HUD
      $('#phoneName').textContent = state.character.name + ' · ' + (PQ.CLASSES.find(c => c.id === state.character.classId) || {name: '?'}).name;
    };
    nameRow.appendChild(inp);
    root.appendChild(nameRow);

    // Class
    const cl = el('div', 'char-row');
    cl.innerHTML = '<label>Classe</label>';
    const grid = el('div', 'class-grid');
    PQ.CLASSES.forEach(k => {
      const card = el('div', 'class-card' + (state.character.classId === k.id ? ' active' : ''));
      card.innerHTML = '<div class="cname">' + escapeHtml(k.name) + '</div><div class="cdesc">' + escapeHtml(k.desc) + '</div>';
      card.onclick = () => {
        state.character.classId = k.id;
        saveState(state);
        syncAndRender();
      };
      grid.appendChild(card);
    });
    cl.appendChild(grid);
    root.appendChild(cl);

    // Hair color
    const hc = el('div', 'char-row');
    hc.innerHTML = '<label>Couleur cheveux</label>';
    const hg = el('div', 'swatch-grid');
    PQ.HAIR_COLORS.forEach(col => {
      const sw = el('div', 'swatch' + (state.character.hairColor === col ? ' active' : ''));
      sw.style.background = col;
      sw.onclick = () => {
        state.character.hairColor = col;
        saveState(state);
        syncAndRender();
      };
      hg.appendChild(sw);
    });
    hc.appendChild(hg);
    root.appendChild(hc);

    // Skin
    const sk = el('div', 'char-row');
    sk.innerHTML = '<label>Couleur peau</label>';
    const sg = el('div', 'swatch-grid');
    PQ.SKIN_TONES.forEach(col => {
      const sw = el('div', 'swatch' + (state.character.skin === col ? ' active' : ''));
      sw.style.background = col;
      sw.onclick = () => {
        state.character.skin = col;
        saveState(state);
        syncAndRender();
      };
      sg.appendChild(sw);
    });
    sk.appendChild(sg);
    root.appendChild(sk);

    // Hairstyle
    const hs = el('div', 'char-row');
    hs.innerHTML = '<label>Coiffure</label>';
    const hsg = el('div', 'style-grid');
    PQ.HAIRSTYLES.forEach(h => {
      const b = el('button', 'style-btn' + (state.character.hair === h ? ' active' : ''));
      b.textContent = h;
      b.onclick = () => {
        state.character.hair = h;
        saveState(state);
        syncAndRender();
      };
      hsg.appendChild(b);
    });
    hs.appendChild(hsg);
    root.appendChild(hs);
  }

  function renderAchievements() {
    const g = $('#phoneAchievements');
    g.innerHTML = '';
    PQ.ACHIEVEMENTS.forEach(a => {
      const got = state.achievements.includes(a.id);
      const div = el('div', 'ach ' + (got ? 'unlocked' : 'locked'));
      div.innerHTML = '<span class="star">' + (got ? '★' : '☆') + '</span><span class="aname">' + escapeHtml(a.name) + '</span>';
      g.appendChild(div);
    });
  }

  // ----- Render WATCH --------------------------------------------------------
  function renderWatch() {
    const root = $('#watchContent');
    root.innerHTML = '';
    if (activeWatchTab === 'main') {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      c.style.width = '48px'; c.style.height = '48px'; c.style.imageRendering = 'pixelated';
      paintSpriteToCanvas(c, 'hero', {
        skin: state.character.skin,
        hairColor: state.character.hairColor,
        classId: state.character.classId,
      });
      root.appendChild(c);
      root.appendChild(rowLbl('Niv. ' + state.level, true));
      const need = PQ.xpForLevel(state.level);
      const bar = el('div', 'watch-bar');
      bar.innerHTML = '<div class="fill" style="width:' + Math.min(100, (state.xp / need) * 100) + '%"></div>';
      root.appendChild(bar);
      root.appendChild(rowLbl('👣 ' + state.dailySteps + ' pas'));
      root.appendChild(rowLbl('🪙 ' + state.coins));
    } else if (activeWatchTab === 'quest') {
      const q = state.activeQuests[0];
      if (!q) {
        root.appendChild(rowLbl('Aucune quête'));
      } else {
        const tpl = PQ.QUEST_TEMPLATES.find(t => t.id === q.id);
        root.appendChild(rowLbl(tpl ? tpl.name : '?', true));
        root.appendChild(rowLbl(q.progress + ' / ' + (tpl ? tpl.goal : '?')));
        const bar = el('div', 'watch-bar');
        bar.innerHTML = '<div class="fill" style="background:#2ecc71;width:' +
          Math.min(100, Math.floor((q.progress / (tpl ? tpl.goal : 1)) * 100)) + '%"></div>';
        root.appendChild(bar);
      }
    } else if (activeWatchTab === 'raid') {
      const boss = PQ.RAID_BOSSES.find(b => b.id === state.raid.bossId);
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      c.style.width = '64px'; c.style.height = '64px'; c.style.imageRendering = 'pixelated';
      paintSpriteToCanvas(c, 'boss_dragon');
      root.appendChild(c);
      root.appendChild(rowLbl(boss ? boss.name : '?', true));
      const bar = el('div', 'watch-bar');
      bar.innerHTML = '<div class="fill" style="background:linear-gradient(90deg,#7a1a1a,#ff5d6c);width:' +
        Math.min(100, (state.raid.hp / (boss ? boss.hp : 1)) * 100) + '%"></div>';
      root.appendChild(bar);
      root.appendChild(rowLbl(state.raid.hp + ' PV'));
    } else if (activeWatchTab === 'pet') {
      if (state.eggIncubating) {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        c.style.width = '48px'; c.style.height = '48px'; c.style.imageRendering = 'pixelated';
        paintSpriteToCanvas(c, 'item_egg');
        root.appendChild(c);
        const def = PQ.PETS.find(p => p.id === state.eggIncubating.petId);
        const bar = el('div', 'watch-bar');
        bar.innerHTML = '<div class="fill" style="background:#d36cb0;width:' +
          Math.min(100, Math.floor((state.eggIncubating.steps / def.hatchSteps) * 100)) + '%"></div>';
        root.appendChild(bar);
        root.appendChild(rowLbl(state.eggIncubating.steps + '/' + def.hatchSteps));
      } else if (state.pets.length) {
        const p = state.pets[0];
        const def = PQ.PETS.find(P => P.id === p.id);
        if (def) {
          const c = document.createElement('canvas');
          c.width = 16; c.height = 16;
          c.style.width = '48px'; c.style.height = '48px'; c.style.imageRendering = 'pixelated';
          paintSpriteToCanvas(c, def.sprite);
          root.appendChild(c);
          root.appendChild(rowLbl(def.name));
        }
      } else {
        root.appendChild(rowLbl('Aucun familier'));
      }
    }
  }

  function rowLbl(text, isNum) {
    const r = el('div', isNum ? 'w-num' : 'w-lbl');
    r.textContent = text;
    return r;
  }

  // ----- Sync + render orchestrator -----------------------------------------
  function syncAndRender() {
    const fixed = PT.autoFix(state);
    if (fixed.length) flashLog('fix', 'Auto-fix : ' + fixed.join(', '));
    saveState(state);
    PSync.emit('state', state);
    renderPhone();
    if (activeView === 'watch') renderWatch();
    renderCheatLog();
    renderSyncStatus();
  }

  PSync.on('synced', () => renderSyncStatus());

  function renderSyncStatus() {
    const st = PSync.status();
    const dot = $('#syncDot');
    const lbl = $('#syncLabel');
    if (st.pending > 0) {
      dot.classList.remove('ok');
      lbl.textContent = 'Sync…';
    } else {
      dot.classList.add('ok');
      lbl.textContent = 'Sync ✓';
    }
  }
  function renderCheatLog() {
    const recent = state.flags.slice(-6).reverse().map(f =>
      new Date(f.t).toLocaleTimeString() + ' — ' + f.issues.join(', ') + ' (raw ' + f.raw + ', kept ' + f.kept + ')'
    );
    $('#cheatLog').textContent = recent.length ? recent.join('\n') : 'Aucune anomalie détectée.';
  }

  function flashLog(cls, msg) {
    const log = $('#debugLog');
    const span = '<span class="' + cls + '">' + escapeHtml(new Date().toLocaleTimeString()) + ' ' + escapeHtml(msg) + '</span>\n';
    log.innerHTML += span;
    log.scrollTop = log.scrollHeight;
  }

  // ----- Topbar / FAB handlers -----------------------------------------------
  $('#btnAddSteps').addEventListener('click', () => {
    const r = PQ.ingestSteps(state, 50, Date.now());
    let msg = '+' + r.gainedXp + ' XP, +' + r.gainedCoins + ' 🪙';
    if (r.levelUps.length) msg += ' · LEVEL UP !';
    if (r.issues.length) msg += ' ⚠';
    toast(msg, r.levelUps.length ? 'success' : '');
    syncAndRender();
  });
  // Long press on FAB to open custom drawer
  let pressTimer = null;
  $('#btnAddSteps').addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => {
      $('#stepDrawer').classList.toggle('visible');
    }, 500);
  });
  $('#btnAddSteps').addEventListener('touchend', () => {
    clearTimeout(pressTimer);
  });
  $('#btnAddSteps').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    $('#stepDrawer').classList.toggle('visible');
  });
  $('#btnAddCustom').addEventListener('click', () => {
    const n = parseInt($('#simSteps').value, 10) || 50;
    const r = PQ.ingestSteps(state, n, Date.now());
    toast('+' + r.gainedXp + ' XP, +' + r.gainedCoins + ' 🪙');
    $('#stepDrawer').classList.remove('visible');
    syncAndRender();
  });

  $('#btnReset').addEventListener('click', () => {
    if (!confirm('Réinitialiser TOUTE la progression ?')) return;
    state = PQ.defaultState();
    state.character = {
      name: 'Aventurier', classId: 'guerrier',
      hair: 'short', hairColor: '#8b4513', skin: '#f4c79a',
    };
    saveState(state);
    toast('État réinitialisé');
    syncAndRender();
  });

  // ----- Debug actions -------------------------------------------------------
  $('#btnRunTests').addEventListener('click', () => {
    const log = $('#debugLog');
    log.innerHTML = '<span class="info">▶ Tests fonctionnels</span>\n';
    const fr = PT.runFunctionalTests();
    let pass = 0, fail = 0;
    fr.forEach(r => {
      const cls = r.ok ? 'ok' : 'ko';
      log.innerHTML += '<span class="' + cls + '">' + (r.ok ? '✓' : '✗') + ' [' + r.id + '] ' +
        escapeHtml(r.desc) + (r.msg ? ' — ' + escapeHtml(r.msg) : '') + '</span>\n';
      if (r.ok) pass++; else fail++;
    });
    log.innerHTML += '<span class="info">\n▶ Invariants</span>\n';
    const ir = PT.runInvariants(state);
    let ipass = 0, ifail = 0;
    ir.forEach(r => {
      const cls = r.ok ? 'ok' : 'ko';
      log.innerHTML += '<span class="' + cls + '">' + (r.ok ? '✓' : '✗') + ' [' + r.id + ']</span>\n';
      if (r.ok) ipass++; else ifail++;
    });
    log.innerHTML += '<span class="info">\nRésumé : ' + pass + '/' + fr.length + ' fn, ' + ipass + '/' + ir.length + ' inv.</span>\n';
    log.scrollTop = log.scrollHeight;
  });
  $('#btnAutoFix').addEventListener('click', () => {
    const fixed = PT.autoFix(state);
    if (fixed.length === 0) {
      flashLog('ok', 'Aucun fix nécessaire');
      toast('État sain', 'success');
    } else {
      flashLog('fix', 'Auto-fix : ' + fixed.join(', '));
      toast('Auto-fix appliqué');
    }
    syncAndRender();
  });
  $('#btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixelquest-state-' + Date.now() + '.json';
    a.click();
    toast('État exporté');
  });
  $('#btnTick').addEventListener('click', () => {
    if (tickerHandle) {
      clearInterval(tickerHandle);
      tickerHandle = null;
      flashLog('info', 'Tick arrêté');
      toast('Tick arrêté');
      $('#btnTick').textContent = '⏱ Tick auto 10s';
      return;
    }
    flashLog('info', 'Tick : 50 pas / 10s');
    toast('Tick démarré');
    $('#btnTick').textContent = '⏸ Stop tick';
    tickerHandle = setInterval(() => {
      const r = PQ.ingestSteps(state, 50, Date.now());
      if (r.levelUps.length) flashLog('ok', 'LEVEL UP → ' + r.levelUps.join(','));
      syncAndRender();
    }, 10000);
  });

  // ----- PWA install ---------------------------------------------------------
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('#btnInstall').style.display = '';
  });
  $('#btnInstall').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    $('#btnInstall').style.display = 'none';
    toast('Installation lancée');
  });

  if (window.matchMedia('(max-width: 520px)').matches &&
      !localStorage.getItem('pixelquest_hint_seen')) {
    $('#installHint').style.display = '';
  }
  $('#closeHint').addEventListener('click', () => {
    $('#installHint').style.display = 'none';
    localStorage.setItem('pixelquest_hint_seen', '1');
  });

  // ----- Konami easter egg ---------------------------------------------------
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
                  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konamiIdx = 0;
  document.addEventListener('keydown', (e) => {
    const want = konami[konamiIdx];
    if (e.key === want || e.key.toLowerCase() === want) {
      konamiIdx++;
      if (konamiIdx === konami.length) {
        konamiIdx = 0;
        state.coins += 1000;
        toast('🎉 Konami ! +1000 🪙', 'success');
        syncAndRender();
      }
    } else {
      konamiIdx = 0;
    }
  });

  // ----- Init ----------------------------------------------------------------
  syncAndRender();
})();
