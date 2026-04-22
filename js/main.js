/**
 * 人狼ドッチ - Main Entry Point (オンライン対応版)
 */

import { UIManager } from './UIManager.js';
import { SocketClient } from './SocketClient.js';

// ====================================
// サーバーURL設定
// 本番(Vercel)では window.SOCKET_SERVER_URL を使用
// 開発時は localhost:3001
// ====================================
const SERVER_URL = window.SOCKET_SERVER_URL || window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    const socketClient = new SocketClient(SERVER_URL).connect();
    const ui = new UIManager(socketClient);

    // サーバーからの状態更新を受信してUIを更新
    socketClient.onStateUpdate = (roomData) => {
        ui.applyServerState(roomData);
    };

    // 初期化
    ui.init();

    // デバッグ用
    window.game = { socketClient, ui };
    console.log('人狼ドッチ (Online) initialized. Server:', SERVER_URL);
});
