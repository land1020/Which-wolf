/**
 * 人狼ドッチ - リアルタイム通信サーバー
 * Node.js + Express + Socket.io
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// 静的ファイルの配信（Vercelでも動くように）
app.use(express.static(path.join(__dirname, '.')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ====================================
// ゲームデータ定義
// ====================================
const ROLE_DEFS = {
    '市民':    { side: 'Blue', faction: '人間チーム', desc: '特殊能力なし。' },
    '占い師':  { side: 'Blue', faction: '人間チーム', desc: '準備フェーズ:「誰かの役職カード」または「誰かの残りカードエリアから2枚」を確認する。' },
    '警察':    { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ:「誰かの残りカード」を1枚確認する。' },
    'DJ':      { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ:「誰かの残りカード」と「別の誰かの残りカード」を入れ替える。' },
    '人狼':    { side: 'Red',  faction: '人狼チーム', desc: '準備フェーズ: 仲間の人狼（人狼・大狼）が誰かを確認する。' },
    '裏切り者':{ side: 'Red',  faction: '人狼チーム', desc: '特殊能力なし。人狼チームが勝利すれば勝利。' },
    'おばけ':  { side: 'Gray', faction: '第3陣営',   desc: '自分が追放されたら単独勝利。' },
    '大狼':    { side: 'Red',  faction: '人狼チーム', desc: '準備フェーズ: 仲間の人狼を確認する。占い師に占われても「市民」と判定される。' },
    '少年':    { side: 'Blue', faction: '人間チーム', desc: '準備フェーズ: 仲間の「少年」が誰かを確認できる。' },
    '怪盗':    { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ:「誰かの役職カード」と「自分の役職カード」を入れ替える。' },
    '情報屋':  { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ:「誰かの残りカードエリア」のカードをすべて確認する。' },
    '逃亡者':  { side: 'Gray', faction: '第3陣営',   desc: '自分が追放されなければ勝利。' },
    '罠師':    { side: 'Blue', faction: '人間チーム', desc: '自分が追放されると、自分に投票したプレイヤーを道連れにする。' }
};

const DEFAULT_ROLE_COUNTS = {
    '市民': 2, '占い師': 1, '警察': 1, 'DJ': 1, '人狼': 2,
    '裏切り者': 0, 'おばけ': 0, '大狼': 0, '少年': 0, '怪盗': 0,
    '情報屋': 0, '逃亡者': 0, '罠師': 0
};

const AVAILABLE_COLORS = [
    '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
    '#8b4513', '#ec4899', '#14b8a6', '#eab308', '#64748b', '#a855f7'
];

// ====================================
// ルーム管理
// ====================================
const rooms = {}; // roomId => roomData

function createRoom(roomId) {
    return {
        roomId,
        phase: 'LOBBY',
        players: [],
        settings: {
            discussionTime: 180,
            maxPlayers: 8,
            roleCounts: { ...DEFAULT_ROLE_COUNTS }
        },
        cards: [],
        currentPlayerIndex: 0,
        middayRoles: [],
        currentMiddayRoleIndex: 0,
        executionResult: null,
        resultData: null,
        winCountUpdated: false
    };
}

function getRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = createRoom(roomId);
    }
    return rooms[roomId];
}

function broadcastState(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    io.to(roomId).emit('state-update', sanitizeRoomForBroadcast(room));
}

// 送信用のルームデータを整形（秘密情報の隠蔽はクライアントで行う）
function sanitizeRoomForBroadcast(room) {
    return {
        roomId: room.roomId,
        phase: room.phase,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            isHost: p.isHost,
            isDead: p.isDead || false,
            draggedDown: p.draggedDown || false,
            votedTo: p.votedTo || null,
            isWinner: p.isWinner || false,
            // カード情報（フェーズに応じてクライアント側で表示制御）
            dealtCards: p.dealtCards || null,
            chosenRole: p.chosenRole || null,
            remainingCard: p.remainingCard || null,
        })),
        settings: room.settings,
        currentPlayerIndex: room.currentPlayerIndex,
        middayRoles: room.middayRoles,
        currentMiddayRoleIndex: room.currentMiddayRoleIndex,
        executionResult: room.executionResult,
        resultData: room.resultData,
    };
}

// ====================================
// ゲームロジック（サーバー側）
// ====================================

function shuffle(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function createCard(roleName) {
    const def = ROLE_DEFS[roleName];
    return {
        id: Math.random().toString(36).substr(2, 9),
        role: roleName,
        side: def ? def.side : 'Blue'
    };
}

function setupCardDistribution(room) {
    room.currentPlayerIndex = 0;

    let rolesArray = [];
    for (const [role, count] of Object.entries(room.settings.roleCounts)) {
        for (let i = 0; i < count; i++) {
            rolesArray.push(role);
        }
    }

    let cards = shuffle(rolesArray).map(createCard);

    room.players.forEach(p => {
        p.dealtCards = [cards.pop(), cards.pop()];
        p.chosenRole = null;
        p.remainingCard = null;
        p.isDead = false;
        p.draggedDown = false;
        p.votedTo = null;
        p.isWinner = false;
    });

    room.cards = cards;
}

function setupPrepPhase(room) {
    room.currentPlayerIndex = 0;
}

function setupMiddayPhase(room) {
    room.middayRoles = ['情報屋', '警察', '怪盗', 'DJ'];
    room.currentMiddayRoleIndex = 0;
}

function setupVotePhase(room) {
    room.currentPlayerIndex = 0;
    room.players.forEach(p => p.votedTo = null);
}

function setPhase(room, newPhase) {
    console.log(`[Room ${room.roomId}] Phase: ${room.phase} → ${newPhase}`);
    room.phase = newPhase;

    if (newPhase === 'LOBBY') {
        // プレイヤー状態リセット（設定は保持）
        room.players.forEach(p => {
            p.isDead = false;
            p.draggedDown = false;
            p.votedTo = null;
            p.chosenRole = null;
            p.remainingCard = null;
            p.dealtCards = null;
            p.isWinner = false;
        });
        room.winCountUpdated = false;
        room.executionResult = null;
        room.resultData = null;
    } else if (newPhase === 'CARD_DIST') {
        setupCardDistribution(room);
    } else if (newPhase === 'PREP') {
        setupPrepPhase(room);
    } else if (newPhase === 'MIDDAY') {
        setupMiddayPhase(room);
    } else if (newPhase === 'VOTE') {
        setupVotePhase(room);
    }
}

function executeVotingResult(room) {
    let voteCounts = {};
    room.players.forEach(p => {
        if (p.votedTo) {
            voteCounts[p.votedTo] = (voteCounts[p.votedTo] || 0) + 1;
        }
    });

    let maxVotes = 0;
    let executedPlayers = [];
    for (let targetId in voteCounts) {
        if (voteCounts[targetId] > maxVotes) {
            maxVotes = voteCounts[targetId];
            executedPlayers = [targetId];
        } else if (voteCounts[targetId] === maxVotes) {
            executedPlayers.push(targetId);
        }
    }

    if (maxVotes > 0 && executedPlayers[0] !== 'PEACE') {
        executedPlayers.forEach(id => {
            const target = room.players.find(p => p.id === id);
            if (target) target.isDead = true;
        });
    }

    room.executionResult = { maxVotes, executedPlayers };
    recordResultData(room);
}

function recordResultData(room) {
    const isPeace = room.executionResult.executedPlayers.includes('PEACE')
        && room.executionResult.executedPlayers.length === 1;

    let executedWolves = [];
    let executedGhosts = [];
    let executedTrapper = null;

    room.players.forEach(p => {
        if (p.isDead) {
            if (p.chosenRole.role === '人狼' || p.chosenRole.role === '大狼') executedWolves.push(p);
            else if (p.chosenRole.role === 'おばけ') executedGhosts.push(p);
            else if (p.chosenRole.role === '罠師') executedTrapper = p;
        }
    });

    const hasWolf = room.players.some(p => p.chosenRole.role === '人狼' || p.chosenRole.role === '大狼');

    let winnerTeam = '人狼陣営';
    if (executedGhosts.length > 0) {
        winnerTeam = 'おばけ（単独勝利）';
    } else if (isPeace) {
        winnerTeam = hasWolf ? '人狼陣営' : '市民陣営';
    } else if (executedWolves.length > 0) {
        winnerTeam = '市民陣営';
    } else if (!hasWolf) {
        winnerTeam = '第三陣営・失敗（狼不在で市民吊り）';
    }

    // 罠師の道連れ処理
    if (executedTrapper) {
        room.players.forEach(p => {
            if (p.votedTo === executedTrapper.id) {
                p.isDead = true;
                p.draggedDown = true;
            }
        });
    }

    // 勝者の決定
    room.players.forEach(p => {
        const def = ROLE_DEFS[p.chosenRole.role];
        let isWinner = false;
        if (winnerTeam === 'おばけ（単独勝利）') {
            if (p.chosenRole.role === 'おばけ' && p.isDead && !p.draggedDown) isWinner = true;
        } else if (winnerTeam === '市民陣営') {
            if (def && def.faction === '人間チーム') isWinner = true;
        } else if (winnerTeam === '人狼陣営') {
            if (def && def.faction === '人狼チーム') isWinner = true;
        }
        if (p.chosenRole.role === '逃亡者' && !p.isDead) isWinner = true;
        p.isWinner = isWinner;
    });

    room.resultData = {
        winnerTeam,
        isPeace,
        executedWolves: executedWolves.map(p => p.id),
        executedGhosts: executedGhosts.map(p => p.id),
    };
}

// ====================================
// NPC自動行動
// ====================================
function processNpcTurns(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const processNext = () => {
        if (!rooms[roomId]) return;
        if (room.phase === 'CARD_DIST') {
            const cp = room.players[room.currentPlayerIndex];
            if (!cp || !cp.isNpc) return;
            // NPCはランダムにカード選択
            const idx = Math.random() < 0.5 ? 0 : 1;
            cp.chosenRole = cp.dealtCards[idx];
            cp.remainingCard = cp.dealtCards[idx === 0 ? 1 : 0];
            room.currentPlayerIndex++;
            if (room.currentPlayerIndex >= room.players.length) {
                setPhase(room, 'PREP');
            }
            broadcastState(roomId);
            setTimeout(processNext, 300);
        } else if (room.phase === 'PREP') {
            const cp = room.players[room.currentPlayerIndex];
            if (!cp || !cp.isNpc) return;
            room.currentPlayerIndex++;
            if (room.currentPlayerIndex >= room.players.length) {
                setPhase(room, 'MORNING');
            }
            broadcastState(roomId);
            setTimeout(processNext, 300);
        } else if (room.phase === 'MIDDAY') {
            const cr = room.middayRoles[room.currentMiddayRoleIndex];
            const hasRole = room.players.some(p => p.chosenRole && p.chosenRole.role === cr && !p.isNpc);
            if (!hasRole) {
                // 該当役職がNPCのみ or いない場合はスキップ
                room.currentMiddayRoleIndex++;
                if (room.currentMiddayRoleIndex >= room.middayRoles.length) {
                    setPhase(room, 'NIGHT');
                }
                broadcastState(roomId);
                setTimeout(processNext, 300);
            }
        } else if (room.phase === 'VOTE') {
            const cp = room.players[room.currentPlayerIndex];
            if (!cp || !cp.isNpc) return;
            // NPCはランダムに投票
            const targets = room.players.filter(p => p.id !== cp.id);
            const target = targets[Math.floor(Math.random() * targets.length)];
            cp.votedTo = target.id;
            room.currentPlayerIndex++;
            if (room.currentPlayerIndex >= room.players.length) {
                executeVotingResult(room);
                setPhase(room, 'RESULT');
            }
            broadcastState(roomId);
            setTimeout(processNext, 300);
        }
    };

    setTimeout(processNext, 500);
}

// ====================================
// Socket.io イベント処理
// ====================================
io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // --- 入室 ---
    socket.on('join-room', ({ roomId, playerName }, callback) => {
        const room = getRoom(roomId);

        if (room.phase !== 'LOBBY') {
            if (callback) callback({ error: 'ゲームはすでに開始されています。' });
            return;
        }
        if (room.players.length >= room.settings.maxPlayers) {
            if (callback) callback({ error: '部屋が満員です。' });
            return;
        }

        const usedColors = room.players.map(p => p.color);
        const freeColors = AVAILABLE_COLORS.filter(c => !usedColors.includes(c));
        const color = freeColors.length > 0 ? freeColors[0] : '#ffffff';

        const player = {
            id: socket.id,
            name: playerName,
            color,
            isHost: room.players.length === 0,
            isDead: false,
            draggedDown: false,
            votedTo: null,
            chosenRole: null,
            remainingCard: null,
            dealtCards: null,
            isWinner: false,
        };

        room.players.push(player);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.playerId = socket.id;

        if (callback) callback({ success: true, playerId: socket.id });
        broadcastState(roomId);
        console.log(`[Room ${roomId}] ${playerName} joined. Players: ${room.players.length}`);
    });

    // --- NPC追加（デバッグ用） ---
    socket.on('add-npc', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'LOBBY') return;
        if (room.players.length >= room.settings.maxPlayers) return;

        const npcCount = room.players.filter(p => p.name.startsWith('NPC')).length;
        const name = `NPC${npcCount + 1}`;
        const usedColors = room.players.map(p => p.color);
        const freeColors = AVAILABLE_COLORS.filter(c => !usedColors.includes(c));
        const color = freeColors.length > 0 ? freeColors[0] : '#ffffff';

        room.players.push({
            id: `npc-${Math.random().toString(36).substr(2, 6)}`,
            name,
            color,
            isHost: false,
            isNpc: true,
            isDead: false,
            draggedDown: false,
            votedTo: null,
            chosenRole: null,
            remainingCard: null,
            dealtCards: null,
            isWinner: false,
        });

        broadcastState(roomId);
    });

    // --- カラー変更 ---
    socket.on('change-color', ({ roomId, color }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        const used = room.players.some(p => p.id !== socket.id && p.color === color);
        if (!used) {
            player.color = color;
            broadcastState(roomId);
        }
    });

    // --- ゲーム設定変更（ホストのみ） ---
    socket.on('update-settings', ({ roomId, settings }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;
        room.settings = { ...room.settings, ...settings };
        broadcastState(roomId);
    });

    // --- ゲーム開始（ホストのみ） ---
    socket.on('start-game', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;
        if (room.players.length < 2) return;

        const required = room.players.length * 2;
        let total = 0;
        Object.values(room.settings.roleCounts).forEach(c => total += c);
        if (total !== required) return;

        setPhase(room, 'CARD_DIST');
        broadcastState(roomId);
        processNpcTurns(roomId);
    });

    // --- カード選択 ---
    socket.on('choose-card', ({ roomId, cardIndex }) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'CARD_DIST') return;
        const currentPlayer = room.players[room.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== socket.id) return;
        if (currentPlayer.chosenRole) return; // 既に選択済み

        const chosen = currentPlayer.dealtCards[cardIndex];
        const remaining = currentPlayer.dealtCards[cardIndex === 0 ? 1 : 0];

        currentPlayer.chosenRole = chosen;
        currentPlayer.remainingCard = remaining;

        broadcastState(roomId);
    });

    // --- カード選択後「次へ」 ---
    socket.on('next-player-turn', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const currentPlayer = room.players[room.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== socket.id) return;

        room.currentPlayerIndex++;
        if (room.currentPlayerIndex >= room.players.length) {
            setPhase(room, 'PREP');
        }
        broadcastState(roomId);
        processNpcTurns(roomId);
    });

    // --- 準備フェーズ完了「次へ」 ---
    socket.on('end-prep', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'PREP') return;
        const currentPlayer = room.players[room.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== socket.id) return;

        room.currentPlayerIndex++;
        if (room.currentPlayerIndex >= room.players.length) {
            setPhase(room, 'MORNING');
        }
        broadcastState(roomId);
        processNpcTurns(roomId);
    });

    // --- 議論フェーズ強制終了（ホストのみ） ---
    socket.on('skip-timer', ({ roomId, nextPhase }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;
        setPhase(room, nextPhase);
        broadcastState(roomId);
        processNpcTurns(roomId);
    });

    // --- 昼フェーズ行動 ---
    socket.on('midday-action', ({ roomId, action }) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'MIDDAY') return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const currentRole = room.middayRoles[room.currentMiddayRoleIndex];
        if (player.chosenRole.role !== currentRole) return;

        // 怪盗のカード入れ替え
        if (action.type === 'swap-role' && currentRole === '怪盗') {
            const target = room.players.find(p => p.id === action.targetId);
            if (target) {
                const temp = player.chosenRole;
                player.chosenRole = target.chosenRole;
                target.chosenRole = temp;
            }
        }

        // DJのカード入れ替え
        if (action.type === 'swap-remaining' && currentRole === 'DJ') {
            const t1 = room.players.find(p => p.id === action.targetId1);
            const t2 = room.players.find(p => p.id === action.targetId2);
            if (t1 && t2) {
                const temp = t1.remainingCard;
                t1.remainingCard = t2.remainingCard;
                t2.remainingCard = temp;
            }
        }

        broadcastState(roomId);
    });

    // --- 昼フェーズ次へ ---
    socket.on('next-midday-turn', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'MIDDAY') return;

        room.currentMiddayRoleIndex++;
        if (room.currentMiddayRoleIndex >= room.middayRoles.length) {
            setPhase(room, 'NIGHT');
        }
        broadcastState(roomId);
        processNpcTurns(roomId);
    });

    // --- 投票 ---
    socket.on('vote', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'VOTE') return;
        const currentPlayer = room.players[room.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== socket.id) return;

        currentPlayer.votedTo = targetId;
        room.currentPlayerIndex++;

        if (room.currentPlayerIndex >= room.players.length) {
            executeVotingResult(room);
            setPhase(room, 'RESULT');
        }
        broadcastState(roomId);
        processNpcTurns(roomId);
    });

    // --- ロビーに戻る（ホストのみ） ---
    socket.on('back-to-lobby', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;
        setPhase(room, 'LOBBY');
        broadcastState(roomId);
    });

    // --- 部屋の強制リセット ---
    socket.on('reset-room', ({ roomId }) => {
        if (!rooms[roomId]) return;
        delete rooms[roomId];
        console.log(`[Room ${roomId}] Forcefully reset by client.`);
        broadcastState(roomId); // 削除済みなので空の状態が送られるか、あるいは何もしない
    });

    // --- 切断処理 ---
    socket.on('disconnect', () => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        const index = room.players.findIndex(p => p.id === socket.id);
        if (index === -1) return;

        const wasHost = room.players[index].isHost;
        room.players.splice(index, 1);

        // 部屋が空になったら削除
        if (room.players.length === 0) {
            delete rooms[roomId];
            console.log(`[Room ${roomId}] Deleted (empty).`);
            return;
        }

        // ホストが抜けた場合は次の人をホストに
        if (wasHost && room.players.length > 0) {
            room.players[0].isHost = true;
        }

        broadcastState(roomId);
        console.log(`[Room ${roomId}] Player disconnected. Remaining: ${room.players.length}`);
    });
});

// ====================================
// サーバー起動
// ====================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`\n🐺 人狼ドッチ サーバー起動中: http://localhost:${PORT}\n`);
});
