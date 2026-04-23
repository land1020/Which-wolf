import{ROLE_DEFS,AVAILABLE_COLORS,roleColor,renderPlayerListItems,renderRoleCard,renderColorDots,renderCardChoice,renderTargetButtons,renderResultPlayers}from'./RenderHelpers.js';
export class UIManager{
constructor(socket){this.socket=socket;this.room=null;this.myId=null;this.roomId=null;this.currentTimer=null;this.prevPhase=null;this.prevIdx=-1;this.prevMidIdx=-1;
this.screens={TITLE:document.getElementById('title-screen'),LOBBY:document.getElementById('lobby-screen'),GAME:document.getElementById('game-screen')};}
get me(){return this.room?.players?.find(p=>p.id===this.myId)||null;}
get isHost(){return this.me?.isHost||false;}
applyServerState(rd){
this.room=rd;this.roomId=rd.roomId;
const ph=rd.phase;const idx=rd.currentPlayerIndex;const midIdx=rd.currentMiddayRoleIndex;
const phChanged=ph!==this.prevPhase;const idxChanged=idx!==this.prevIdx;const midChanged=midIdx!==this.prevMidIdx;
this.prevPhase=ph;this.prevIdx=idx;this.prevMidIdx=midIdx;
if(ph==='LOBBY'){this.showScreen('LOBBY');this.updateLobbyUI();}
else{this.showScreen('GAME');
if(ph==='CARD_DIST')this.renderCardDist();
else if(ph==='PREP'&&(phChanged||idxChanged))this.renderPrep();
else if((ph==='MORNING'||ph==='NIGHT')&&phChanged)this.renderDiscussion(ph);
else if(ph==='MIDDAY'&&(phChanged||midChanged))this.renderMidday();
else if(ph==='VOTE'&&(phChanged||idxChanged))this.renderVote();
else if(ph==='RESULT'&&phChanged)this.renderResult();
}}
init(){
document.getElementById('enter-room-btn').addEventListener('click',()=>{
const name=document.getElementById('entry-name').value.trim();
const room=document.getElementById('entry-room').value.trim();
if(!name){alert('お名前を入力してください。');return;}
if(!/^\d{4}$/.test(room)){alert('部屋番号は4桁の数字を入力してください。');return;}
this.roomId=room;
this.socket.joinRoom(room,name,(res)=>{
if(res.error){alert(res.error);return;}
this.myId=res.playerId;});});
document.getElementById('reset-room-btn').addEventListener('click',()=>{
const room=document.getElementById('entry-room').value.trim();
if(!/^\d{4}$/.test(room)){alert('リセットしたい部屋番号を4桁で入力してください。');return;}
if(confirm(`部屋番号「${room}」の状態を強制リセットしますか？\n(進行中のゲームも終了します)`)){
localStorage.removeItem(`werewolf_wins_${room}`);
this.socket.resetRoom(room);
alert(`部屋番号「${room}」のルーム情報をリセットしました！`);}});
document.getElementById('back-to-title').addEventListener('click',()=>{location.reload();});
document.getElementById('add-npc-btn').addEventListener('click',()=>{
if(!this.roomId)return;this.socket.addNpc(this.roomId);});
document.getElementById('ready-btn').addEventListener('click',()=>{
if(!this.roomId)return;this.socket.startGame(this.roomId);});
const ts=document.getElementById('setting-discussion-time');
const td=document.getElementById('time-display-val');
if(ts)ts.addEventListener('input',(e)=>{
const m=parseInt(e.target.value);if(td)td.textContent=`${m}分`;
if(this.roomId)this.socket.updateSettings(this.roomId,{discussionTime:m*60});});}
showScreen(phase){
Object.values(this.screens).forEach(s=>s.classList.remove('active'));
if(phase==='TITLE')this.screens.TITLE.classList.add('active');
else if(phase==='LOBBY')this.screens.LOBBY.classList.add('active');
else this.screens.GAME.classList.add('active');}
updateLobbyUI(){
if(!this.room)return;
const list=document.getElementById('player-list');
const count=document.getElementById('player-count');
list.innerHTML=renderPlayerListItems(this.room.players,this.roomId);
count.textContent=this.room.players.length;
// color picker
const picker=document.getElementById('color-picker');
picker.innerHTML=renderColorDots(AVAILABLE_COLORS,this.room.players,this.myId);
picker.querySelectorAll('.color-dot-sel').forEach(d=>{
d.addEventListener('click',()=>{
const c=d.dataset.color;const occ=this.room.players.find(p=>p.color===c);
if(occ&&occ.id!==this.myId)return;
this.socket.changeColor(this.roomId,c);});});
// time
const ts=document.getElementById('setting-discussion-time');
const td=document.getElementById('time-display-val');
if(ts){ts.disabled=!this.isHost;const m=this.room.settings.discussionTime/60;ts.value=m;if(td)td.textContent=`${m}分`;}
// roles
const grid=document.getElementById('roles-grid');
const summary=document.getElementById('role-count-summary');
let total=0;grid.innerHTML='';
Object.keys(ROLE_DEFS).forEach(r=>{
const c=this.room.settings.roleCounts[r]||0;total+=c;
grid.innerHTML+=renderRoleCard(r,c,this.isHost);});
grid.querySelectorAll('.role-name-btn').forEach(b=>{
b.addEventListener('click',()=>{const d=ROLE_DEFS[b.dataset.role];alert(`【${b.dataset.role}】(${d.faction})\n\n${d.desc}`);});});
if(this.isHost){
grid.querySelectorAll('.plus-btn').forEach(b=>b.addEventListener('click',()=>{
const rc={...this.room.settings.roleCounts};rc[b.dataset.role]=(rc[b.dataset.role]||0)+1;
this.socket.updateSettings(this.roomId,{roleCounts:rc});}));
grid.querySelectorAll('.minus-btn').forEach(b=>b.addEventListener('click',()=>{
const rc={...this.room.settings.roleCounts};if(rc[b.dataset.role]>0)rc[b.dataset.role]--;
this.socket.updateSettings(this.roomId,{roleCounts:rc});}));}
const req=this.room.players.length*2;
summary.textContent=`(合計: ${total}枚 / 必要: ${req}枚)`;
const rb=document.getElementById('ready-btn');
if(rb){const ok=this.room.players.length>=2&&total===req&&this.isHost;
rb.disabled=!ok;rb.style.opacity=ok?'1':'0.5';rb.style.cursor=ok?'pointer':'not-allowed';
rb.textContent=this.isHost?'ゲーム開始':'ホストの開始を待機中...';}}
renderCardDist(){
const ov=document.getElementById('game-ui-overlay');
const cp=this.room.players[this.room.currentPlayerIndex];
if(!cp)return;
const isMyTurn=cp.id===this.myId;
if(!isMyTurn){ov.innerHTML=`<div class="turn-overlay glass" style="text-align:center"><h2>${cp.name} さんがカードを選択中...</h2><p>しばらくお待ちください。</p></div>`;return;}
if(cp.chosenRole){
ov.innerHTML=`<div class="turn-overlay glass" style="text-align:center"><h2>役職は「${cp.chosenRole.role}」に決定しました</h2><button id="next-turn-btn" class="btn-primary" style="margin-top:20px">次へ</button></div>`;
document.getElementById('next-turn-btn').addEventListener('click',()=>this.socket.nextPlayerTurn(this.roomId));return;}
ov.innerHTML=`<div class="turn-overlay glass"><h2>${cp.name} さんのカード</h2><p>自分の役職（ドッチか）を選んでください。</p><div class="cards-container" style="display:flex;gap:20px;margin-top:30px">${renderCardChoice(cp.dealtCards)}</div></div>`;
ov.querySelectorAll('.role-desc-btn').forEach(b=>b.addEventListener('click',(e)=>{e.stopPropagation();const d=ROLE_DEFS[b.dataset.role];if(d)alert(`【${b.dataset.role}】(${d.faction})\n\n${d.desc}`);}));
ov.querySelectorAll('.select-role-btn').forEach(b=>b.addEventListener('click',()=>{
this.socket.chooseCard(this.roomId,parseInt(b.dataset.index));}));}
renderPrep(){
const ov=document.getElementById('game-ui-overlay');
const cp=this.room.players[this.room.currentPlayerIndex];
if(!cp)return;
const isMyTurn=cp.id===this.myId;
if(!isMyTurn){ov.innerHTML=`<div class="turn-overlay glass" style="text-align:center"><h2>${cp.name} さんが準備フェーズ行動中...</h2><p>しばらくお待ちください。</p></div>`;return;}
const rn=cp.chosenRole?cp.chosenRole.role:'市民';
let ah='';
if(rn==='人狼'||rn==='大狼'){
const wolves=this.room.players.filter(p=>p.chosenRole&&(p.chosenRole.role==='人狼'||p.chosenRole.role==='大狼')&&p.id!==cp.id);
ah=wolves.length>0?`<p>仲間の人狼は: <strong>${wolves.map(w=>w.name).join(', ')}</strong> です</p>`:`<p>仲間の人狼はいません。（あなたが単独です）</p>`;
}else if(rn==='少年'){
const boys=this.room.players.filter(p=>p.chosenRole&&p.chosenRole.role==='少年'&&p.id!==cp.id);
ah=boys.length>0?`<p>仲間の少年は: <strong>${boys.map(b=>b.name).join(', ')}</strong> です</p>`:`<p>仲間の少年はいません。</p>`;
}else if(rn==='占い師'){
ah=`<p>【占い師の能力】占う対象を選んでください。</p>
<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
${renderTargetButtons(this.room.players,this.myId,'prep-seer-btn',p=>p.name+'の役職を占う')}
<button class="btn-secondary prep-seer-remain-btn">残りカードから2枚占う</button></div>
<div id="seer-result" style="margin-top:20px;font-weight:bold;color:var(--primary)"></div>`;
}else{ah=`<p>あなたの役職（${rn}）は夜のアクションがありません。</p>`;}
ov.innerHTML=`<div class="turn-overlay glass"><h2>あなたの役職: ${rn}</h2><div style="margin:20px 0">${ah}</div><button id="end-prep-btn" class="btn-primary" style="margin-top:20px">完了して次へ</button></div>`;
if(rn==='占い師'){
let used=false;const rd=document.getElementById('seer-result');
ov.querySelectorAll('.prep-seer-btn').forEach(b=>b.addEventListener('click',()=>{
if(used)return;const t=this.room.players.find(p=>p.id===b.dataset.target);
let dr=t.chosenRole.role;if(dr==='大狼')dr='市民';
rd.innerHTML=`${t.name}の役職は「${dr}」です。`;used=true;}));
const rb=ov.querySelector('.prep-seer-remain-btn');
if(rb)rb.addEventListener('click',()=>{
if(used)return;const all=this.room.players.map(p=>p.remainingCard).filter(c=>c);
const sh=all.sort(()=>0.5-Math.random()).slice(0,2);
if(sh.length===2)rd.innerHTML=`残りカードは「${sh[0].role}」と「${sh[1].role}」でした。`;
else if(sh.length===1)rd.innerHTML=`残りカードは「${sh[0].role}」でした。`;
else rd.innerHTML=`占える残りカードがありません。`;used=true;});}
document.getElementById('end-prep-btn').addEventListener('click',()=>this.socket.endPrep(this.roomId));}
renderDiscussion(phaseName){
const ov=document.getElementById('game-ui-overlay');
const isMorning=phaseName==='MORNING';
const title=isMorning?'朝の議論フェーズ':'夜の議論フェーズ';
const nextPhase=isMorning?'MIDDAY':'VOTE';
const activeRoles=Object.keys(this.room.settings.roleCounts).filter(r=>this.room.settings.roleCounts[r]>0);
const roleOpts=['不明',...activeRoles].map(r=>`<option value="${r}">${r}</option>`).join('');
const plHtml=this.room.players.map(p=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(255,255,255,0.05)">
<div style="flex:1;background:${p.color};color:#fff;padding:10px 15px;border-radius:6px;font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.5);box-shadow:0 0 10px ${p.color}40">${p.name}</div>
<div style="display:flex;gap:10px"><div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px">役職カード</div><select class="memo-select" style="padding:6px;background:rgba(0,0,0,0.5);color:white;border:1px solid var(--glass-border);border-radius:4px;cursor:pointer;max-width:100px">${roleOpts}</select></div>
<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px">残りカード</div><select class="memo-select" style="padding:6px;background:rgba(0,0,0,0.5);color:white;border:1px solid var(--glass-border);border-radius:4px;cursor:pointer;max-width:100px">${roleOpts}</select></div></div></div>`).join('');
const rsHtml=activeRoles.map(r=>`<div style="background:rgba(0,0,0,0.4);padding:8px 12px;border-radius:6px;border:1px solid var(--glass-border);font-size:0.9rem;display:flex;align-items:center;gap:8px"><span style="font-weight:bold">${r}</span><span style="background:var(--primary);color:#fff;padding:2px 6px;border-radius:4px;font-size:0.8rem">${this.room.settings.roleCounts[r]}枚</span></div>`).join('');
ov.innerHTML=`<div class="turn-overlay glass" style="max-width:700px;width:95%;display:flex;flex-direction:column;max-height:90vh;padding:30px">
<div style="text-align:center;padding-bottom:20px;border-bottom:1px solid var(--glass-border);margin-bottom:20px;flex-shrink:0">
<h2 style="color:var(--primary);font-size:2rem;margin-bottom:15px">${title}</h2>
<div id="countdown-timer" style="font-size:4rem;font-weight:bold;font-family:monospace;letter-spacing:5px;margin:15px 0">--:--</div>
${this.isHost?`<button id="skip-timer-btn" class="btn-secondary">議論を強制終了</button>`:''}</div>
<div style="overflow-y:auto;flex:1;padding-right:10px">
<h3 style="margin-bottom:15px;font-size:1.1rem;border-bottom:1px dashed var(--glass-border);padding-bottom:5px">参加者リスト (役職推測メモ)</h3>
<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">※予想した役職をドロップダウンから選んでメモできます</p>
<div style="margin-bottom:30px">${plHtml}</div>
<h3 style="margin-bottom:15px;font-size:1.1rem;border-bottom:1px dashed var(--glass-border);padding-bottom:5px">設定されている役職一覧</h3>
<div style="display:flex;flex-wrap:wrap;gap:10px">${rsHtml}</div></div></div>`;
this.startTimer(this.room.settings.discussionTime,nextPhase);
const sb=document.getElementById('skip-timer-btn');
if(sb)sb.addEventListener('click',()=>{if(this.currentTimer)clearInterval(this.currentTimer);this.socket.skipTimer(this.roomId,nextPhase);});}
startTimer(dur,nextPhase){
if(this.currentTimer)clearInterval(this.currentTimer);
let t=dur;const td=document.getElementById('countdown-timer');
const upd=()=>{const m=Math.floor(t/60).toString().padStart(2,'0');const s=(t%60).toString().padStart(2,'0');if(td){td.textContent=`${m}:${s}`;if(t<=10)td.style.color='var(--accent)';}};
upd();this.currentTimer=setInterval(()=>{t--;upd();if(t<=0){clearInterval(this.currentTimer);if(this.isHost)this.socket.skipTimer(this.roomId,nextPhase);}},1000);}
renderMidday(){
const ov=document.getElementById('game-ui-overlay');
const cr=this.room.middayRoles[this.room.currentMiddayRoleIndex];
const me=this.me;
const isMyRole=me&&me.chosenRole&&me.chosenRole.role===cr;
if(!isMyRole){
const hasRole=this.room.players.some(p=>p.chosenRole&&p.chosenRole.role===cr);
ov.innerHTML=`<div class="turn-overlay glass" style="text-align:center"><h2 style="color:var(--primary);font-size:2rem">昼の行動: ${cr}</h2>
<p style="margin:20px 0">${hasRole?'該当プレイヤーが行動中です...':'該当する役職のプレイヤーはいません。'}</p>
${!hasRole||this.isHost?`<button id="midday-skip-btn" class="btn-secondary large">スキップ</button>`:''}</div>`;
const sk=document.getElementById('midday-skip-btn');if(sk)sk.addEventListener('click',()=>this.socket.nextMiddayTurn(this.roomId));return;}
ov.innerHTML=`<div class="turn-overlay glass" style="text-align:center"><h2 style="color:var(--primary);font-size:2rem">昼の行動: ${cr}</h2><p style="margin:20px 0">あなたが行動する番です。</p><button id="midday-act-btn" class="btn-primary large">行動する</button></div>`;
document.getElementById('midday-act-btn').addEventListener('click',()=>this.showMiddayAction(cr));}
showMiddayAction(rn){
const ov=document.getElementById('game-ui-overlay');
const me=this.me;let ah='';
if(rn==='情報屋'){ah=`<p>【情報屋】誰か一人の残りカードをすべて見ることができます。</p><div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${renderTargetButtons(this.room.players,this.myId,'midday-action-btn',p=>p.name+'の残りカードを見る')}</div><div id="midday-result" style="margin-top:20px;font-weight:bold;color:var(--primary)"></div>`;}
else if(rn==='警察'){ah=`<p>【警察】誰か一人の残りカードの1枚を見ることができます。</p><div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${renderTargetButtons(this.room.players,this.myId,'midday-action-btn',p=>p.name+'の残りカードを見る')}</div><div id="midday-result" style="margin-top:20px;font-weight:bold;color:var(--primary)"></div>`;}
else if(rn==='怪盗'){ah=`<p>【怪盗】自分の役職と誰かの役職カードを交換し、入れ替えたカードを確認します。</p><div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${renderTargetButtons(this.room.players,this.myId,'midday-action-btn',p=>p.name+'の役職と入れ替える')}</div><div id="midday-result" style="margin-top:20px;font-weight:bold;color:var(--primary)"></div>`;}
else if(rn==='DJ'){ah=`<p>【DJ】誰かの残りカードと、別の誰かの残りカードを入れ替えます。</p><div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${renderTargetButtons(this.room.players,this.myId,'midday-action-btn-multi',p=>p.name)}</div><div id="midday-result" style="margin-top:20px;font-weight:bold;color:var(--primary)"></div>`;}
ov.innerHTML=`<div class="turn-overlay glass"><h2>あなたの役職: ${rn}</h2><div style="margin:20px 0">${ah}</div><button id="end-midday-btn" class="btn-primary" style="margin-top:20px">完了して次へ</button></div>`;
const rd=document.getElementById('midday-result');let used=false;let djSel=[];
if(rn==='情報屋'||rn==='警察'){
ov.querySelectorAll('.midday-action-btn').forEach(b=>b.addEventListener('click',()=>{
if(used)return;const t=this.room.players.find(p=>p.id===b.dataset.target);
rd.innerHTML=`${t.name}の残りカードは「${t.remainingCard.role}」です。`;used=true;}));}
else if(rn==='怪盗'){
ov.querySelectorAll('.midday-action-btn').forEach(b=>b.addEventListener('click',()=>{
if(used)return;this.socket.middayAction(this.roomId,{type:'swap-role',targetId:b.dataset.target});
const t=this.room.players.find(p=>p.id===b.dataset.target);
rd.innerHTML=`${t.name}の役職と入れ替えました。`;used=true;}));}
else if(rn==='DJ'){
ov.querySelectorAll('.midday-action-btn-multi').forEach(b=>b.addEventListener('click',()=>{
if(used)return;if(djSel.includes(b.dataset.target))return;
djSel.push(b.dataset.target);b.style.backgroundColor='var(--primary)';
if(djSel.length===2){
this.socket.middayAction(this.roomId,{type:'swap-remaining',targetId1:djSel[0],targetId2:djSel[1]});
const t1=this.room.players.find(p=>p.id===djSel[0]);const t2=this.room.players.find(p=>p.id===djSel[1]);
rd.innerHTML=`${t1.name}と${t2.name}の残りカードを入れ替えました。`;used=true;}}));}
document.getElementById('end-midday-btn').addEventListener('click',()=>this.socket.nextMiddayTurn(this.roomId));}
renderVote(){
const ov=document.getElementById('game-ui-overlay');
const cp=this.room.players[this.room.currentPlayerIndex];
if(!cp)return;
if(cp.id!==this.myId){ov.innerHTML=`<div class="turn-overlay glass" style="text-align:center"><h2 style="color:var(--accent);font-size:2rem">投票フェーズ</h2><h3>${cp.name} さんが投票中...</h3><p style="margin:20px 0">しばらくお待ちください。</p></div>`;return;}
ov.innerHTML=`<div class="turn-overlay glass" style="text-align:center"><h2 style="color:var(--accent);font-size:2rem">投票フェーズ</h2><h3>${cp.name} さんの投票</h3><p style="margin:20px 0">怪しいと思うプレイヤーに投票してください。</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px">
<button class="btn-secondary vote-btn" data-target="PEACE" style="grid-column:span 2;border-color:var(--primary)">平和村へ投票</button>
${this.room.players.filter(p=>p.id!==cp.id).map(p=>`<button class="btn-secondary vote-btn" data-target="${p.id}">${p.name}</button>`).join('')}
</div></div>`;
ov.querySelectorAll('.vote-btn').forEach(b=>b.addEventListener('click',()=>{this.socket.vote(this.roomId,b.dataset.target);}));}
renderResult(){
const ov=document.getElementById('game-ui-overlay');
const rd=this.room.resultData;if(!rd)return;
// 勝利数更新
const roomKey=`werewolf_wins_${this.roomId||'local'}`;
let ws=JSON.parse(localStorage.getItem(roomKey)||'{}');
if(!this._winUpdated){this.room.players.forEach(p=>{if(p.isWinner)ws[p.name]=(ws[p.name]||0)+1;});localStorage.setItem(roomKey,JSON.stringify(ws));this._winUpdated=true;}
let msg=`<h2 class="winner-text" style="font-size:2.5rem;margin-bottom:20px;text-shadow:0 4px 10px rgba(245,158,11,0.5)">勝敗: ${rd.winnerTeam} の勝利！</h2>`;
if(rd.isPeace){msg+=`<p style="margin-bottom:20px">全員が平和村へ投票しました。</p>`;}
else if(this.room.executionResult){
const exN=this.room.executionResult.executedPlayers.map(id=>{const p=this.room.players.find(x=>x.id===id);return p?p.name:'不明';}).join(' と ');
msg+=`<p style="margin-bottom:20px;font-size:1.1rem">最多票を集め、処刑されたのは: <strong>${exN}</strong> です。</p>`;}
const btns=this.isHost?`<div style="display:flex;justify-content:space-between;gap:10px;margin-top:30px"><button id="back-lobby-btn" class="btn-primary large" style="flex:1">ロビーに戻る</button><button id="back-title-btn" class="btn-secondary large" style="flex:1">タイトルに戻る</button></div>`:`<div style="margin-top:30px;padding:15px;background:rgba(0,0,0,0.4);border-radius:8px;border:1px dashed var(--glass-border)"><p style="color:var(--text-muted);margin:0">ホストの操作を待機しています...</p></div>`;
ov.innerHTML=`<div class="turn-overlay glass" style="max-width:600px;width:100%;text-align:center">${msg}<div style="text-align:left;margin-top:30px;max-height:40vh;overflow-y:auto">${renderResultPlayers(this.room.players,this.roomId)}</div>${btns}</div>`;
const bl=document.getElementById('back-lobby-btn');if(bl)bl.addEventListener('click',()=>{this._winUpdated=false;this.socket.backToLobby(this.roomId);});
const bt=document.getElementById('back-title-btn');if(bt)bt.addEventListener('click',()=>location.reload());}}
