// LevelEndOnFall — 角色 world Y 低於閾值就結束關卡，切到下一個場景
//
// 用途：Tutorial 場景最底部設一條「死亡線」— 角色掉下去自動跳到 World scene。
//
// 為什麼用 Y 閾值不用 PhysicsBoxCollider 觸發器？
//   觸發器要：建節點 + RigidBody + Sensor Collider + Group 矩陣設對 + onBeginContact 邏輯，
//   只為了「Y 比一個數字小」太繞。
//   Y 閾值：update 裡一行 if，0 dependencies、不用配 group matrix。
//
// 觸發條件：陣列裡「任一」角色 world Y < fallY → 一次觸發、不重入
//   單人 → 拖 Player1 進來；雙人 → 拖 Player1 + Player2
//   任一個掉下去就算 Game over → 切場景。要改成「所有人都掉才算」未來再加 mode 切換。
//
// 切場景前的延遲：給玩家「啊我掉下去了」的反應時間，不要瞬間黑屏。

const { ccclass, property } = cc._decorator;

@ccclass
export default class LevelEndOnFall extends cc.Component {

    @property({ type: [cc.Node], displayName: '監聽的角色', tooltip: '拖 Player1 / Player2 進來；任一掉到 fallY 以下 → 結束關卡' })
    players: cc.Node[] = [];

    @property({ displayName: '掉落 Y 閾值 (world)', tooltip: '角色 world Y 低於這個就觸發。找一個比地圖最低點再低個 100–200px 的值最安全' })
    fallY: number = -800;

    @property({ displayName: '下一個場景', tooltip: '預設 World — 跟 ShopController.backSceneName 對稱' })
    nextSceneName: string = 'World';

    @property({ displayName: '延遲切場景 (s)', tooltip: '觸發後等多久才 loadScene；給玩家反應時間。0 = 立刻' })
    delay: number = 0.4;

    private _triggered: boolean = false;

    update() {
        if (this._triggered) return;
        if (!this.players || this.players.length === 0) return;

        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];
            if (!p || !p.isValid) continue;

            // 取 world Y — 跟 Player.ts:_isGroundContact 同一個 idiom，
            // 避免 player parent 不是 scene 根時直接讀 p.y 拿到錯的局部座標
            const worldY = p.parent
                ? p.parent.convertToWorldSpaceAR(p.position).y
                : p.y;

            if (worldY < this.fallY) {
                cc.log(`[LevelEndOnFall] ${p.name} 掉到 worldY=${worldY.toFixed(0)} < ${this.fallY} → ${this.nextSceneName}`);
                this._end();
                return;
            }
        }
    }

    private _end() {
        this._triggered = true;
        if (this.delay <= 0) {
            cc.director.loadScene(this.nextSceneName);
        } else {
            // scheduleOnce 即使這個元件 destroy 也會被 director 跑完（除非整個 scene 已被換掉），
            // 場景切換時 director 會把 timer 一起清掉，不會洩漏
            this.scheduleOnce(() => {
                cc.director.loadScene(this.nextSceneName);
            }, this.delay);
        }
    }
}
