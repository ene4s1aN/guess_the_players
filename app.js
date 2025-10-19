// --- Hilfsfunktionen ----------------------------------------------------
const toFlag = (country) => {
  const map = {
    "Deutschland":"DE", "Frankreich":"FR", "England":"GB", "Spanien":"ES",
    "Portugal":"PT", "Norwegen":"NO", "Polen":"PL", "Belgien":"BE",
    "Niederlande":"NL", "Italien":"IT", "Österreich":"AT", "Schweiz":"CH",
    "Kroatien":"HR", "Kanada":"CA", "Ägypten":"EG", "Argentinien":"AR",
  };
  const code = map[country];
  if(!code) return "🌍";
  return code.replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt()));
};

const normalize = (s) => s
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Diakritika
  .replace(/[^a-z\s.-]/g, "") // Sonderzeichen weg (außer Leer/.-)
  .replace(/\s+/g, " ")
  .trim();

// Levenshtein-Distanz (klein & zügig)
function lev(a, b){
  a = normalize(a); b = normalize(b);
  const m=a.length, n=b.length; if(!m) return n; if(!n) return m;
  const dp = new Array(n+1);
  for(let j=0;j<=n;j++) dp[j]=j;
  for(let i=1;i<=m;i++){
    let prev = i-1; dp[0]=i;
    for(let j=1;j<=n;j++){
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j]+1, dp[j-1]+1, prev + (a[i-1]===b[j-1]?0:1)
      );
      prev = tmp;
    }
  }
  return dp[n];
}

function fuzzyMatch(input, targets){
  const inp = normalize(input);
  for(const t of targets){
    const n = normalize(t);
    if (n === inp) return true;                   // exakter Treffer
    if (n.includes(inp) && inp.length >= 3) return true; // Teilstring
    if (lev(inp, n) <= 2) return true;            // kleine Tippfehler
  }
  return false;
}

// --- Safety: prüfen, ob Daten geladen wurden ----------------------------
if (typeof PLAYERS === "undefined" || !Array.isArray(PLAYERS)) {
  console.error("PLAYERS ist nicht geladen. Prüfe, ob players.js vor app.js eingebunden ist.");
  alert("Fehler: Spielerdaten nicht gefunden. Bitte 'players.js' vor 'app.js' laden.");
}

// --- Spielzustand -------------------------------------------------------
const state = { order: [], index: 0, score: 0, streak: 0, revealed: 0 };

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function nextOrder(){
  state.order = shuffle([...Array(PLAYERS.length).keys()]);
  state.index = 0; state.score = 0; state.streak = 0; state.revealed = 0;
  updateMeta();
}

function current(){ return PLAYERS[state.order[state.index]]; }

function renderFacts(){
  const p = current();
  const facts = document.getElementById('facts');
  facts.innerHTML = '';
  const items = [
    {icon: toFlag(p.country), label:'Land', value:p.country},
    {icon: '🎯', label:'Position', value:p.position},
    {icon: '🏟️', label:'Verein', value:p.club},
  ];
  for(const it of items){
    const div = document.createElement('div');
    div.className = 'tile';
    div.innerHTML = `<span class="emoji">${it.icon}</span>
                     <div><div class="label">${it.label}</div>
                     <div class="value">${it.value}</div></div>`;
    facts.appendChild(div);
  }
  document.getElementById('hintText').textContent = '';
  document.getElementById('feedback').textContent = '';
  document.getElementById('guess').value = '';
  state.revealed = 0;
}

function updateMeta(){
  document.getElementById('score').textContent = state.score;
  document.getElementById('streak').textContent = state.streak;
  document.getElementById('qIdx').textContent = Math.min(state.index+1, PLAYERS.length);
  document.getElementById('qTotal').textContent = PLAYERS.length;
  const pct = (state.index) / PLAYERS.length * 100;
  document.getElementById('bar').style.width = pct + '%';
}

function showHint(){
  const p = current();
  const hints = [
    `Initialen: <b>${p.name.split(' ').map(w=>w[0]).join('.')}.</b>`,
    `Nachname beginnt mit: <b>${p.name.split(' ').slice(-1)[0][0]}</b>…`,
    `Nationalflagge: <b>${toFlag(p.country)}</b>`,
  ];
  const idx = Math.min(state.revealed, hints.length-1);
  document.getElementById('hintText').innerHTML = 'Hinweis: ' + hints[idx];
  state.revealed++;
  if (idx>0) { state.score = Math.max(0, state.score-1); updateMeta(); }
}

function check(){
  const input = document.getElementById('guess').value.trim();
  if (!input) return;
  const p = current();
  const targets = [p.name, ...(p.aliases||[])];
  const ok = fuzzyMatch(input, targets);
  if (ok){
    const bonus = Math.max(1, 3 - state.revealed);
    state.score += bonus; state.streak += 1;
    document.getElementById('feedback').innerHTML = `✅ Richtig! <b>${p.name}</b> (+${bonus})`;
    goNext();
  } else {
    state.streak = 0;
    document.getElementById('feedback').innerHTML = `❌ Nicht ganz. Versuch einen Hinweis!`;
    updateMeta();
  }
}

function skip(){
  const p = current();
  document.getElementById('feedback').innerHTML = `ℹ️ War gesucht: <b>${p.name}</b>`;
  state.streak = 0;
  goNext(true);
}

function goNext(delay=false){
  updateMeta();
  const proceed = () => {
    state.index++;
    if (state.index >= PLAYERS.length){
      endScreen();
    } else {
      renderFacts(); updateMeta();
    }
  };
  if (delay){ setTimeout(proceed, 450); } else { setTimeout(proceed, 700); }
}

function endScreen(){
  const facts = document.getElementById('facts');
  facts.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'tile';
  div.innerHTML = `🏁 <div><div class="label">Geschafft!</div>
                   <div class="value">Dein Score: ${state.score} / Max ${PLAYERS.length*3}</div></div>`;
  facts.appendChild(div);
  document.getElementById('hintText').textContent = '';
  document.getElementById('feedback').innerHTML = '';
  document.getElementById('bar').style.width = '100%';

  const row = document.createElement('div');
  row.className = 'row'; row.style.marginTop = '12px';
  const again = document.createElement('button'); again.textContent = 'Nochmal spielen';
  again.onclick = () => { nextOrder(); renderFacts(); };
  const reveal = document.createElement('button'); reveal.className='ghost'; reveal.textContent = 'Spieler anzeigen';
  reveal.onclick = () => alert(PLAYERS.map(p=>p.name).join('\n'));
  row.appendChild(again); row.appendChild(reveal);
  facts.appendChild(row);
}

// --- Events -------------------------------------------------------------
document.getElementById('checkBtn').addEventListener('click', check);
document.getElementById('skipBtn').addEventListener('click', skip);
document.getElementById('hintBtn').addEventListener('click', showHint);
document.getElementById('guess').addEventListener('keydown', (e)=>{
  if(e.key==='Enter') check();
});

// --- Init ---------------------------------------------------------------
nextOrder();
renderFacts();
updateMeta();
