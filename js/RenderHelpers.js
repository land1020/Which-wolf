/**
 * レンダリング用ヘルパー関数群
 */

export const ROLE_DEFS = {
    '市民': { side: 'Blue', faction: '人間チーム', desc: '特殊能力なし。' },
    '占い師': { side: 'Blue', faction: '人間チーム', desc: '準備フェーズ:「誰かの役職カード」または「誰かの残りカードエリアから2枚」を確認する。' },
    '警察': { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ:「誰かの残りカード」を1枚確認する。' },
    'DJ': { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ: 指定したプレイヤーの「役職カード」と「残りカード」を入れ替える。' },
    '人狼': { side: 'Red', faction: '人狼チーム', desc: '準備フェーズ: 仲間の人狼（人狼・大狼）が誰かを確認する。' },
    '裏切り者': { side: 'Red', faction: '人狼チーム', desc: '特殊能力なし。人狼チームが勝利すれば勝利。' },
    'おばけ': { side: 'Gray', faction: '第3陣営', desc: '自分が追放されたら単独勝利。' },
    '大狼': { side: 'Red', faction: '人狼チーム', desc: '準備フェーズ: 仲間の人狼を確認する。占い師に占われても「市民」と判定される。' },
    '少年': { side: 'Blue', faction: '人間チーム', desc: '準備フェーズ: 仲間の「少年」が誰かを確認できる。' },
    '怪盗': { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ:「誰かの役職カード」と「自分の役職カード」を入れ替える。' },
    '情報屋': { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ:「誰かの残りカードエリア」のカードをすべて確認する。' },
    '逃亡者': { side: 'Gray', faction: '第3陣営', desc: '自分が追放されなければ勝利。' },
    '罠師': { side: 'Blue', faction: '人間チーム', desc: '自分が追放されると、自分に投票したプレイヤーを道連れにする。' }
};

export const AVAILABLE_COLORS = [
    '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
    '#8b4513', '#ec4899', '#14b8a6', '#eab308', '#64748b', '#a855f7'
];

export function roleColor(side) {
    return side === 'Red' ? '#f43f5e' : (side === 'Gray' ? '#9ca3af' : '#3b82f6');
}

export function renderPlayerListItems(players, roomId, winCounts = {}) {
    return players.map(p => {
        const winCount = winCounts[p.name] || 0;
        const crown = winCount > 0 ? `<span style="color:#fbbf24;font-weight:bold;margin-left:auto;text-shadow:0 0 5px rgba(251,191,36,0.5);font-size:1rem" title="累計勝利数">👑 ${winCount}</span>` : '';
        const offlineBadge = p.isOffline ? `<span style="margin-left:8px;padding:2px 8px;background:rgba(244,63,94,0.2);color:#f43f5e;border:1px solid rgba(244,63,94,0.4);border-radius:10px;font-size:0.75rem;font-weight:bold;animation:pulse 1.5s ease-in-out infinite">📵 切断中</span>` : '';
        return `<li style="background:linear-gradient(90deg,${p.color}${p.isOffline?'18':'30'} 0%,rgba(0,0,0,0.3) 100%);border-left:4px solid ${p.isOffline?'#666':p.color};padding:12px 15px;border-radius:6px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.2);opacity:${p.isOffline?'0.7':'1'}">
            <span style="font-weight:bold;font-size:1.1rem;text-shadow:1px 1px 3px rgba(0,0,0,0.8)">${p.name} <span style="font-size:0.8rem;color:rgba(255,255,255,0.6);margin-left:5px;font-weight:normal">${p.isHost ? '(Host)' : ''}</span></span>
            ${offlineBadge}
            ${crown}
        </li>`;
    }).join('');
}


export function renderRoleCard(role, count, isHost) {
    const def = ROLE_DEFS[role];
    const ic = roleColor(def.side);
    return `<div style="background:rgba(0,0,0,0.3);border:1px solid var(--glass-border);border-radius:8px;padding:10px;text-align:center;display:flex;flex-direction:column;align-items:center">
        <div style="width:40px;height:40px;border-radius:50%;border:2px solid ${ic};margin-bottom:8px;display:flex;justify-content:center;align-items:center;box-shadow:0 0 10px ${ic}40">
            <span style="font-size:1rem;color:#fff">${role[0]}</span>
        </div>
        <div class="role-name-btn" data-role="${role}" style="cursor:pointer;font-size:0.85rem;font-weight:600;margin-bottom:8px;color:#fff;text-decoration:underline dotted">${role}</div>
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;background:rgba(0,0,0,0.5);border-radius:12px;padding:2px">
            <button class="role-btn minus-btn" data-role="${role}" style="background:none;border:none;color:white;width:24px;height:24px;cursor:${isHost?'pointer':'not-allowed'};opacity:${isHost?'1':'0.4'}" ${!isHost?'disabled':''}>-</button>
            <span style="font-size:0.9rem;font-weight:bold;min-width:20px">${count}</span>
            <button class="role-btn plus-btn" data-role="${role}" style="background:none;border:none;color:white;width:24px;height:24px;cursor:${isHost?'pointer':'not-allowed'};opacity:${isHost?'1':'0.4'}" ${!isHost?'disabled':''}>+</button>
        </div>
    </div>`;
}

export function renderColorDots(colors, players, myId) {
    return colors.map(color => {
        const occ = players.find(p => p.color === color);
        const isMe = occ && occ.id === myId;
        let extra = '';
        let txt = '';
        if (occ) {
            txt = occ.name.charAt(0);
            extra = isMe ? 'border-color:#fff;transform:scale(1.1);' : 'opacity:0.4;';
        }
        return `<div class="color-dot-sel" data-color="${color}" style="background:${color};width:30px;height:30px;border-radius:50%;cursor:${occ&&!isMe?'not-allowed':'pointer'};border:2px solid transparent;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;${extra}">${txt}</div>`;
    }).join('');
}

export function renderCardChoice(cards) {
    return cards.map((card, i) => `
        <div class="card-item select-role-btn" data-index="${i}" style="border:1px solid var(--glass-border);padding:25px;border-radius:16px;background:rgba(255,255,255,0.05);text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:10px;min-width:160px">
            <h3 style="color:${roleColor(card.side)};font-size:1.8rem;margin:0;pointer-events:none">${card.role}</h3>
            <div style="flex:1"></div>
            <button class="role-desc-btn btn-ghost" data-role="${card.role}" style="font-size:0.75rem;padding:4px 8px;color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);border-radius:20px">詳細を確認</button>
            <p style="font-size:0.85rem;color:var(--primary);font-weight:bold;margin:0;pointer-events:none">クリックして選ぶ</p>
        </div>
    `).join('');
}

export function renderTargetButtons(players, myId, btnClass, labelFn) {
    return players.filter(p => p.id !== myId).map(p =>
        `<button class="btn-secondary ${btnClass}" data-target="${p.id}">${labelFn ? labelFn(p) : p.name}</button>`
    ).join('');
}

export function renderResultPlayers(players, roomId, winCounts = {}) {
    return players.map(p => {
        const winCount = winCounts[p.name] || 0;
        const winLabel = p.isWinner ?
            `<span style="margin-left:12px;padding:4px 10px;background:linear-gradient(45deg,#fbbf24,#f59e0b);color:#000;font-weight:900;font-size:0.9rem;border-radius:6px;box-shadow:0 0 10px rgba(245,158,11,0.6);border:1px solid #fff">🏆 勝利</span>` :
            `<span style="margin-left:12px;padding:3px 8px;background:rgba(255,255,255,0.1);color:#9ca3af;font-weight:bold;font-size:0.8rem;border-radius:6px;border:1px solid rgba(255,255,255,0.2)">💀 敗北</span>`;
        const crown = winCount > 0 ? `<span style="color:#fbbf24;font-weight:900;margin-left:5px;text-shadow:0 0 5px rgba(251,191,36,0.8);font-size:1.1rem" title="累計勝利数">👑 ${winCount}</span>` : '';
        const statusText = p.isDead ? (p.draggedDown ? '死亡 (道連れ)' : '死亡 (処刑)') : '生存';
        const rc = p.chosenRole ? roleColor(p.chosenRole.side) : '#3b82f6';
        return `<div class="${p.isDead?'dead-player':''}" style="background:rgba(0,0,0,0.3);padding:15px;border-radius:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;border:1px solid var(--glass-border);${!p.isDead?'box-shadow:0 2px 10px rgba(0,0,0,0.2);':''}">
            <div style="display:flex;align-items:center">
                <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${p.color};margin-right:8px"></span>
                <strong style="font-size:1.1rem">${p.name}</strong> ${crown}
                <span style="font-size:0.8rem;color:${p.isDead?'var(--accent)':'var(--text-muted)'};margin-left:10px">${statusText}</span>
                ${winLabel}
            </div>
            <div style="text-align:right">
                <span style="display:block;font-weight:bold;color:${rc}">${p.chosenRole?p.chosenRole.role:'?'}</span>
                <span style="font-size:0.8rem;color:var(--text-muted)">残り札: ${p.remainingCard?p.remainingCard.role:'なし'}</span>
            </div>
        </div>`;
    }).join('');
}
