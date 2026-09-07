import { BlackjackEngine, normalizedTC, total } from './src/engine.js';
const $ = s => document.querySelector(s);
let engine = new BlackjackEngine({decks:6}), quizTarget=null, graded=false;
const emptyStats=()=>({asked:0,correct:0,history:[]});
let stats=emptyStats();
try {const s=JSON.parse(localStorage.getItem('opp-trainer-stats'));if(s&&Number.isFinite(s.asked)&&Number.isFinite(s.correct)&&Array.isArray(s.history))stats=s;} catch {}
function save(){try{localStorage.setItem('opp-trainer-stats',JSON.stringify(stats))}catch{}}
const signed=n=>n>0?`+${n}`:String(n);
function cardHTML(c){return `<div class="card ${['♥','♦'].includes(c.suit)?'red ':''}${c.hidden?'hidden-card':''}" aria-label="${c.hidden?'Face-down card':c.rank+c.suit}">${c.hidden?'':`<span class="rank">${c.rank==='T'?'10':c.rank}</span><span class="suit">${c.suit}</span>`}</div>`}
function handHTML(h,active=false){return `<div class="hand-wrap ${active?'active':''}"><div class="hand">${h.cards.map(cardHTML).join('')}</div><div class="outcome">${h.cards.some(c=>c.hidden)?'HOLE CARD HIDDEN':total(h.cards)}${h.outcome?' · '+h.outcome.toUpperCase():''}</div></div>`}
function render(){
 $('#rc').textContent=engine.phase==='ready'?'+6':graded?signed(engine.runningCount):'?';
 $('#cards-left').textContent=`${engine.shoe.length} · ${engine.decksRemaining.toFixed(2)}D`;
 $('#round').textContent=engine.round; $('#phase').textContent=engine.phase.replaceAll('-',' ').toUpperCase();
 $('#shoe-detail').textContent=`Shoe ${engine.shoeNumber||1} · ${engine.decks*52-engine.shoe.length} / ${engine.decks*52} cards dealt · cut at 75%`;
 $('#shoe-progress').value=engine.decks*52-engine.shoe.length;$('#shoe-progress').max=engine.decks*52;
 $('#bankroll').textContent=`${engine.bankroll??1000} chips`;
 $('#dealer-hand').innerHTML=engine.dealer?handHTML(engine.dealer):'';
 $('#seats').innerHTML=engine.opponents?.map((h,i)=>`<div class="other-seat"><div class="seat-title">SEAT ${i+1}<span>AUTO · STAND 17</span></div>${handHTML(h)}</div>`).join('')||'';
 $('#player-hands').innerHTML=engine.hands?.map((h,i)=>`<div class="player-hand"><div class="seat-title">${engine.hands.length>1?`HAND ${i+1}`:'PLAYER'} · ${h.bet} CHIPS${h.doubled?' · DOUBLE':''}</div>${handHTML(h,engine.phase==='playing'&&i===engine.activeIndex)}</div>`).join('')||'';
 $('#bet').disabled=engine.phase==='playing'||(engine.phase==='round-complete'&&!graded);
 renderControls();renderStats();
}
function renderControls(){const c=$('#controls');
 if(engine.phase==='round-complete'&&!graded){c.innerHTML='<span class="muted">Complete the count check below to continue ↓</span>';return}
 if(engine.phase!=='playing'){c.innerHTML='<button class="primary" id="deal">'+(engine.phase==='ready'?'Deal round':'Deal next round')+' <kbd>↵</kbd></button>';$('#deal').onclick=startRound;return}
 c.innerHTML=`<button id="hit" ${engine.canHit(engine.activeHand)?'':'disabled'}>Hit <kbd>H</kbd></button><button id="stand">Stand <kbd>S</kbd></button><button id="double" ${engine.canDouble?.()?'':'disabled'}>Double <kbd>D</kbd></button><button id="split" ${engine.canSplit()?'':'disabled'}>Split</button>`;
 for(const action of ['hit','stand','double','split'])$('#'+action).onclick=()=>{engine[action]();afterAction()};
}
function afterAction(){if(engine.phase==='round-complete')openQuiz();render()}
function startRound(){
 if(engine.phase==='round-complete'&&!graded)return;
 const bet=Number($('#bet').value);
 if(!Number.isFinite(bet)||bet<1||!Number.isInteger(bet)||bet>engine.bankroll){$('#message').textContent='Choose a whole-chip bet within your bankroll. New session restores 1,000 practice chips.';return}
 graded=false;quizTarget=null;$('#quiz').classList.add('hidden');
 engine.startRound(bet);$('#message').textContent='Your move. Count low cards, subtract one for each final hand. Begin each new shoe at +6.';afterAction();
}
function openQuiz(){quizTarget={rc:engine.runningCount,tc:normalizedTC(engine.runningCount,engine.decksRemaining)};$('#quiz').classList.remove('hidden');$('#rc-answer').value='';$('#tc-answer').value='';$('#check-quiz').disabled=false;$('#quiz-result').innerHTML='';$('#quiz-decks').textContent=`Use ${engine.shoe.length} ÷ 52 = ${engine.decksRemaining.toFixed(6)} decks remaining (use the exact fraction). Round the result to one decimal.`;$('#message').textContent='Round complete. Count all final hands, including the dealer and any split hands.';$('#quiz').scrollIntoView({behavior:'smooth',block:'nearest'})}
function parseNum(v){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.trim()))return null;return Number(v)}
function checkQuiz(){
 if(!quizTarget||graded)return;
 const rc=parseNum($('#rc-answer').value),tc=parseNum($('#tc-answer').value);
 if(rc===null||!Number.isInteger(rc)||tc===null){$('#quiz-result').textContent='Enter a whole-number running count and a numeric normalized count before checking.';return}
 graded=true;const rcOk=rc===quizTarget.rc,tcOk=Math.abs(tc-quizTarget.tc)<.051;
 stats.asked+=2;stats.correct+=Number(rcOk)+Number(tcOk);stats.history.unshift({round:engine.round,shoe:engine.shoeNumber,rc:rcOk,tc:tcOk});stats.history=stats.history.slice(0,10);save();
 $('#check-quiz').disabled=true;
 const roundDelta=engine.results.reduce((s,r)=>s+r.delta,0);
 $('#quiz-result').innerHTML=`<div class="result-head">${rcOk&&tcOk?'✓ Sharp count.':'Let’s break it down.'}<br>Running count: <b>${signed(quizTarget.rc)}</b> ${rcOk?'✓':'✕'} · Normalized exercise: <b>${quizTarget.tc.toFixed(1)}</b> ${tcOk?'✓':'✕'}<p>Previous RC ${signed(quizTarget.rc-roundDelta)} + round change ${signed(roundDelta)} = ${signed(quizTarget.rc)}.<br>(${quizTarget.rc} − 6) ÷ (${engine.shoe.length}/52) = ${quizTarget.tc.toFixed(1)}</p></div>`+engine.results.map((r,i)=>`<div class="explain"><span>${r.handId==='dealer'?'Dealer':r.handId.startsWith('seat')?'Auto seat '+(Number(r.handId.split('-')[1])+1):'Your hand '+(i+1)} · ${r.ranks.join(' ')}<br>${r.ranks.filter(x=>['2','3','4','5','6'].includes(x)).length} low cards − 1 = <b>${signed(r.delta)}</b></span><span>${r.outcome}</span></div>`).join('');render();renderHistory();
}
function renderStats(){$('#accuracy').textContent=stats.asked?`${Math.round(stats.correct/stats.asked*100)}%`:'—'}
function renderHistory(){$('#history').innerHTML=stats.history.length?stats.history.map(x=>`<div class="history-row"><span>Round ${Number(x.round)}</span><span>RC <b>${x.rc?'✓':'×'}</b> · TC exercise <b>${x.tc?'✓':'×'}</b></span></div>`).join(''):'<p class="muted">Your rounds will appear here. Accuracy is saved on this device.</p>'}
function reset(session=false){if(engine.phase==='playing'&&!confirm('Abandon this round and shuffle a new shoe?'))return;const bank=engine.bankroll;engine=new BlackjackEngine({decks:Number($('#deck-select').value)});if(!session&&Number.isFinite(bank))engine.bankroll=bank;graded=false;quizTarget=null;$('#quiz').classList.add('hidden');$('#message').textContent='Fresh shoe. Start the running count at +6.';render()}
$('#deck-select').onchange=()=>reset();$('#new-shoe').onclick=()=>reset();$('#new-session').onclick=()=>reset(true);
$('#clear-history').onclick=()=>{stats=emptyStats();save();renderStats();renderHistory()};$('#check-quiz').onclick=checkQuiz;
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;const key=e.key.toLowerCase();if(key==='enter')$('#deal')?.click();if(key==='h')$('#hit')?.click();if(key==='s')$('#stand')?.click();if(key==='d')$('#double')?.click()});
renderHistory();render();
