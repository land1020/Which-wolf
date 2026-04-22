/**
 * 人狼ドッチ - Main Entry Point
 */

import { GameState } from './GameState.js';
import { UIManager } from './UIManager.js';

document.addEventListener('DOMContentLoaded', () => {
    const state = new GameState();
    const ui = new UIManager(state);

    // 初期化
    ui.init();

    // デバッグ用
    window.game = { state, ui };
    console.log('人狼ドッチ initialized.');
});
