/**
 * UI制御クラス
 */
export class UIManager {
    constructor(state) {
        this.state = state;
        this.screens = {
            TITLE: document.getElementById('title-screen'),
            LOBBY: document.getElementById('lobby-screen'),
            GAME: document.getElementById('game-screen')
        };
    }

    init() {
        // イベントリスナーのセットアップ
        const enterRoomBtn = document.getElementById('enter-room-btn');
        if (enterRoomBtn) {
            enterRoomBtn.addEventListener('click', () => {
                const name = document.getElementById('entry-name').value.trim();
                const room = document.getElementById('entry-room').value.trim();
                
                if (!name) {
                    alert("お名前を入力してください。");
                    return;
                }
                if (!/^\d{4}$/.test(room)) {
                    alert("部屋番号は4桁の数字を入力してください。");
                    return;
                }
                
                // 初回入室者をここで追加 (自動的にホストになり、ランダムカラーが割り当てられる)
                this.state.players = []; // リセット（完全なローカルテスト用簡易実装のため）
                this.state.localPlayerId = null;
                this.state.addPlayer(name);
                
                this.state.roomId = room;
                this.state.setPhase('LOBBY');
            });
        }

        const resetRoomBtn = document.getElementById('reset-room-btn');
        if (resetRoomBtn) {
            resetRoomBtn.addEventListener('click', () => {
                const room = document.getElementById('entry-room').value.trim();
                if (!/^\d{4}$/.test(room)) {
                    alert("リセットしたい部屋番号を4桁で入力してください。");
                    return;
                }
                
                // 本来はサーバー側のルーム状態をリセットする通信を行う
                // ここではモックとしてアラートのみ出す
                localStorage.removeItem(`werewolf_wins_${room}`);
                alert(`部屋番号「${room}」のルーム情報（勝利数など）をリセットしました！\n（※通信実装前のモック表示です）`);
            });
        }

        document.getElementById('back-to-title').addEventListener('click', () => {
            this.state.setPhase('TITLE');
        });

        document.addEventListener('phaseChanged', (e) => {
            this.showScreen(e.detail);
            if (e.detail === 'CARD_DIST') {
                this.renderCardDistribution();
            } else if (e.detail === 'PREP') {
                this.renderPrepPhase();
            } else if (e.detail === 'MORNING' || e.detail === 'NIGHT') {
                this.renderDiscussionPhase(e.detail);
            } else if (e.detail === 'MIDDAY') {
                this.renderMiddayPhase();
            } else if (e.detail === 'VOTE') {
                this.renderVotePhase();
            } else if (e.detail === 'RESULT') {
                this.renderResultPhase();
            }
        });

        document.addEventListener('playerTurnChanged', () => {
            if (this.state.phase === 'CARD_DIST') {
                this.renderCardDistribution();
            } else if (this.state.phase === 'PREP') {
                this.renderPrepPhase();
            }
        });

        document.addEventListener('middayTurnChanged', () => {
            if (this.state.phase === 'MIDDAY') {
                this.renderMiddayPhase();
            }
        });

        document.addEventListener('voteTurnChanged', () => {
            if (this.state.phase === 'VOTE') {
                this.renderVotePhase();
            }
        });

        const addNpcBtn = document.getElementById('add-npc-btn');
        if (addNpcBtn) {
            addNpcBtn.addEventListener('click', () => {
                if (this.state.players.length >= this.state.settings.maxPlayers) {
                    alert("最大人数に達しています。");
                    return;
                }
                
                const npcCount = this.state.players.filter(p => p.name.startsWith('NPC')).length;
                const name = `NPC${npcCount + 1}`;
                
                this.state.addPlayer(name);
                this.updateLobbyUI();
            });
        }

        const readyBtn = document.getElementById('ready-btn');
        if (readyBtn) {
            readyBtn.addEventListener('click', () => {
                if (this.state.players.length < 2) {
                    alert("ゲームを開始するには2人以上のプレイヤーが必要です。");
                    return;
                }
                const required = this.state.players.length * 2;
                let total = 0;
                Object.values(this.state.settings.roleCounts).forEach(c => total += c);
                if (total !== required) {
                    alert(`カード枚数が一致しません。（合計: ${total}枚 / 必要: ${required}枚）`);
                    return;
                }
                
                this.state.setPhase('CARD_DIST');
            });
        }

        const timeSelect = document.getElementById('setting-discussion-time');
        const timeDisplay = document.getElementById('time-display-val');
        if (timeSelect) {
            timeSelect.addEventListener('input', (e) => {
                const minutes = parseInt(e.target.value);
                if(timeDisplay) timeDisplay.textContent = `${minutes}分`;
                this.state.settings.discussionTime = minutes * 60;
            });
        }
    }

    showScreen(phase) {
        // 全画面非表示
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });

        // 対象フェーズの画面を表示
        if (phase === 'TITLE') {
            this.screens.TITLE.classList.add('active');
        } else if (phase === 'LOBBY') {
            this.screens.LOBBY.classList.add('active');
            this.updateLobbyUI();
        } else {
            this.screens.GAME.classList.add('active');
        }
    }

    updateLobbyUI() {
        this.updatePlayerList();
        this.renderColorPicker();
        this.renderRolesGrid();

        const timeSelect = document.getElementById('setting-discussion-time');
        const timeDisplay = document.getElementById('time-display-val');
        if (timeSelect) {
            // ホスト以外は時間を変更できないようにする
            timeSelect.disabled = !(this.state.localPlayer && this.state.localPlayer.isHost);
            // 現在の値を表示に反映
            const minutes = this.state.settings.discussionTime / 60;
            timeSelect.value = minutes;
            if(timeDisplay) timeDisplay.textContent = `${minutes}分`;
        }
    }

    renderRolesGrid() {
        const grid = document.getElementById('roles-grid');
        const summary = document.getElementById('role-count-summary');
        if (!grid || !summary) return;

        const isHost = this.state.localPlayer && this.state.localPlayer.isHost;
        let totalCards = 0;
        grid.innerHTML = '';
        
        Object.keys(this.state.roleDefs).forEach(role => {
            const count = this.state.settings.roleCounts[role] || 0;
            totalCards += count;
            
            const card = document.createElement('div');
            card.style = `
                background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); 
                border-radius: 8px; padding: 10px; text-align: center;
                display: flex; flex-direction: column; align-items: center;
            `;
            
            // アイコン代わりの仮デザイン
            const iconColor = this.state.roleDefs[role].side === 'Red' ? '#f43f5e' : (this.state.roleDefs[role].side === 'Gray' ? '#9ca3af' : '#3b82f6');
            const iconHtml = `<div style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid ${iconColor}; margin-bottom: 8px; display:flex; justify-content:center; align-items:center; box-shadow: 0 0 10px ${iconColor}40;">
                <span style="font-size: 1rem; color: #fff;">${role.substring(0,1)}</span>
            </div>`;
            
            card.innerHTML = `
                ${iconHtml}
                <div class="role-name-btn" style="cursor: pointer; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: #fff; text-decoration: underline dotted;">${role}</div>
                <div style="display:flex; justify-content: space-between; width: 100%; align-items: center; background: rgba(0,0,0,0.5); border-radius: 12px; padding: 2px;">
                    <button class="role-btn minus-btn" data-role="${role}" style="background:none; border:none; color:white; width: 24px; height: 24px; cursor: ${isHost ? 'pointer' : 'not-allowed'}; opacity: ${isHost ? '1' : '0.4'}" ${!isHost ? 'disabled' : ''}>-</button>
                    <span style="font-size: 0.9rem; font-weight: bold; min-width: 20px;">${count}</span>
                    <button class="role-btn plus-btn" data-role="${role}" style="background:none; border:none; color:white; width: 24px; height: 24px; cursor: ${isHost ? 'pointer' : 'not-allowed'}; opacity: ${isHost ? '1' : '0.4'}" ${!isHost ? 'disabled' : ''}>+</button>
                </div>
            `;
            
            // 役職詳細・確認用リスナー
            card.querySelector('.role-name-btn').addEventListener('click', () => {
                const def = this.state.roleDefs[role];
                alert(`【${role}】 (${def.faction})\n\n${def.desc}`);
            });
            
            grid.appendChild(card);
        });

        if (isHost) {
            grid.querySelectorAll('.plus-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const r = e.target.getAttribute('data-role');
                    this.state.settings.roleCounts[r] = (this.state.settings.roleCounts[r] || 0) + 1;
                    this.updateLobbyUI();
                });
            });
            grid.querySelectorAll('.minus-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const r = e.target.getAttribute('data-role');
                    if (this.state.settings.roleCounts[r] > 0) {
                        this.state.settings.roleCounts[r]--;
                        this.updateLobbyUI();
                    }
                });
            });
        }

        const requiredCards = this.state.players.length * 2;
        summary.textContent = `(合計: ${totalCards}枚 / 必要: ${requiredCards}枚)`;
        
        // 必須カード数とプレイヤー数による準備完了ボタンの制御
        const readyBtn = document.getElementById('ready-btn');
        if (readyBtn) {
            if (this.state.players.length >= 2 && totalCards === requiredCards) {
                readyBtn.disabled = false;
                readyBtn.style.opacity = '1';
                readyBtn.style.cursor = 'pointer';
            } else {
                readyBtn.disabled = true;
                readyBtn.style.opacity = '0.5';
                readyBtn.style.cursor = 'not-allowed';
            }
        }
    }

    renderColorPicker() {
        const picker = document.getElementById('color-picker');
        if (!picker) return;
        picker.innerHTML = ''; // クリア

        this.state.availableColors.forEach(color => {
            const dot = document.createElement('div');
            const occupant = this.state.players.find(p => p.color === color);
            const isMe = occupant && this.state.localPlayer && occupant.id === this.state.localPlayer.id;
            
            dot.className = 'color-dot-selection';
            dot.style.backgroundColor = color;
            dot.style.width = '30px';
            dot.style.height = '30px';
            dot.style.borderRadius = '50%';
            dot.style.cursor = occupant && !isMe ? 'not-allowed' : 'pointer';
            dot.style.border = '2px solid transparent';
            
            dot.style.display = 'flex';
            dot.style.alignItems = 'center';
            dot.style.justifyContent = 'center';
            dot.style.color = '#fff';
            dot.style.fontWeight = 'bold';
            dot.style.fontSize = '14px';

            if (occupant) {
                dot.textContent = occupant.name.charAt(0);
                if (!isMe) {
                    dot.style.opacity = '0.4';
                } else {
                    dot.style.borderColor = '#fff';
                    dot.style.transform = 'scale(1.1)';
                }
            }
            
            dot.addEventListener('click', () => {
                if (occupant && !isMe) return; // 他人が使用済みの色は選べない
                if (!this.state.localPlayer) return;
                
                this.state.localPlayer.color = color;
                this.updateLobbyUI();
            });
            picker.appendChild(dot);
        });
    }

    updatePlayerList() {
        const list = document.getElementById('player-list');
        const count = document.getElementById('player-count');
        if (!list || !count) return;

        list.innerHTML = '';
        count.textContent = this.state.players.length;

        const roomKey = `werewolf_wins_${this.state.roomId || 'local'}`;
        let winStats = JSON.parse(localStorage.getItem(roomKey) || '{}');

        this.state.players.forEach(p => {
            const winCount = winStats[p.name] || 0;
            const crownHtml = winCount > 0 ? `<span style="color: #fbbf24; font-weight: bold; margin-left: auto; text-shadow: 0 0 5px rgba(251,191,36,0.5); font-size: 1rem;" title="累計勝利数">👑 ${winCount}</span>` : '';
            
            const li = document.createElement('li');
            li.style = `
                background: linear-gradient(90deg, ${p.color}30 0%, rgba(0,0,0,0.3) 100%); 
                border-left: 4px solid ${p.color};
                padding: 12px 15px; 
                border-radius: 6px; 
                display: flex; 
                align-items: center; 
                gap: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            `;
            li.innerHTML = `
                <span style="font-weight: bold; font-size: 1.1rem; text-shadow: 1px 1px 3px rgba(0,0,0,0.8);">${p.name} <span style="font-size:0.8rem; color:rgba(255,255,255,0.6); margin-left: 5px; font-weight: normal;">${p.isHost ? '(Host)' : ''}</span></span>
                ${crownHtml}
            `;
            list.appendChild(li);
        });
    }

    /* ゲーム画面のレンダリング群 */
    renderCardDistribution() {
        const overlay = document.getElementById('game-ui-overlay');
        const currentPlayer = this.state.players[this.state.currentPlayerIndex];
        
        overlay.innerHTML = `
            <div class="turn-overlay glass">
                <h2>${currentPlayer.name} さんの番です</h2>
                <p>他のプレイヤーに見られないようにカードを確認してください。</p>
                <div class="cards-container">
                    <!-- Cards will be generated here -->
                </div>
                <button id="reveal-cards-btn" class="btn-primary large" style="margin-top:20px;">カードを確認する</button>
            </div>
        `;

        document.getElementById('reveal-cards-btn').addEventListener('click', () => {
             this.showCardsSelection(currentPlayer);
        });
    }

    showCardsSelection(player) {
        const overlay = document.getElementById('game-ui-overlay');
        overlay.innerHTML = `
            <div class="turn-overlay glass">
                <h2>${player.name} さんのカード</h2>
                <p>自分の役職（ドッチか）を選んでください。選ばなかった方は残りカードとなります。</p>
                <div class="cards-container" style="display:flex; gap:20px; margin-top:30px;">
                    ${player.dealtCards.map((card, i) => `
                        <div class="card-item" style="border: 1px solid var(--glass-border); padding: 20px; border-radius: 12px; background: rgba(0,0,0,0.3); text-align:center;">
                            <h3 class="role-desc-btn" data-role="${card.role}" style="color:${card.side === 'Red' ? '#f43f5e' : (card.side === 'Gray' ? '#9ca3af' : '#3b82f6')}; cursor:pointer; text-decoration: underline dotted;">${card.role}</h3>
                            <p class="select-role-btn" data-index="${i}" style="font-size:0.8rem; color:#94a3b8; margin-top:10px; cursor:pointer;">クリックして選ぶ</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const descBtns = overlay.querySelectorAll('.role-desc-btn');
        descBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const role = e.currentTarget.getAttribute('data-role');
                const def = this.state.roleDefs[role];
                if (def) {
                    alert(`【${role}】 (${def.faction})\n\n${def.desc}`);
                }
            });
        });

        const selectBtns = overlay.querySelectorAll('.select-role-btn');
        selectBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                const chosen = player.dealtCards[idx];
                const remain = player.dealtCards[1 - idx];
                
                player.chosenRole = chosen;
                player.remainingCard = remain;

                overlay.innerHTML = `
                    <div class="turn-overlay glass" style="text-align:center;">
                        <h2>役職は「${chosen.role}」に決定しました</h2>
                        <button id="next-turn-btn" class="btn-primary" style="margin-top:20px;">次へ</button>
                    </div>
                `;
                document.getElementById('next-turn-btn').addEventListener('click', () => {
                    this.state.nextPlayerTurn();
                });
            });
        });
    }

    renderPrepPhase() {
        const overlay = document.getElementById('game-ui-overlay');
        const currentPlayer = this.state.players[this.state.currentPlayerIndex];
        
        overlay.innerHTML = `
            <div class="turn-overlay glass">
                <h2>${currentPlayer.name} さんの番です</h2>
                <p>夜の行動（準備フェーズ）を行います。他の人に見られないようにしてください。</p>
                <button id="reveal-prep-btn" class="btn-primary large" style="margin-top:20px;">確認する</button>
            </div>
        `;

        document.getElementById('reveal-prep-btn').addEventListener('click', () => {
             this.showPrepAction(currentPlayer);
        });
    }

    showPrepAction(player) {
        const overlay = document.getElementById('game-ui-overlay');
        const roleName = player.chosenRole ? player.chosenRole.role : '市民';
        let actionHtml = '';

        if (roleName === '人狼' || roleName === '大狼') {
            const wolves = this.state.getPlayersWithRole('人狼').concat(this.state.getPlayersWithRole('大狼'));
            const otherWolves = wolves.filter(w => w.id !== player.id);
            if (otherWolves.length > 0) {
                actionHtml = `<p>仲間の人狼は: <strong>${otherWolves.map(w => w.name).join(', ')}</strong> です</p>`;
            } else {
                actionHtml = `<p>仲間の人狼はいません。（あなたが単独です）</p>`;
            }
        } else if (roleName === '少年') {
            const boys = this.state.getPlayersWithRole('少年').filter(b => b.id !== player.id);
            if (boys.length > 0) {
                actionHtml = `<p>仲間の少年は: <strong>${boys.map(b => b.name).join(', ')}</strong> です</p>`;
            } else {
                actionHtml = `<p>仲間の少年はいません。</p>`;
            }
        } else if (roleName === '占い師') {
            // 誰かの役職カードか、残りカードから2枚
            actionHtml = `
                <p>【占い師の能力】占う対象を選んでください。（実装中: 以後対象選択UI表示）</p>
                <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                    ${this.state.players.filter(p => p.id !== player.id).map(p => `
                        <button class="btn-secondary prep-seer-btn" data-target="${p.id}">${p.name}の役職を占う</button>
                    `).join('')}
                    <button class="btn-secondary prep-seer-remain-btn">残りカードから2枚占う</button>
                </div>
                <div id="seer-result" style="margin-top:20px; font-weight:bold; color:var(--primary);"></div>
            `;
        } else {
            actionHtml = `<p>あなたの役職（${roleName}）は夜のアクションがありません。</p>`;
        }

        overlay.innerHTML = `
            <div class="turn-overlay glass">
                <h2>あなたの役職: ${roleName}</h2>
                <div class="action-container" style="margin:20px 0;">
                    ${actionHtml}
                </div>
                <button id="end-prep-btn" class="btn-primary" style="margin-top:20px;">完了して次へ</button>
            </div>
        `;

        if (roleName === '占い師') {
            const resultDiv = document.getElementById('seer-result');
            let used = false;
            overlay.querySelectorAll('.prep-seer-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if(used) return;
                    const targetId = e.currentTarget.getAttribute('data-target');
                    const target = this.state.players.find(p => p.id === targetId);
                    // 大狼は市民と判定される
                    let displayRole = target.chosenRole.role;
                    if (displayRole === '大狼') displayRole = '市民';
                    resultDiv.innerHTML = `${target.name}の役職は「${displayRole}」です。`;
                    used = true;
                });
            });
            const remainBtn = overlay.querySelector('.prep-seer-remain-btn');
            if (remainBtn) {
                remainBtn.addEventListener('click', () => {
                    if(used) return;
                    // 他全員が捨てた「残りカード」からランダムに2枚を取得する
                    const allRemain = this.state.players.map(p => p.remainingCard).filter(c=>c);
                    const shuffled = allRemain.sort(() => 0.5 - Math.random());
                    const picked = shuffled.slice(0, 2);
                    if (picked.length === 2) {
                        resultDiv.innerHTML = `残りカードは「${picked[0].role}」と「${picked[1].role}」でした。`;
                    } else if (picked.length === 1) {
                        resultDiv.innerHTML = `残りカードは「${picked[0].role}」でした。`;
                    } else {
                         resultDiv.innerHTML = `占える残りカードがありません。`;
                    }
                    used = true;
                });
            }
        }

        document.getElementById('end-prep-btn').addEventListener('click', () => {
            this.state.nextPlayerTurn();
        });
    }

    renderDiscussionPhase(phaseName) {
        const overlay = document.getElementById('game-ui-overlay');
        const isMorning = phaseName === 'MORNING';
        const title = isMorning ? "朝の議論フェーズ" : "夜の議論フェーズ";
        const nextPhase = isMorning ? "MIDDAY" : "VOTE";

        // メモ用の役職ドロップダウン選択肢（設定枚数が1以上の役職のみ抽出）
        const activeRoles = Object.keys(this.state.settings.roleCounts).filter(r => this.state.settings.roleCounts[r] > 0);
        const roleOptionsHtml = ['不明', ...activeRoles].map(r => `<option value="${r}">${r}</option>`).join('');

        // 参加者リストの生成
        const playerListHtml = this.state.players.map(p => `
            <div class="discussion-player-item" style="display:flex; align-items:center; gap:10px; margin-bottom:10px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="flex:1; background-color: ${p.color}; color: #fff; padding: 10px 15px; border-radius: 6px; font-weight: bold; text-shadow: 0 1px 3px rgba(0,0,0,0.5); box-shadow: 0 0 10px ${p.color}40;">
                    ${p.name}
                </div>
                <div style="display:flex; gap: 10px;">
                    <div style="text-align: center;">
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom: 2px;">役職カード</div>
                        <select class="memo-select" style="padding: 6px; background: rgba(0,0,0,0.5); color: white; border: 1px solid var(--glass-border); border-radius: 4px; cursor: pointer; max-width: 100px;">
                            ${roleOptionsHtml}
                        </select>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom: 2px;">残りカード</div>
                        <select class="memo-select" style="padding: 6px; background: rgba(0,0,0,0.5); color: white; border: 1px solid var(--glass-border); border-radius: 4px; cursor: pointer; max-width: 100px;">
                            ${roleOptionsHtml}
                        </select>
                    </div>
                </div>
            </div>
        `).join('');

        // 役職一覧（まとめ）の生成
        const rolesSummaryHtml = activeRoles.map(r => `
            <div style="background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--glass-border); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: bold;">${r}</span> 
                <span style="background: var(--primary); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${this.state.settings.roleCounts[r]}枚</span>
            </div>
        `).join('');

        // オーバーレイの構造構築
        overlay.innerHTML = `
            <div class="turn-overlay glass" style="max-width: 700px; width: 95%; display: flex; flex-direction: column; max-height: 90vh; padding: 30px;">
                <!-- ヘッダー＆タイマーエリア -->
                <div style="text-align:center; padding-bottom: 20px; border-bottom: 1px solid var(--glass-border); margin-bottom: 20px; flex-shrink: 0;">
                    <h2 style="color:var(--primary); font-size: 2rem; margin-bottom: 15px;">${title}</h2>
                    <div id="countdown-timer" style="font-size: 4rem; font-weight: bold; font-family: monospace; letter-spacing: 5px; margin: 15px 0;">
                        --:--
                    </div>
                    <button id="skip-timer-btn" class="btn-secondary">議論を強制終了</button>
                </div>

                <!-- スクロール可能なコンテンツエリア -->
                <div style="overflow-y: auto; flex: 1; padding-right: 10px;">
                    <h3 style="margin-bottom: 15px; font-size: 1.1rem; border-bottom: 1px dashed var(--glass-border); padding-bottom: 5px; color: var(--text-primary);">参加者リスト (役職推測メモ)</h3>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">※予想した役職をドロップダウンから選んでメモできます（自分用表示）</p>
                    <div style="margin-bottom: 30px;">
                        ${playerListHtml}
                    </div>

                    <h3 style="margin-bottom: 15px; font-size: 1.1rem; border-bottom: 1px dashed var(--glass-border); padding-bottom: 5px; color: var(--text-primary);">設定されている役職一覧</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${rolesSummaryHtml}
                    </div>
                </div>
            </div>
        `;

        this.startTimer(this.state.settings.discussionTime, nextPhase);

        document.getElementById('skip-timer-btn').addEventListener('click', () => {
            if (this.currentTimer) clearInterval(this.currentTimer);
            this.state.setPhase(nextPhase);
        });
    }

    startTimer(durationSeconds, nextPhase) {
        if (this.currentTimer) {
            clearInterval(this.currentTimer);
        }

        let timeRemaining = durationSeconds;
        const timerDisplay = document.getElementById('countdown-timer');

        const updateDisplay = () => {
            const m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
            const s = (timeRemaining % 60).toString().padStart(2, '0');
            if (timerDisplay) {
                timerDisplay.textContent = `${m}:${s}`;
                if (timeRemaining <= 10) {
                    timerDisplay.style.color = 'var(--accent)'; // 赤色にする
                }
            }
        };

        updateDisplay();

        this.currentTimer = setInterval(() => {
            timeRemaining--;
            updateDisplay();

            if (timeRemaining <= 0) {
                clearInterval(this.currentTimer);
                this.state.setPhase(nextPhase);
            }
        }, 1000);
    }

    renderMiddayPhase() {
        const currentRole = this.state.middayRoles[this.state.currentMiddayRoleIndex];
        const overlay = document.getElementById('game-ui-overlay');
        const localPlayer = this.state.localPlayer;
        
        let isMyRole = localPlayer && localPlayer.chosenRole && localPlayer.chosenRole.role === currentRole;

        if (isMyRole) {
            overlay.innerHTML = `
                <div class="turn-overlay glass" style="text-align:center;">
                    <h2 style="color:var(--primary); font-size: 2rem;">昼の行動: ${currentRole}</h2>
                    <p style="margin:20px 0;">あなたが行動する番です。</p>
                    <button id="midday-act-btn" class="btn-primary large">行動する</button>
                </div>
            `;
            document.getElementById('midday-act-btn').addEventListener('click', () => {
                this.showMiddayAction(currentRole, localPlayer);
            });
        } else {
            overlay.innerHTML = `
                <div class="turn-overlay glass" style="text-align:center;">
                    <h2 style="color:var(--primary); font-size: 2rem;">昼の行動: ${currentRole}</h2>
                    <p style="margin:20px 0;">あなたの出番ではありません（あなたは ${currentRole} ではありません）。</p>
                    <button id="midday-skip-btn" class="btn-secondary large">スキップ</button>
                </div>
            `;
            document.getElementById('midday-skip-btn').addEventListener('click', () => {
                this.state.nextMiddayTurn();
            });
        }
    }

    showMiddayAction(roleName, player) {
        const overlay = document.getElementById('game-ui-overlay');
        let actionHtml = '';

        if (roleName === '情報屋') {
            actionHtml = `
                <p>【情報屋】誰か一人の残りカードをすべて見ることができます。</p>
                <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                    ${this.state.players.filter(p => p.id !== player.id).map(p => `
                        <button class="btn-secondary midday-action-btn" data-target="${p.id}">${p.name}の残りカードを見る</button>
                    `).join('')}
                </div>
                <div id="midday-result" style="margin-top:20px; font-weight:bold; color:var(--primary);"></div>
            `;
        } else if (roleName === '警察') {
            actionHtml = `
                <p>【警察】誰か一人の残りカードの1枚を見ることができます。</p>
                <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                    ${this.state.players.filter(p => p.id !== player.id).map(p => `
                        <button class="btn-secondary midday-action-btn" data-target="${p.id}">${p.name}の残りカードを見る</button>
                    `).join('')}
                </div>
                <div id="midday-result" style="margin-top:20px; font-weight:bold; color:var(--primary);"></div>
            `;
        } else if (roleName === '怪盗') {
            actionHtml = `
                <p>【怪盗】自分の役職と誰かの役職カードを交換し、入れ替えたカードを確認します。</p>
                <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                    ${this.state.players.filter(p => p.id !== player.id).map(p => `
                        <button class="btn-secondary midday-action-btn" data-target="${p.id}">${p.name}の役職と入れ替える</button>
                    `).join('')}
                </div>
                <div id="midday-result" style="margin-top:20px; font-weight:bold; color:var(--primary);"></div>
            `;
        } else if (roleName === 'DJ') {
            actionHtml = `
                <p>【DJ】誰かの残りカードと、別の誰かの残りカードを入れ替えます。</p>
                <p style="font-size: 0.8rem; color: var(--text-muted);">(ローカル版簡易UI: 対象を2名選択します)</p>
                <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                    ${this.state.players.filter(p => p.id !== player.id).map(p => `
                        <button class="btn-secondary midday-action-btn-multi" data-target="${p.id}">${p.name}</button>
                    `).join('')}
                </div>
                <div id="midday-result" style="margin-top:20px; font-weight:bold; color:var(--primary);"></div>
            `;
        }

        overlay.innerHTML = `
            <div class="turn-overlay glass">
                <h2>あなたの役職: ${roleName}</h2>
                <div class="action-container" style="margin:20px 0;">
                    ${actionHtml}
                </div>
                <button id="end-midday-btn" class="btn-primary" style="margin-top:20px;">完了して次へ</button>
            </div>
        `;

        const resultDiv = document.getElementById('midday-result');
        let used = false;
        let selectedForDj = [];

        if (roleName === '情報屋') {
            overlay.querySelectorAll('.midday-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if(used) return;
                    const targetId = e.currentTarget.getAttribute('data-target');
                    const target = this.state.players.find(p => p.id === targetId);
                    resultDiv.innerHTML = `${target.name}の残りカードは「${target.remainingCard.role}」です。`;
                    used = true;
                });
            });
        } else if (roleName === '警察') {
            overlay.querySelectorAll('.midday-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if(used) return;
                    const targetId = e.currentTarget.getAttribute('data-target');
                    const target = this.state.players.find(p => p.id === targetId);
                    resultDiv.innerHTML = `${target.name}の残りカードは「${target.remainingCard.role}」です。`;
                    used = true;
                });
            });
        } else if (roleName === '怪盗') {
            overlay.querySelectorAll('.midday-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if(used) return;
                    const targetId = e.currentTarget.getAttribute('data-target');
                    const target = this.state.players.find(p => p.id === targetId);
                    
                    // カードの入れ替え
                    const temp = player.chosenRole;
                    player.chosenRole = target.chosenRole;
                    target.chosenRole = temp;

                    resultDiv.innerHTML = `${target.name}の役職と入れ替えました。新しいあなたの役職は「${player.chosenRole.role}」です。`;
                    used = true;
                });
            });
        } else if (roleName === 'DJ') {
            overlay.querySelectorAll('.midday-action-btn-multi').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if(used) return;
                    const targetId = e.currentTarget.getAttribute('data-target');
                    if(selectedForDj.includes(targetId)) return;
                    
                    selectedForDj.push(targetId);
                    e.currentTarget.style.backgroundColor = 'var(--primary)';
                    
                    if(selectedForDj.length === 2) {
                        const target1 = this.state.players.find(p => p.id === selectedForDj[0]);
                        const target2 = this.state.players.find(p => p.id === selectedForDj[1]);
                        
                        // 残りカードの入れ替え
                        const temp = target1.remainingCard;
                        target1.remainingCard = target2.remainingCard;
                        target2.remainingCard = temp;

                        resultDiv.innerHTML = `${target1.name}と${target2.name}の残りカードを入れ替えました。`;
                        used = true;
                    }
                });
            });
        }

        document.getElementById('end-midday-btn').addEventListener('click', () => {
            this.state.nextMiddayTurn();
        });
    }

    renderVotePhase() {
        const overlay = document.getElementById('game-ui-overlay');
        const currentPlayer = this.state.players[this.state.currentPlayerIndex];

        overlay.innerHTML = `
            <div class="turn-overlay glass" style="text-align:center;">
                <h2 style="color:var(--accent); font-size: 2rem;">投票フェーズ</h2>
                <h3>${currentPlayer.name} さんの投票</h3>
                <p style="margin:20px 0;">怪しいと思うプレイヤーに投票してください。</p>
                <div class="vote-options" style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom: 20px;">
                    <button class="btn-secondary vote-btn" data-target="PEACE" style="grid-column: span 2; border-color: var(--primary);">平和村へ投票</button>
                    ${this.state.players.filter(p => p.id !== currentPlayer.id).map(p => `
                        <button class="btn-secondary vote-btn" data-target="${p.id}">${p.name}</button>
                    `).join('')}
                </div>
            </div>
        `;

        overlay.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.getAttribute('data-target');
                currentPlayer.votedTo = targetId;
                this.state.nextVoteTurn();
            });
        });
    }

    renderResultPhase() {
        const overlay = document.getElementById('game-ui-overlay');
        const rData = this.state.resultData;
        const roomKey = `werewolf_wins_${this.state.roomId || 'local'}`;
        let winStats = JSON.parse(localStorage.getItem(roomKey) || '{}');

        // 勝敗計算と勝利数の更新処理（1回だけ実行）
        if (!this.state.winCountUpdated) {
            this.state.players.forEach(p => {
                const def = this.state.roleDefs[p.chosenRole.role];
                let isWinner = false;

                if (rData.winnerTeam === 'おばけ（単独勝利）') {
                    if (p.chosenRole.role === 'おばけ' && p.isDead && !p.draggedDown) isWinner = true;
                } else if (rData.winnerTeam === '市民陣営') {
                    if (def && def.faction === '人間チーム') isWinner = true;
                } else if (rData.winnerTeam === '人狼陣営') {
                    if (def && def.faction === '人狼チーム') isWinner = true;
                }
                
                // 逃亡者は追加勝利条件
                if (p.chosenRole.role === '逃亡者' && !p.isDead) {
                    isWinner = true;
                }

                p.isWinner = isWinner;
                if (isWinner) {
                    winStats[p.name] = (winStats[p.name] || 0) + 1;
                }
            });
            localStorage.setItem(roomKey, JSON.stringify(winStats));
            this.state.winCountUpdated = true;
        }

        let resultMsg = `<h2 class="winner-text" style="font-size: 2.5rem; margin-bottom: 20px; text-shadow: 0 4px 10px rgba(245, 158, 11, 0.5);">勝敗: ${rData.winnerTeam} の勝利！</h2>`;

        if (rData.isPeace) {
            resultMsg += `<p style="margin-bottom: 20px;">全員が平和村へ投票しました。</p>`;
        } else {
            const exNames = this.state.executionResult.executedPlayers.map(id => {
                const p = this.state.players.find(x => x.id === id);
                return p ? p.name : '不明';
            }).join(' と ');
            resultMsg += `<p style="margin-bottom: 20px; font-size: 1.1rem;">最多票を集め、処刑されたのは: <strong>${exNames}</strong> です。</p>`;
        }

        const playersList = this.state.players.map(p => {
            const winCount = winStats[p.name] || 0;
            
            const winLabel = p.isWinner ? 
                `<span style="margin-left:12px; padding: 4px 10px; background: linear-gradient(45deg, #fbbf24, #f59e0b); color: #000; font-weight: 900; font-size: 0.9rem; border-radius: 6px; box-shadow: 0 0 10px rgba(245, 158, 11, 0.6); border: 1px solid #fff;">🏆 勝利</span>` : 
                `<span style="margin-left:12px; padding: 3px 8px; background: rgba(255,255,255,0.1); color: #9ca3af; font-weight: bold; font-size: 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2);">💀 敗北</span>`;

            const nameHtml = `<strong style="font-size: 1.1rem;">${p.name}</strong>`;
            const crownHtml = p.isWinner ? 
                `<span style="color: #fbbf24; font-weight: 900; margin-left: 5px; text-shadow: 0 0 5px rgba(251,191,36,0.8); font-size: 1.1rem;" title="累計勝利数">👑 ${winCount}</span>` : '';

            return `
            <div class="${p.isDead ? 'dead-player' : ''}" style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--glass-border); transition: transform 0.3s; transform: translateY(0); ${!p.isDead ? 'box-shadow: 0 2px 10px rgba(0,0,0,0.2);' : ''}">
                <div style="display:flex; align-items:center;">
                    <span style="display:inline-block; width: 12px; height: 12px; border-radius:50%; background-color:${p.color}; margin-right: 8px;"></span>
                    ${nameHtml} ${crownHtml}
                    <span style="font-size: 0.8rem; color:${p.isDead ? 'var(--accent)' : 'var(--text-muted)'}; margin-left:10px;">${p.isDead ? (p.draggedDown ? '死亡 (道連れ)' : '死亡 (処刑)') : '生存'}</span>
                    ${winLabel}
                </div>
                <div style="text-align: right;">
                    <span style="display:block; font-weight: bold; color:${p.chosenRole.side === 'Red' ? '#f43f5e' : (p.chosenRole.side === 'Gray' ? '#9ca3af' : '#3b82f6')}">${p.chosenRole.role}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">残り札: ${p.remainingCard ? p.remainingCard.role : 'なし'}</span>
                </div>
            </div>
            `;
        }).join('');

        let buttonsHtml = '';
        if (this.state.localPlayer && this.state.localPlayer.isHost) {
            buttonsHtml = `
                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:30px;">
                    <button id="back-lobby-btn" class="btn-primary large" style="flex:1;">ロビーに戻る</button>
                    <button id="back-title-btn" class="btn-secondary large" style="flex:1;">タイトルに戻る</button>
                </div>
            `;
        } else {
            buttonsHtml = `
                <div style="margin-top:30px; padding:15px; background: rgba(0,0,0,0.4); border-radius:8px; border: 1px dashed var(--glass-border);">
                    <p style="color: var(--text-muted); margin:0;">ホストの操作を待機しています...</p>
                </div>
            `;
        }

        overlay.innerHTML = `
            <div class="turn-overlay glass" style="max-width: 600px; width: 100%; text-align:center;">
                ${resultMsg}
                <div style="text-align:left; margin-top: 30px; max-height: 40vh; overflow-y: auto;">
                    ${playersList}
                </div>
                ${buttonsHtml}
            </div>
        `;

        const backLobbyBtn = document.getElementById('back-lobby-btn');
        if (backLobbyBtn) {
            backLobbyBtn.addEventListener('click', () => {
                this.state.setPhase('LOBBY');
            });
        }

        const backTitleBtn = document.getElementById('back-title-btn');
        if (backTitleBtn) {
            backTitleBtn.addEventListener('click', () => {
                 location.reload(); // 手軽にリセットするためリロード
            });
        }
    }
}
