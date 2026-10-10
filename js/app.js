/* Game state, rendering and input handling. */
(function () {
  'use strict';

  const S = window.Sudoku;
  const I = window.I18N;
  const KEYS = {
    game: 'sudoku.game.v1',
    settings: 'sudoku.settings.v1',
    stats: 'sudoku.stats.v1',
  };
  const MAX_MISTAKES = 3;
  const DAILY_DIFFICULTY = 'medium';
  const HISTORY_LIMIT = 300;

  // ---------- Storage ----------
  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function store(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage full or blocked: the game still works, just not persisted */
    }
  }

  function defaultLang() {
    const l = (navigator.language || '').toLowerCase();
    return l.startsWith('zh') ? 'zh-TW' : 'en';
  }

  const settings = Object.assign(
    {
      lang: defaultLang(),
      theme: 'auto',
      mistakeLimit: true,
      largeText: false,
      sound: true,
    },
    load(KEYS.settings) || {}
  );
  const stats = Object.assign(
    { easy: 0, medium: 0, hard: 0, expert: 0, daily: 0, dailyDates: [] },
    load(KEYS.stats) || {}
  );
  let game = validGame(load(KEYS.game));

  function validGame(g) {
    if (!g || !Array.isArray(g.puzzle) || g.puzzle.length !== 81) return null;
    if (!Array.isArray(g.solution) || !Array.isArray(g.values) || !Array.isArray(g.notes)) return null;
    g.history = Array.isArray(g.history) ? g.history : [];
    return g;
  }

  const saveGame = () => store(KEYS.game, game);
  const saveSettings = () => store(KEYS.settings, settings);
  const saveStats = () => store(KEYS.stats, stats);

  // ---------- UI state ----------
  let view = 'home';
  let selected = -1;
  let noteMode = false;
  let paused = false;

  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => I.t(settings.lang, key, vars);

  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const p = (n) => String(n).padStart(2, '0');
    return (h ? h + ':' + p(m) : p(m)) + ':' + p(s);
  }

  function gameLabel(g) {
    return g.daily ? t('dailyTitle', { date: g.daily.slice(5).replace('-', '/') }) : t(g.difficulty);
  }

  const isPlaying = () => game && game.status === 'playing';

  // ---------- Sound ----------
  const SoundFx = window.Sound;
  const play = (name) => settings.sound && SoundFx && SoundFx[name]();
  const playPop = () => play('pop'); // selecting cells, general buttons
  const playWood = () => play('wood'); // tool row and number pad
  const playCorrect = () => play('sparkle'); // a correct number
  const playWin = () => play('win');

  // ---------- Settings & i18n ----------
  function applySettings() {
    const root = document.documentElement;
    if (settings.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
    root.lang = settings.lang === 'zh-TW' ? 'zh-Hant' : 'en';
    document.body.classList.toggle('large-text', !!settings.largeText);
    document.title = settings.lang === 'zh-TW' ? '數獨 Sudoku' : 'Sudoku';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-label]').forEach((el) => {
      const label = t(el.getAttribute('data-i18n-label'));
      el.setAttribute('aria-label', label);
      el.title = label;
    });

    const dark =
      settings.theme === 'dark' ||
      (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#0b0b0b' : '#ffffff';
  }

  // ---------- Views ----------
  function showView(name) {
    view = name;
    $('home').hidden = name !== 'home';
    $('game').hidden = name !== 'game';
    if (name === 'home') renderHome();
    else renderGame();
    window.scrollTo(0, 0);
  }

  function renderHome() {
    const cont = $('btn-continue');
    if (isPlaying()) {
      cont.hidden = false;
      $('continue-info').textContent = gameLabel(game) + '・' + formatTime(game.elapsed);
      $('btn-new').classList.remove('btn-primary');
    } else {
      cont.hidden = true;
      $('btn-new').classList.add('btn-primary');
    }

    const doneToday = stats.dailyDates.indexOf(todayStr()) !== -1;
    $('daily-info').textContent = doneToday ? t('dailyDone') : todayStr().replace(/-/g, '/');

    const total = stats.easy + stats.medium + stats.hard + stats.expert + stats.daily;
    $('stat-total').textContent = total;
    const parts = S.DIFFICULTIES.map((d) => t(d) + ' ' + stats[d]);
    parts.push(t('dailyLabel') + ' ' + stats.daily);
    $('stat-breakdown').innerHTML = parts.map((p) => '<span>' + p + '</span>').join('');
  }

  // ---------- Board ----------
  const cells = [];
  const numButtons = [];

  function buildBoard() {
    const board = $('board');
    for (let i = 0; i < 81; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      if (S.COL[i] % 3 === 2 && S.COL[i] !== 8) cell.classList.add('br');
      if (S.ROW[i] % 3 === 2 && S.ROW[i] !== 8) cell.classList.add('bb');
      const val = document.createElement('span');
      const notes = document.createElement('div');
      notes.className = 'notes';
      for (let d = 1; d <= 9; d++) notes.appendChild(document.createElement('span'));
      cell.appendChild(val);
      cell.appendChild(notes);
      cell.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        select(i);
      });
      board.appendChild(cell);
      cells.push({ el: cell, val, notes: notes.children });
    }

    const pad = $('numpad');
    for (let d = 1; d <= 9; d++) {
      const b = document.createElement('button');
      b.className = 'num';
      b.innerHTML = '<span class="num-digit">' + d + '</span><span class="num-left"></span>';
      b.addEventListener('click', () => pressDigit(d));
      pad.appendChild(b);
      numButtons.push(b);
    }
  }

  function renderGame() {
    if (!game) return;
    $('game-title').textContent = gameLabel(game);
    renderStatus();
    renderBoard();
  }

  function renderStatus() {
    const m = $('mistakes');
    m.textContent = t('mistakes') + ' ' + game.mistakes + (settings.mistakeLimit ? '/' + MAX_MISTAKES : '');
    m.classList.toggle('has-mistakes', game.mistakes > 0);
    $('timer').textContent = formatTime(game.elapsed);
    $('pause-overlay').hidden = !paused;
    $('board').style.visibility = paused ? 'hidden' : '';
    $('icon-pause').hidden = paused;
    $('icon-play').hidden = !paused;
    const pauseBtn = $('btn-pause');
    const label = t(paused ? 'resume' : 'pause');
    pauseBtn.setAttribute('aria-label', label);
    pauseBtn.title = label;
  }

  function renderBoard() {
    const g = game;
    const selVal = selected >= 0 ? g.values[selected] : 0;

    for (let i = 0; i < 81; i++) {
      const c = cells[i];
      const v = g.values[i];
      const el = c.el;
      const isSel = i === selected;
      const isPeer =
        selected >= 0 &&
        !isSel &&
        (S.ROW[i] === S.ROW[selected] || S.COL[i] === S.COL[selected] || S.BOX[i] === S.BOX[selected]);

      el.classList.toggle('given', !!g.puzzle[i]);
      el.classList.toggle('err', !!v && v !== g.solution[i]);
      el.classList.toggle('sel', isSel);
      el.classList.toggle('same', !isSel && !!selVal && v === selVal);
      el.classList.toggle('peer', isPeer);
      c.val.textContent = v || '';

      const mask = v ? 0 : g.notes[i];
      for (let d = 1; d <= 9; d++) {
        const span = c.notes[d - 1];
        const on = !!(mask & S.bit(d));
        span.textContent = on ? d : '';
        span.classList.toggle('hl', on && d === selVal);
      }
    }

    // Hide digits that are fully (and correctly) placed.
    const placed = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) if (g.values[i] && g.values[i] === g.solution[i]) placed[g.values[i]]++;
    numButtons.forEach((b, k) => {
      const left = 9 - placed[k + 1];
      b.classList.toggle('done', left <= 0);
      b.lastChild.textContent = left;
    });

    $('numpad').classList.toggle('notes-mode', noteMode);
    $('btn-notes').classList.toggle('active', noteMode);
    $('notes-badge').textContent = t(noteMode ? 'on' : 'off');
    $('btn-undo').disabled = !g.history.length || !isPlaying();
  }

  // ---------- Actions ----------
  function select(i) {
    if (!isPlaying() || paused) return;
    if (i !== selected) playPop();
    selected = i;
    renderBoard();
  }

  function isLocked(i) {
    // Givens and correct answers cannot be changed (avoids accidental taps).
    return !!game.puzzle[i] || game.values[i] === game.solution[i];
  }

  function pushHistory(entry) {
    game.history.push(entry);
    if (game.history.length > HISTORY_LIMIT) game.history.shift();
  }

  function placeValue(i, d) {
    const entry = { i, v: game.values[i], n: game.notes[i], p: [] };
    game.values[i] = d;
    game.notes[i] = 0;
    if (d === game.solution[i]) {
      for (const p of S.PEERS[i]) {
        if (game.notes[p] & S.bit(d)) {
          entry.p.push([p, game.notes[p]]);
          game.notes[p] &= ~S.bit(d);
        }
      }
    }
    pushHistory(entry);
  }

  // Number pad / keyboard digit: sparkle when correct, wood otherwise.
  function pressDigit(d) {
    if (!inputDigit(d)) playWood();
  }

  // Returns true when a correct number was placed.
  function inputDigit(d) {
    if (!isPlaying() || paused || selected < 0) return false;
    const i = selected;
    if (isLocked(i)) return false;

    if (noteMode) {
      if (game.values[i]) return false;
      pushHistory({ i, v: 0, n: game.notes[i], p: [] });
      game.notes[i] ^= S.bit(d);
    } else {
      if (game.values[i] === d) return false;
      placeValue(i, d);
      if (d !== game.solution[i]) {
        game.mistakes++;
        if (settings.mistakeLimit && game.mistakes >= MAX_MISTAKES) {
          lose();
          return false;
        }
      } else {
        playCorrect();
        if (!checkWin()) {
          saveGame();
          renderGame();
        }
        return true;
      }
    }
    saveGame();
    renderGame();
    return false;
  }

  function erase() {
    if (!isPlaying() || paused || selected < 0) return;
    const i = selected;
    if (isLocked(i) || (!game.values[i] && !game.notes[i])) return;
    pushHistory({ i, v: game.values[i], n: game.notes[i], p: [] });
    game.values[i] = 0;
    game.notes[i] = 0;
    saveGame();
    renderBoard();
  }

  function undo() {
    if (!isPlaying() || paused) return;
    const e = game.history.pop();
    if (!e) return;
    game.values[e.i] = e.v;
    game.notes[e.i] = e.n;
    for (const [p, mask] of e.p) game.notes[p] = mask;
    selected = e.i;
    saveGame();
    renderBoard();
  }

  function hint() {
    if (!isPlaying() || paused) return;
    let i = selected;
    if (i < 0 || game.values[i] === game.solution[i]) {
      const open = [];
      for (let k = 0; k < 81; k++) if (game.values[k] !== game.solution[k]) open.push(k);
      if (!open.length) return;
      i = open[Math.floor(Math.random() * open.length)];
    }
    placeValue(i, game.solution[i]);
    game.hints = (game.hints || 0) + 1;
    selected = i;
    const el = cells[i].el;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    playCorrect();
    if (checkWin()) return;
    saveGame();
    renderBoard();
  }

  function toggleNotes() {
    if (!isPlaying()) return;
    noteMode = !noteMode;
    renderBoard();
  }

  function setPaused(p) {
    if (!isPlaying()) return;
    paused = p;
    renderStatus();
  }

  function moveSelection(dr, dc) {
    if (selected < 0) {
      select(40);
      return;
    }
    const r = (S.ROW[selected] + dr + 9) % 9;
    const c = (S.COL[selected] + dc + 9) % 9;
    select(r * 9 + c);
  }

  // ---------- Game lifecycle ----------
  function checkWin() {
    for (let i = 0; i < 81; i++) if (game.values[i] !== game.solution[i]) return false;
    game.status = 'won';
    selected = -1;
    if (game.daily) {
      stats.daily++;
      if (stats.dailyDates.indexOf(game.daily) === -1) stats.dailyDates.push(game.daily);
      stats.dailyDates = stats.dailyDates.slice(-90);
    } else {
      stats[game.difficulty] = (stats[game.difficulty] || 0) + 1;
    }
    saveStats();
    saveGame();
    renderGame();
    setTimeout(playWin, 300);

    setTimeout(() => {
      openModal({
        title: t('winTitle'),
        body:
          '<div>' +
          t('winBody', { difficulty: gameLabel(game) }) +
          '</div><p class="big-result">' +
          formatTime(game.elapsed) +
          '</p>',
        actions: [
          { label: t('playAgain'), primary: true, onClick: chooseDifficulty },
          { label: t('home'), onClick: () => showView('home') },
        ],
      });
    }, 350);
    return true;
  }

  function lose() {
    game.status = 'lost';
    saveGame();
    renderGame();
    openModal({
      title: t('loseTitle'),
      body: t('loseBody'),
      actions: [
        {
          label: t('secondChance'),
          primary: true,
          onClick: () => {
            game.status = 'playing';
            game.mistakes = 0;
            saveGame();
            renderGame();
          },
        },
        { label: t('newGame'), onClick: chooseDifficulty },
        { label: t('home'), onClick: () => showView('home') },
      ],
    });
  }

  function startGame(difficulty, dailyDate) {
    openModal({ title: t('generating'), body: '<div class="spinner"></div>', actions: [], locked: true });
    // Let the modal paint before the (synchronous) generator runs.
    setTimeout(() => {
      const seed = dailyDate ? S.seedFromString('daily-' + dailyDate) : undefined;
      const p = S.generate(difficulty, seed);
      game = {
        puzzle: p.puzzle,
        solution: p.solution,
        values: p.puzzle.slice(),
        notes: new Array(81).fill(0),
        difficulty,
        daily: dailyDate || null,
        mistakes: 0,
        hints: 0,
        elapsed: 0,
        history: [],
        status: 'playing',
      };
      selected = -1;
      noteMode = false;
      paused = false;
      saveGame();
      closeModal();
      showView('game');
    }, 60);
  }

  function hasProgress() {
    return isPlaying() && (game.elapsed > 10 || game.history.length > 0);
  }

  function confirmReplace(then) {
    if (!hasProgress()) {
      then();
      return;
    }
    openModal({
      title: t('replaceTitle'),
      body: t('replaceBody'),
      actions: [
        { label: t('start'), primary: true, onClick: then },
        { label: t('cancel') },
      ],
    });
  }

  function chooseDifficulty() {
    openModal({
      title: t('chooseDifficulty'),
      actions: S.DIFFICULTIES.map((d) => ({
        label: t(d),
        onClick: () => confirmReplace(() => startGame(d)),
      })).concat([{ label: t('cancel'), ghost: true }]),
    });
  }

  function startDaily() {
    const today = todayStr();
    if (isPlaying() && game.daily === today) {
      paused = false;
      showView('game');
      return;
    }
    confirmReplace(() => startGame(DAILY_DIFFICULTY, today));
  }

  // ---------- Modal ----------
  let modalLocked = false;

  function openModal(opts) {
    $('modal-title').textContent = opts.title || '';
    const body = $('modal-body');
    body.innerHTML = '';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    const actions = $('modal-actions');
    actions.innerHTML = '';
    (opts.actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn' + (a.primary ? ' btn-primary' : '') + (a.ghost ? ' btn-ghost' : '');
      b.textContent = a.label;
      b.addEventListener('click', () => {
        closeModal();
        if (a.onClick) a.onClick();
      });
      actions.appendChild(b);
    });
    modalLocked = !!opts.locked;
    $('modal').hidden = false;
    const first = actions.querySelector('.btn');
    if (first) first.focus({ preventScroll: true });
  }

  function closeModal() {
    $('modal').hidden = true;
    modalLocked = false;
  }

  const modalOpen = () => !$('modal').hidden;

  function segmented(options, current, onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'segmented';
    options.forEach(([value, label]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.setAttribute('aria-pressed', String(value === current));
      b.addEventListener('click', () => onPick(value));
      wrap.appendChild(b);
    });
    return wrap;
  }

  function settingRow(label, control) {
    const row = document.createElement('div');
    row.className = 'setting';
    const l = document.createElement('div');
    l.className = 'setting-label';
    l.textContent = label;
    row.appendChild(l);
    row.appendChild(control);
    return row;
  }

  function openSettings() {
    const update = (key, value) => {
      settings[key] = value;
      saveSettings();
      applySettings();
      if (view === 'home') renderHome();
      else renderGame();
      openSettings();
    };
    const body = document.createElement('div');
    body.appendChild(
      settingRow(t('language'), segmented([['zh-TW', '繁體中文'], ['en', 'English']], settings.lang, (v) => update('lang', v)))
    );
    body.appendChild(
      settingRow(
        t('theme'),
        segmented(
          [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]],
          settings.theme,
          (v) => update('theme', v)
        )
      )
    );
    body.appendChild(
      settingRow(
        t('textSize'),
        segmented([[false, t('textNormal')], [true, t('textLarge')]], !!settings.largeText, (v) => update('largeText', v))
      )
    );
    body.appendChild(
      settingRow(
        t('mistakeLimit'),
        segmented([[true, t('on')], [false, t('off')]], !!settings.mistakeLimit, (v) => update('mistakeLimit', v))
      )
    );
    body.appendChild(
      settingRow(t('sound'), segmented([[true, t('on')], [false, t('off')]], !!settings.sound, (v) => update('sound', v)))
    );
    openModal({ title: t('settings'), body, actions: [{ label: t('close'), primary: true }] });
  }

  // ---------- Timer ----------
  setInterval(() => {
    if (view !== 'game' || !isPlaying() || paused || document.hidden || modalOpen()) return;
    game.elapsed++;
    $('timer').textContent = formatTime(game.elapsed);
    if (game.elapsed % 5 === 0) saveGame();
  }, 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game) saveGame();
  });

  // ---------- Events ----------
  function bindEvents() {
    $('btn-continue').addEventListener('click', () => {
      paused = false;
      showView('game');
    });
    $('btn-new').addEventListener('click', chooseDifficulty);
    $('btn-daily').addEventListener('click', startDaily);
    $('btn-settings-home').addEventListener('click', openSettings);
    $('btn-settings-game').addEventListener('click', openSettings);
    $('btn-back').addEventListener('click', () => {
      if (game) saveGame();
      showView('home');
    });
    $('btn-pause').addEventListener('click', () => setPaused(!paused));
    $('btn-resume').addEventListener('click', () => setPaused(false));
    $('btn-undo').addEventListener('click', undo);
    $('btn-erase').addEventListener('click', erase);
    $('btn-notes').addEventListener('click', toggleNotes);
    $('btn-hint').addEventListener('click', hint);

    // Tap sounds: wood for the tool row, pop for every other button (number pad plays its own).
    document.addEventListener(
      'click',
      (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled || b.classList.contains('num')) return;
        if (b.closest('.tools')) playWood();
        else playPop();
      },
      true
    );

    $('modal').addEventListener('click', (e) => {
      if (e.target === $('modal') && !modalLocked) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (modalOpen()) {
        if (e.key === 'Escape' && !modalLocked) closeModal();
        return;
      }
      if (view !== 'game') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k >= '1' && k <= '9') pressDigit(Number(k));
      else if (k === 'Backspace' || k === 'Delete' || k === '0') erase();
      else if (k === 'ArrowUp') moveSelection(-1, 0);
      else if (k === 'ArrowDown') moveSelection(1, 0);
      else if (k === 'ArrowLeft') moveSelection(0, -1);
      else if (k === 'ArrowRight') moveSelection(0, 1);
      else if (k === 'n' || k === 'N') toggleNotes();
      else if (k === 'h' || k === 'H') hint();
      else if (k === ' ' || k === 'p' || k === 'P') setPaused(!paused);
      else return;
      e.preventDefault();
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
  }

  // ---------- Boot ----------
  buildBoard();
  bindEvents();
  applySettings();
  showView('home');

  const isLocalDev = ['localhost', '127.0.0.1'].indexOf(location.hostname) !== -1;
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !isLocalDev) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
