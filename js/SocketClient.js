/**
 * Socket.io クライアント接続管理
 * サーバーとのリアルタイム通信を担う
 */
export class SocketClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.onStateUpdate = null; // コールバック: state-updateを受信したとき
    }

    connect() {
        // socket.io クライアントをCDNから読み込み済みであることを前提にする
        this.socket = io(this.serverUrl, {
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log(`[Socket] Connected: ${this.socket.id}`);
            // 再接続コールバック（存在する場合）
            if (this.onReconnect) {
                this.onReconnect();
            }
        });

        this.socket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
        });

        this.socket.on('state-update', (roomData) => {
            if (this.onStateUpdate) {
                this.onStateUpdate(roomData);
            }
        });

        return this;
    }

    get id() {
        return this.socket ? this.socket.id : null;
    }

    // --- 送信系メソッド ---
    joinRoom(roomId, playerName, callback) {
        this.socket.emit('join-room', { roomId, playerName }, callback);
    }

    // 再入室（ゲーム中にブラウザを閉じた場合）
    rejoinRoom(roomId, playerName, callback) {
        this.socket.emit('rejoin-room', { roomId, playerName }, callback);
    }

    addNpc(roomId) {
        this.socket.emit('add-npc', { roomId });
    }

    changeColor(roomId, color) {
        this.socket.emit('change-color', { roomId, color });
    }

    updateSettings(roomId, settings) {
        this.socket.emit('update-settings', { roomId, settings });
    }

    startGame(roomId) {
        this.socket.emit('start-game', { roomId });
    }

    chooseCard(roomId, cardIndex) {
        this.socket.emit('choose-card', { roomId, cardIndex });
    }

    nextPlayerTurn(roomId) {
        this.socket.emit('next-player-turn', { roomId });
    }

    endPrep(roomId) {
        this.socket.emit('end-prep', { roomId });
    }

    skipTimer(roomId, nextPhase) {
        this.socket.emit('skip-timer', { roomId, nextPhase });
    }

    middayAction(roomId, action, callback) {
        this.socket.emit('midday-action', { roomId, action }, callback);
    }


    nextMiddayTurn(roomId) {
        this.socket.emit('next-midday-turn', { roomId });
    }

    vote(roomId, targetId) {
        this.socket.emit('vote', { roomId, targetId });
    }

    backToLobby(roomId) {
        this.socket.emit('back-to-lobby', { roomId });
    }

    resetRoom(roomId) {
        this.socket.emit('reset-room', { roomId });
    }
}
