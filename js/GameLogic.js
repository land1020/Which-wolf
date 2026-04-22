/**
 * ゲームのコアロジックを管理するクラス
 */
export class GameLogic {
    /**
     * プレイ人数と選択された役職から山札を生成する
     * @param {number} playerCount 
     * @param {Array<string>} selectedRoles 
     * @returns {Array<Object>} 
     */
    static generateDeck(playerCount, selectedRoles) {
        const totalCards = playerCount * 2;
        let deck = [];

        // 1. 指定された役職を必ず1枚ずつ入れる
        selectedRoles.forEach(role => {
            deck.push(this.createCard(role));
        });

        // 2. 残りの枠を「市民」で埋める（あるいはランダムな役職で埋める）
        // ※人狼ドッチの基本セットでは、選ばれた役職以外は「市民」などで補填することが多い。
        // ここでは「市民」で埋める仕様とする。
        while (deck.length < totalCards) {
            deck.push(this.createCard('市民'));
        }

        // シャッフル
        return this.shuffle(deck);
    }

    static createCard(role) {
        return {
            id: Math.random().toString(36).substr(2, 9),
            role: role,
            side: this.getRoleSide(role) // 'Red', 'Blue', 'White' etc.
        };
    }

    static getRoleSide(role) {
        const redRoles = ['人狼', '大狼'];
        if (redRoles.includes(role)) return 'Red';
        return 'Blue'; // デフォルト
    }

    static shuffle(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}
