import { GameLogic } from './GameLogic.js';

/**
 * 状態管理クラス
 */
export class GameState {
    constructor() {
        this.phase = 'TITLE'; // TITLE, LOBBY, CARD_DIST, PREP, MORNING, MIDDAY, NIGHT, VOTE, RESULT
        this.players = [];
        this.availableColors = [
            '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
            '#8b4513', '#ec4899', '#14b8a6', '#eab308', '#64748b', '#a855f7'
        ];
        this.settings = {
            discussionTime: 180, // 秒
            maxPlayers: 8,
            roleCounts: {
                '市民': 2, '占い師': 1, '警察': 1, 'DJ': 1, '人狼': 2,
                '裏切り者': 0, 'おばけ': 0, '大狼': 0, '少年': 0, '怪盗': 0,
                '情報屋': 0, '逃亡者': 0, '罠師': 0
            }
        };
        
        this.roleDefs = {
            '市民': { side: 'Blue', faction: '人間チーム', desc: '特殊能力なし。' },
            '占い師': { side: 'Blue', faction: '人間チーム', desc: '準備フェーズ:「誰かの役職カード」または「誰かの残りカードエリアから2枚」を確認する。' },
            '警察': { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ:「誰かの残りカード」を1枚確認する。' },
            'DJ': { side: 'Blue', faction: '人間チーム', desc: '昼フェーズ:「誰かの残りカード」と「別の誰かの残りカード」を入れ替える。' },
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
        this.cards = []; // 山札
        this.localPlayerId = null;
        this.currentPlayerIndex = 0; // 一人ずつ回すローカルプレイ用
    }

    setPhase(newPhase) {
        console.log(`Phase change: ${this.phase} -> ${newPhase}`);
        this.phase = newPhase;
        
        if (newPhase === 'LOBBY') {
            // 次のゲームのためにプレイヤー状態を初期化（設定は保持）
            this.players.forEach(p => {
                p.isReady = false;
                p.isDead = false;
                p.votedTo = null;
                p.draggedDown = false;
                p.chosenRole = null;
                p.remainingCard = null;
                p.isWinner = false;
            });
            this.winCountUpdated = false;
        } else if (newPhase === 'CARD_DIST') {
            this.setupCardDistribution();
        } else if (newPhase === 'PREP') {
            this.setupPrepPhase();
        } else if (newPhase === 'MIDDAY') {
            this.setupMiddayPhase();
        } else if (newPhase === 'VOTE') {
            this.setupVotePhase();
        }

        // フェーズ変更イベントを発火
        document.dispatchEvent(new CustomEvent('phaseChanged', { detail: newPhase }));
    }

    addPlayer(name, color = null) {
        if (this.players.length >= this.settings.maxPlayers) return null;

        const isHost = this.players.length === 0;

        // カラーが指定されていない、もしくは重複している場合はランダムに割り当て
        let assignedColor = color;
        const usedColors = this.players.map(p => p.color);
        if (!assignedColor || usedColors.includes(assignedColor)) {
            const freeColors = this.availableColors.filter(c => !usedColors.includes(c));
            if (freeColors.length > 0) {
                assignedColor = freeColors[Math.floor(Math.random() * freeColors.length)];
            } else {
                assignedColor = '#ffffff'; // 万が一色が足りない場合
            }
        }

        const id = Math.random().toString(36).substr(2, 9);
        const player = {
            id,
            name,
            color: assignedColor,
            isHost,
            isReady: false,
            role: null,
            extraCard: null,
            isDead: false,
            votedTo: null
        };
        this.players.push(player);
        if (!this.localPlayerId) this.localPlayerId = id;
        return player;
    }

    changePlayerColor(playerId, newColor) {
        const usedColors = this.players.map(p => p.color);
        if (usedColors.includes(newColor)) return false; // 重複を許さない
        
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.color = newColor;
            return true;
        }
        return false;
    }

    get localPlayer() {
        return this.players.find(p => p.id === this.localPlayerId);
    }

    setupCardDistribution() {
        this.currentPlayerIndex = 0;
        
        // Settingsの役職配列からデッキを構成（指定枚数分）
        let rolesArray = [];
        for (const [role, count] of Object.entries(this.settings.roleCounts)) {
            for (let i = 0; i < count; i++) {
                rolesArray.push(role);
            }
        }
        
        // 本来不足分を市民で埋めるなどのロジックも考えられるが、ホスト設定を強制する
        // シャッフル
        for (let i = rolesArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rolesArray[i], rolesArray[j]] = [rolesArray[j], rolesArray[i]];
        }

        this.cards = rolesArray.map(roleName => {
            const rDef = this.roleDefs[roleName];
            return {
                id: Math.random().toString(36).substr(2, 9),
                role: roleName,
                side: rDef ? rDef.side : 'Blue'
            };
        });
        
        // 各プレイヤーに2枚ずつ配布
        this.players.forEach(p => {
            p.dealtCards = [this.cards.pop(), this.cards.pop()];
            p.chosenRole = null;
            p.remainingCard = null;
        });
        this.currentPlayerIndex = 0;
    }

    nextPlayerTurn() {
        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= this.players.length) {
            // 現在のフェーズのシーケンスが終わった時の処理
            if (this.phase === 'CARD_DIST') {
                this.setPhase('PREP');
            } else if (this.phase === 'PREP') {
                this.setPhase('MORNING');
            } else if (this.phase === 'MIDDAY') {
                this.setPhase('NIGHT');
            }
        } else {
            document.dispatchEvent(new CustomEvent('playerTurnChanged'));
        }
    }

    setupPrepPhase() {
        this.currentPlayerIndex = 0;
        document.dispatchEvent(new CustomEvent('playerTurnChanged'));
    }

    setupMiddayPhase() {
        this.middayRoles = ['情報屋', '警察', '怪盗', 'DJ'];
        this.currentMiddayRoleIndex = 0;
        document.dispatchEvent(new CustomEvent('middayTurnChanged'));
    }

    nextMiddayTurn() {
        this.currentMiddayRoleIndex++;
        if (this.currentMiddayRoleIndex >= this.middayRoles.length) {
            this.setPhase('NIGHT');
        } else {
            document.dispatchEvent(new CustomEvent('middayTurnChanged'));
        }
    }

    setupVotePhase() {
        this.currentPlayerIndex = 0;
        this.players.forEach(p => p.votedTo = null);
        document.dispatchEvent(new CustomEvent('voteTurnChanged'));
    }

    nextVoteTurn() {
        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= this.players.length) {
            this.executeVotingResult();
        } else {
            document.dispatchEvent(new CustomEvent('voteTurnChanged'));
        }
    }

    executeVotingResult() {
        // 投票集計
        let voteCounts = {};
        this.players.forEach(p => {
            if (p.votedTo) {
                voteCounts[p.votedTo] = (voteCounts[p.votedTo] || 0) + 1;
            }
        });

        // 最多票の判定
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

        // 処刑状態の更新
        if (maxVotes > 0 && executedPlayers[0] !== 'PEACE') {
            executedPlayers.forEach(id => {
                const target = this.players.find(p => p.id === id);
                if (target) target.isDead = true;
            });
        }

        this.executionResult = { maxVotes, executedPlayers };
        this.recordResultData();
        this.setPhase('RESULT');
    }

    recordResultData() {
        // 勝敗判定ロジック
        const isPeace = this.executionResult.executedPlayers.includes('PEACE') && this.executionResult.executedPlayers.length === 1;
        
        let executedWolves = [];
        let executedGhosts = [];
        let executedTrapper = null;

        // 処刑された人の役職を走査
        this.players.forEach(p => {
            if (p.isDead) {
                if (p.chosenRole.role === '人狼' || p.chosenRole.role === '大狼') {
                    executedWolves.push(p);
                } else if (p.chosenRole.role === 'おばけ') {
                    executedGhosts.push(p);
                } else if (p.chosenRole.role === '罠師') {
                    executedTrapper = p;
                }
            }
        });

        const hasWolf = this.players.some(p => p.chosenRole.role === '人狼' || p.chosenRole.role === '大狼');
        
        let winnerTeam = '人狼陣営';
        
        // おばけ単独勝利チェック
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
        let draggedDown = [];
        if (executedTrapper) {
            this.players.forEach(p => {
                if (p.votedTo === executedTrapper.id) {
                    p.isDead = true; // 道連れで死亡
                    p.draggedDown = true;
                    draggedDown.push(p);
                }
            });
        }

        this.resultData = {
            winnerTeam,
            isPeace,
            executedWolves,
            executedGhosts,
            draggedDown
        };
    }

    // 他のプレイヤーのカードなどを見るための便利関数
    getPlayersWithRole(roleName) {
        return this.players.filter(p => !p.isDead && p.chosenRole && p.chosenRole.role === roleName);
    }
}
