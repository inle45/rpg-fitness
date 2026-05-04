/* PixelQuest – Générateur de sprites pixel art (procédural).
 * Chaque sprite est dessiné sur un canvas 16x16 ou 32x32, puis exporté en
 * dataURL. Aucune dépendance, tout est CPU.
 * Les motifs sont volontairement simples mais lisibles.
 */
(function (global) {
  'use strict';

  // helper : crée un canvas pixel art
  function makeCanvas(size, scale) {
    scale = scale || 4;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    c.style.width = (size*scale)+'px';
    c.style.height = (size*scale)+'px';
    c.style.imageRendering = 'pixelated';
    return c;
  }

  // grille 16x16 simple : chaque caractère = couleur via palette
  function drawGrid(ctx, palette, grid) {
    for (let y=0; y<grid.length; y++) {
      const row = grid[y];
      for (let x=0; x<row.length; x++) {
        const ch = row[x];
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // --- Hero ---------------------------------------------------------------
  function drawHero(ctx, opts) {
    opts = opts || {};
    const skin = opts.skin || '#f4c79a';
    const hair = opts.hairColor || '#2a1a0d';
    const cloth = opts.cloth || '#3b6cb0';
    const boot = '#1e1e1e';
    const eye = '#0f0f0f';
    const palette = { '.': null, K: '#000', S: skin, H: hair, C: cloth, B: boot, E: eye, W: '#fff' };
    // 16x16
    const grid = [
      '....KKKKKK......',
      '...KHHHHHHK.....',
      '..KHHHHHHHHK....',
      '..KHSSSSSHHK....',
      '..KSSSSSSSSK....',
      '..KSEKSSEKSK....',
      '..KSSSSSSSSK....',
      '..KSSKSSKSSK....',
      '..KKSSKKSSKK....',
      '...KCCCCCCCK....',
      '..KCCCCCCCCCK...',
      '..KCCCSSSCCCK...',
      '..KCCCCCCCCCK...',
      '...KCCCKCCCK....',
      '...KBBBKBBBK....',
      '...KBBKKBBKK....',
    ];
    drawGrid(ctx, palette, grid);
  }

  function classOverlay(ctx, classId) {
    if (classId==='guerrier') {
      ctx.fillStyle = '#9e9e9e';
      ctx.fillRect(13, 7, 1, 7); // épée à droite
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(13, 13, 2, 1);
    } else if (classId==='mage') {
      ctx.fillStyle = '#5b2a83';
      ctx.fillRect(13, 7, 1, 7); // bâton
      ctx.fillStyle = '#ffe04a';
      ctx.fillRect(13, 6, 1, 1); // gemme
    } else if (classId==='rodeur') {
      ctx.fillStyle = '#3a6f2a';
      ctx.fillRect(0, 7, 1, 7); // arc
      ctx.fillStyle = '#3a6f2a';
      ctx.fillRect(1, 7, 1, 1);
      ctx.fillRect(1, 13, 1, 1);
    } else if (classId==='barde') {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(2, 9, 4, 3); // luth
      ctx.fillStyle = '#000';
      ctx.fillRect(3, 10, 2, 1);
    }
  }

  // --- NPCs ---------------------------------------------------------------
  function drawNpc(ctx, kind) {
    const palettes = {
      tavern:   { S:'#f4c79a', H:'#c0392b', C:'#8a4a1a', A:'#fff' },
      smith:    { S:'#d39660', H:'#1e1e1e', C:'#2c2c2c', A:'#999' },
      sage:     { S:'#e8b27a', H:'#cccccc', C:'#5b2a83', A:'#ffe04a' },
      breeder:  { S:'#f7d8b2', H:'#d4a017', C:'#3a6f2a', A:'#a06840' },
    };
    const p = palettes[kind] || palettes.tavern;
    const palette = { '.': null, K:'#000', S:p.S, H:p.H, C:p.C, A:p.A, E:'#0f0f0f' };
    const grid = [
      '....KKKKKK......',
      '...KHHHHHHK.....',
      '..KHSSSSSSHK....',
      '..KSSSSSSSSK....',
      '..KSEKSSEKSK....',
      '..KSSSAASSSK....',
      '..KSSSSSSSSK....',
      '..KKSSSSSSKK....',
      '...KCCCCCCCK....',
      '..KCCCAACCCCK...',
      '..KCCCCCCCCCK...',
      '..KCCCCCCCCCK...',
      '..KCCCCCCCCCK...',
      '...KCCCKCCCK....',
      '...KKKKKKKKK....',
      '....KK....KK....',
    ];
    drawGrid(ctx, palette, grid);
  }

  // --- Mobs ---------------------------------------------------------------
  function drawSlime(ctx) {
    const palette = { '.':null, K:'#0a3d2a', G:'#2ecc71', H:'#a7f3c8', E:'#000' };
    const grid = [
      '................',
      '................',
      '................',
      '................',
      '....KKKKKKK.....',
      '...KGGGGGGGK....',
      '..KGGHGGHGGGK...',
      '..KGGGGGGGGGK...',
      '.KGGGEGGGGEGGK..',
      '.KGGGGGGGGGGGK..',
      '.KGGGGGGGGGGGK..',
      '.KKGGGGGGGGGKK..',
      '..KKGGGGGGGKK...',
      '...KKKKKKKKK....',
      '................',
      '................',
    ];
    drawGrid(ctx, palette, grid);
  }
  function drawGoblin(ctx) {
    const palette = { '.':null, K:'#000', G:'#6aa84f', D:'#3c5a25', E:'#fff', M:'#c0392b' };
    const grid = [
      '....KKKKKK......',
      '...KGGGGGGK.....',
      '..KGGGGGGGGK....',
      '..KGEKGGEKGK....',
      '..KGGGGGGGGK....',
      '..KGGMMMGGGK....',
      '..KGGGGGGGGK....',
      '...KGGGGGGK.....',
      '...KDDDDDDK.....',
      '..KDDDDDDDDK....',
      '..KDDDDDDDDK....',
      '..KDDDDDDDDK....',
      '..KDDDKKDDDK....',
      '..KDDDKKDDDK....',
      '..KKDDKKDDKK....',
      '....KK..KK......',
    ];
    drawGrid(ctx, palette, grid);
  }
  function drawWolf(ctx) {
    const palette = { '.':null, K:'#000', G:'#3a3a3a', D:'#5a5a5a', E:'#ffe04a', T:'#ffffff' };
    const grid = [
      '................',
      '..K............K',
      '..KK..........KK',
      '..KGK........KGK',
      '..KGGK......KGGK',
      '..KGGGKKKKKKGGGK',
      '..KGGEGGGGGGGEGK',
      '..KGGGGTTGGGGGGK',
      '..KGGGGGGGGGGGGK',
      '..KKGGGGGGGGGGKK',
      '...KGGGGGGGGGK..',
      '...KKGGGGGGGKK..',
      '....KGKGGKGGK...',
      '....KKK.KKK.....',
      '................',
      '................',
    ];
    drawGrid(ctx, palette, grid);
  }
  function drawGolem(ctx) {
    const palette = { '.':null, K:'#000', G:'#9e9e9e', D:'#5a5a5a', E:'#ffe04a' };
    const grid = [
      '....KKKKKKK.....',
      '...KGGGGGGGK....',
      '..KGGGGGGGGGK...',
      '..KGEGGGGGEGK...',
      '..KGGGGGGGGGK...',
      '..KGGGDDDGGGK...',
      '..KGGGGGGGGGK...',
      '.KGGGGGGGGGGGK..',
      'KGGGGGGGGGGGGGK.',
      'KGGGGGGGGGGGGGK.',
      'KGGGGGGGGGGGGGK.',
      '.KGGGGGGGGGGGK..',
      '..KGGGGKGGGGK...',
      '..KGGGKKKGGGK...',
      '..KKGGKKKGGKK...',
      '....KK...KK.....',
    ];
    drawGrid(ctx, palette, grid);
  }

  // --- Boss ---------------------------------------------------------------
  function drawDragon(ctx) {
    // 32x32
    const c = ctx.canvas;
    const palette = { '.':null, K:'#000', G:'#3b3b3b', D:'#1f1f1f', E:'#ff3b3b', S:'#9e9e9e', F:'#ffe04a' };
    const grid = [
      '................................',
      '................................',
      '..........KKKKKK................',
      '.........KGGGGGGGK..............',
      '........KGGGGGGGGGK.............',
      '........KGGEGGGGGGGK............',
      '.......KGGGGGGGGGGGGK...........',
      '.......KGGGGGGGGGGGGK...........',
      '.......KGGGGFFGGGGGGK...........',
      '......KGGGGGGGGGGGGGGK..........',
      '......KGGGGGGGGGGGGGGK..........',
      '.....KGGGGGGGGGGGGGGGGK.........',
      '....KGGGGGGGGGGGGGGGGGGK........',
      '...KGGGGGGGGGGGGGGGGGGGGK.......',
      '..KGGGGGGGGGGGGGGGGGGGGGGK......',
      '.KGGGGGGGGGGGGGGGGGGGGGGGGK.....',
      'KGGGGGGGGGGGGGGGGGGGGGGGGGGK....',
      'KGGGGGGGGGGGGGGGGGGGGGGGGGGK....',
      'KGGGGGGGGGGGGGGGGGGGGGGGGGGK....',
      'KGGGGGGGGGGGGGGGGGGGGGGGGGGK....',
      '.KGGGGGGGGGGGGGGGGGGGGGGGGK.....',
      '..KGGGGGGGGGGGGGGGGGGGGGGK......',
      '...KGGGGGGGGGGGGGGGGGGGGK.......',
      '....KGGGGGGGGGGGGGGGGGGK........',
      '.....KGGGGGGGGGGGGGGGGK.........',
      '......KGGGGGGGGGGGGGGK..........',
      '.......KGGGGGGGGGGGGK...........',
      '........KGGGGGGGGGGK............',
      '.........KGGGGGGGGK.............',
      '..........KKKKKKKK..............',
      '................................',
      '................................',
    ];
    drawGrid(ctx, palette, grid);
  }

  // --- Pets ---------------------------------------------------------------
  function drawPetSlime(ctx)  { drawSlime(ctx); }
  function drawPetFox(ctx) {
    const palette = { '.':null, K:'#000', O:'#e67e22', W:'#fff', E:'#000' };
    const grid = [
      '................',
      '................',
      '....K......K....',
      '...KOK....KOK...',
      '..KOOK....KOOK..',
      '.KOOOKKKKKKOOOK.',
      '.KOOOOOOOOOOOOK.',
      '.KOOEOOWWOOEOOK.',
      '.KOOOOOOOOOOOOK.',
      '.KOOOWWWOOOOWOK.',
      '.KKOOOOOOOOOKKK.',
      '..KOOOOOOOOOK...',
      '..KOKOOKOOKOK...',
      '..KK..KK..KK....',
      '................',
      '................',
    ];
    drawGrid(ctx, palette, grid);
  }
  function drawPetGriffon(ctx) {
    const palette = { '.':null, K:'#000', G:'#d4a017', B:'#8b4513', E:'#fff' };
    const grid = [
      '......KK........',
      '.....KGGK.......',
      '....KGGGGK......',
      '....KGEKGK......',
      '....KGGGGK......',
      '....KGGGGKKKKK..',
      '....KGGGGGGGGGK.',
      '....KGGGGGGGGGGK',
      '...KBBBBBBBBBBK.',
      '..KBBBBBBBBBBK..',
      '..KBBBBBBBBBK...',
      '..KBBBKBBBKK....',
      '..KBKKKBBKK.....',
      '..KK..KK........',
      '................',
      '................',
    ];
    drawGrid(ctx, palette, grid);
  }
  function drawPetPixiel(ctx) {
    const palette = { '.':null, K:'#000', P:'#d36cb0', W:'#fff', G:'#a7f3c8' };
    const grid = [
      '......KK........',
      '.....KPPK.......',
      '....KPPPPK......',
      '....KPWKPK......',
      '....KPPPPK......',
      '..KK.KPPPK.KK...',
      '.KGGKKPPKKKGGK..',
      'KGGGGKPPKGGGGGK.',
      '.KGGKKPPKKGGK...',
      '..KK.KPPPK.KK...',
      '....KPPPPK......',
      '....KPPPPK......',
      '....KPKKPK......',
      '....KK..KK......',
      '................',
      '................',
    ];
    drawGrid(ctx, palette, grid);
  }

  // --- Items / weapons ---------------------------------------------------
  function drawSword(ctx, color) {
    color = color || '#9e9e9e';
    const palette = { '.':null, K:'#000', G:color, B:'#5a3a1a', Y:'#ffe04a' };
    const grid = [
      '......KK........',
      '......KGK.......',
      '......KGK.......',
      '......KGK.......',
      '......KGK.......',
      '......KGK.......',
      '......KGK.......',
      '......KGK.......',
      '......KGK.......',
      '....KKBBBKK.....',
      '....KBYYYBK.....',
      '....KKBBBKK.....',
      '......KBK.......',
      '......KBK.......',
      '......KKK.......',
      '................',
    ];
    drawGrid(ctx, palette, grid);
  }
  function drawPotion(ctx, color) {
    color = color || '#e74c3c';
    const palette = { '.':null, K:'#000', L:color, B:'#5a3a1a', H:'#ffffff' };
    const grid = [
      '......KK........',
      '......KBK.......',
      '......KBK.......',
      '.....KKBKK......',
      '.....KLLLK......',
      '....KLLLLLK.....',
      '...KLHLLLLLK....',
      '...KLLLLLLLK....',
      '...KLLLLLLLK....',
      '...KLLLLLLLK....',
      '...KLLLLLLLK....',
      '....KLLLLLK.....',
      '....KKLLLKK.....',
      '......KKK.......',
      '................',
      '................',
    ];
    drawGrid(ctx, palette, grid);
  }
  function drawCoin(ctx) {
    const palette = { '.':null, K:'#000', G:'#ffe04a', D:'#b8860b' };
    const grid = [
      '................',
      '................',
      '....KKKKKK......',
      '...KGGGGGGK.....',
      '..KGGGDDGGGK....',
      '..KGGDGGDGGK....',
      '..KGGDGGDGGK....',
      '..KGGGDDGGGK....',
      '...KGGGGGGK.....',
      '....KKKKKK......',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];
    drawGrid(ctx, palette, grid);
  }
  function drawEgg(ctx) {
    const palette = { '.':null, K:'#000', S:'#fff8dc', D:'#d4a017', P:'#d36cb0' };
    const grid = [
      '................',
      '................',
      '......KKKK......',
      '.....KSSSSSK....',
      '....KSSSSSSSK...',
      '....KSPPSSSSK...',
      '....KSSSSSPSK...',
      '....KSSPSSSSK...',
      '....KSSSSSSSK...',
      '....KSSSSPPSK...',
      '....KSSSSSSSK...',
      '....KSSSSSSSK...',
      '....KKSSSSSKK...',
      '......KKKK......',
      '................',
      '................',
    ];
    drawGrid(ctx, palette, grid);
  }

  // --- Météo --------------------------------------------------------------
  function drawWeather(ctx, kind) {
    const c = ctx.canvas;
    ctx.clearRect(0,0,c.width,c.height);
    if (kind==='soleil') {
      ctx.fillStyle = '#ffe04a';
      ctx.beginPath(); ctx.arc(8,8,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffaa00';
      for (let i=0;i<8;i++){
        const a=i*Math.PI/4;
        ctx.fillRect(8+Math.cos(a)*6-1, 8+Math.sin(a)*6-1, 2,2);
      }
    } else if (kind==='pluie') {
      ctx.fillStyle = '#888';
      ctx.fillRect(2,4,12,3);
      ctx.fillRect(3,7,10,2);
      ctx.fillStyle = '#3498db';
      [[4,11],[7,12],[10,11],[6,14],[9,14]].forEach(([x,y])=>ctx.fillRect(x,y,1,2));
    } else if (kind==='orage') {
      ctx.fillStyle = '#444';
      ctx.fillRect(2,3,12,4);
      ctx.fillStyle = '#ffe04a';
      ctx.fillRect(7,7,2,3);
      ctx.fillRect(6,10,3,2);
      ctx.fillRect(8,12,2,3);
    } else if (kind==='neige') {
      ctx.fillStyle = '#ddd';
      ctx.fillRect(2,3,12,4);
      ctx.fillStyle = '#fff';
      [[4,10],[7,11],[10,10],[5,13],[9,13]].forEach(([x,y])=>{
        ctx.fillRect(x,y,2,2);
      });
    } else if (kind==='brume') {
      ctx.fillStyle = 'rgba(200,200,200,0.9)';
      ctx.fillRect(1,5,14,2);
      ctx.fillRect(2,8,12,2);
      ctx.fillRect(1,11,14,2);
    }
  }

  // --- Tile ---------------------------------------------------------------
  function drawTile(ctx, kind) {
    const palettes = {
      grass:  ['#3a6f2a','#2f5d22','#4a8a36'],
      forest: ['#1f4a17','#143010','#2a6020'],
      sand:   ['#e6c98a','#d4b06a','#f0d9a0'],
      water:  ['#3498db','#2980b9','#5dade2'],
      stone:  ['#7f8c8d','#5d6d6e','#95a5a6'],
      snow:   ['#ecf0f1','#bdc3c7','#ffffff'],
    };
    const p = palettes[kind] || palettes.grass;
    for (let y=0;y<16;y++){
      for (let x=0;x<16;x++){
        const r = (Math.abs((x*7+y*13+(kind||'').length*3)%3));
        ctx.fillStyle = p[r];
        ctx.fillRect(x,y,1,1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------
  function makeSprite(kind, opts, size) {
    size = size || 16;
    const c = makeCanvas(size, opts && opts.scale ? opts.scale : 4);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (kind === 'hero') { drawHero(ctx, opts||{}); classOverlay(ctx, opts && opts.classId); }
    else if (kind === 'npc_tavern')  drawNpc(ctx, 'tavern');
    else if (kind === 'npc_smith')   drawNpc(ctx, 'smith');
    else if (kind === 'npc_sage')    drawNpc(ctx, 'sage');
    else if (kind === 'npc_breeder') drawNpc(ctx, 'breeder');
    else if (kind === 'mob_slime')   drawSlime(ctx);
    else if (kind === 'mob_goblin')  drawGoblin(ctx);
    else if (kind === 'mob_wolf')    drawWolf(ctx);
    else if (kind === 'mob_golem')   drawGolem(ctx);
    else if (kind === 'boss_dragon') drawDragon(ctx);
    else if (kind === 'pet_slime')   drawPetSlime(ctx);
    else if (kind === 'pet_fox')     drawPetFox(ctx);
    else if (kind === 'pet_griff')   drawPetGriffon(ctx);
    else if (kind === 'pet_pixiel')  drawPetPixiel(ctx);
    else if (kind === 'item_sword')  drawSword(ctx, opts && opts.color);
    else if (kind === 'item_potion') drawPotion(ctx, opts && opts.color);
    else if (kind === 'item_coin')   drawCoin(ctx);
    else if (kind === 'item_egg')    drawEgg(ctx);
    else if (kind && kind.indexOf('wx_')===0) drawWeather(ctx, kind.slice(3));
    else if (kind && kind.indexOf('tile_')===0) drawTile(ctx, kind.slice(5));
    return c;
  }

  global.PixelSprites = { makeSprite };
})(typeof window !== 'undefined' ? window : globalThis);
