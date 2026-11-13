/* Lettura ad alta voce degli scritti: usa la sintesi vocale del browser, nessun servizio esterno. */
(function () {
  'use strict';
  var synth = window.speechSynthesis;
  var main = document.querySelector('main');
  if (!synth || !main || typeof SpeechSynthesisUtterance === 'undefined') return;
  if (main.querySelector('.cards')) return;                       // pagine elenco: niente lettura
  var pagina = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (pagina === 'index.html' || pagina === 'contatti.html' || pagina === 'viaggi.html' || pagina === '') return;

  // ---- blocchi da leggere, nell'ordine in cui compaiono
  var sel = '.hero h1, .hero p, main h2, main h3, main p, main li, main blockquote';
  var blocchi = [];
  Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
    if (el.closest('.note, .su, .indice, .leggi, nav, footer, .btn')) return;
    if (el.tagName === 'P' && el.closest('li, blockquote')) return;
    if (el.tagName === 'LI' && el.querySelector('li')) return;
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t.length < 2) return;
    blocchi.push({ el: el, testo: t });
  });
  if (!blocchi.length) return;

  // ---- spezza i blocchi lunghi in frasi (alcuni browser interrompono le frasi troppo lunghe)
  function pezzi(t) {
    var out = [], frasi = t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t], cur = '';
    frasi.forEach(function (f) {
      if ((cur + f).length > 220 && cur) { out.push(cur.trim()); cur = f; } else { cur += f; }
    });
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  var coda = [];
  blocchi.forEach(function (b, i) { pezzi(b.testo).forEach(function (p) { coda.push({ i: i, p: p }); }); });

  // ---- controlli
  var box = document.createElement('div');
  box.className = 'leggi';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Ascolta questo scritto');
  box.innerHTML =
    '<button type="button" class="leggi-play" aria-label="Ascolta">&#9654; Ascolta</button>' +
    '<button type="button" class="leggi-stop" aria-label="Ferma" disabled>&#9632; Ferma</button>' +
    '<label class="leggi-vel">Velocit&agrave; <select aria-label="Velocit&agrave; di lettura">' +
    '<option value="0.85">Lenta</option><option value="1" selected>Normale</option><option value="1.2">Veloce</option></select></label>';
  var host = main.querySelector('section') || main;
  var dopoNota = host.querySelector('.note');                       // sotto "Torna a ..." se c'è
  if (dopoNota && dopoNota === host.firstElementChild) host.insertBefore(box, dopoNota.nextSibling);
  else host.insertBefore(box, host.firstChild);
  var bPlay = box.querySelector('.leggi-play'), bStop = box.querySelector('.leggi-stop'), vel = box.querySelector('select');

  var pos = 0, stato = 'fermo', evid = null, sessione = 0;

  function voce() {
    var v = synth.getVoices() || [];
    var it = v.filter(function (x) { return /^it(-|_|$)/i.test(x.lang); });
    return it.length ? it[0] : null;
  }
  function evidenzia(i) {
    if (evid) evid.classList.remove('leggendo');
    evid = blocchi[i] ? blocchi[i].el : null;
    if (evid) {
      evid.classList.add('leggendo');
      try { evid.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { evid.scrollIntoView(); }
    }
  }
  function aggiorna() {
    bPlay.innerHTML = stato === 'lettura' ? '&#10074;&#10074; Pausa' : (stato === 'pausa' ? '&#9654; Riprendi' : '&#9654; Ascolta');
    bStop.disabled = stato === 'fermo';
  }
  function parla() {
    if (stato !== 'lettura') return;
    if (pos >= coda.length) { ferma(); return; }
    var mia = sessione, c = coda[pos];
    if (!evid || blocchi[c.i].el !== evid) evidenzia(c.i);
    var u = new SpeechSynthesisUtterance(c.p);
    u.lang = 'it-IT'; u.rate = parseFloat(vel.value) || 1;
    var v = voce(); if (v) u.voice = v;
    u.onend = function () { if (mia !== sessione) return; pos++; parla(); };
    u.onerror = function (e) { if (mia !== sessione) return; if (e && e.error === 'interrupted') return; pos++; parla(); };
    synth.speak(u);
  }
  function avvia() { sessione++; synth.cancel(); stato = 'lettura'; aggiorna(); parla(); }
  function ferma() { sessione++; synth.cancel(); stato = 'fermo'; pos = 0; if (evid) evid.classList.remove('leggendo'); evid = null; aggiorna(); }

  bPlay.addEventListener('click', function () {
    if (stato === 'fermo') { pos = 0; avvia(); }
    else if (stato === 'lettura') { stato = 'pausa'; sessione++; synth.cancel(); aggiorna(); }  // pausa: riparte dalla frase corrente
    else { avvia(); }
  });
  bStop.addEventListener('click', ferma);
  vel.addEventListener('change', function () { if (stato === 'lettura') avvia(); });
  // toccare un paragrafo mentre si ascolta fa ripartire da lì
  blocchi.forEach(function (b, i) {
    b.el.addEventListener('click', function (e) {
      if (stato === 'fermo' || e.target.closest('a')) return;
      for (var k = 0; k < coda.length; k++) { if (coda[k].i === i) { pos = k; break; } }
      avvia();
    });
  });
  window.addEventListener('pagehide', function () { synth.cancel(); });
  window.addEventListener('beforeunload', function () { synth.cancel(); });
  if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = function () {};
})();
