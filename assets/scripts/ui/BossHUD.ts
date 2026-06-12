// BossHUD — Boss 血量文字顯示（純數字，例如 "30 / 30"）
//
// 用途：
//   一顆 cc.Label 顯示 Boss 當前血量。訂閱 Boss 節點的 'hp-changed' event 即時更新。
//   Boss.ts 受傷時會 emit 'hp-changed' { hp, maxHp, delta }，跟 PlayerHUD 同一套協定。
//
// 預期擺放（Cocos 場景樹）：
//   Canvas
//     └── BossHUD            ← 掛本元件 + 一顆 cc.Label（或把 Label 拉進 hpLabel 欄位）
//                              建議用 Widget 對齊「上方置中」當大魔王血量條
//
// 資料來源：
//   - 訂閱 bossNode 的 'hp-changed' { hp, maxHp, delta }（Boss.ts 發）
//   - 初始值在 start 讀一次（理由見下方 start() 註解）
//   - Boss 死亡會被 destroy，本元件 onDestroy 自動解除監聽

const { ccclass, property } = cc._decorator;

@ccclass
export default class BossHUD extends cc.Component {

    @property({ type: cc.Node, displayName: 'Boss 節點', tooltip: '拉 Boss 節點（掛 Boss.ts 的那顆）' })
    bossNode: cc.Node = null;

    @property({ type: cc.Label, displayName: 'HP 文字', tooltip: '顯示血量的 Label；留空 → 不顯示' })
    hpLabel: cc.Label = null;

    @property({ displayName: 'HP 文字格式', tooltip: '{hp} 跟 {max} 會被取代成實際數值' })
    hpFormat: string = '{hp} / {max}';

    @property({ displayName: 'Boss 死亡後隱藏', tooltip: '勾 → Boss 被 destroy 時把這個 HUD 節點關掉' })
    hideOnDeath: boolean = true;

    onLoad() {
        if (this.bossNode) {
            this.bossNode.on('hp-changed', this._onHpChanged, this);
            this.bossNode.on('died', this._onBossDied, this);
        } else {
            cc.warn('[BossHUD] 未綁定 bossNode，HP 不會更新');
        }
    }

    start() {
        // 初始值讀取放 start 不放 onLoad：
        //   Cocos lifecycle 所有元件 onLoad 全跑完才跑 start。Boss._currentHealth 在
        //   class 宣告時是 0，要等 Boss.onLoad() 才設成 maxHealth。放 start 保證讀到正確初始值。
        if (!this.bossNode) return;
        const boss = this.bossNode.getComponent('Boss') as any;
        if (boss) this._renderHp(boss.currentHealth, boss.maxHealth);
    }

    onDestroy() {
        if (this.bossNode && this.bossNode.isValid) {
            this.bossNode.off('hp-changed', this._onHpChanged, this);
            this.bossNode.off('died', this._onBossDied, this);
        }
    }

    private _onHpChanged(data: { hp: number, maxHp: number, delta: number }) {
        if (!data) return;
        this._renderHp(data.hp, data.maxHp);
    }

    private _onBossDied() {
        if (this.hideOnDeath && this.node && this.node.isValid) {
            this.node.active = false;
        }
    }

    private _renderHp(hp: number, max: number) {
        if (!this.hpLabel) return;
        const safeHp = Math.max(0, hp);
        const safeMax = Math.max(1, max);
        this.hpLabel.string = this.hpFormat
            .replace('{hp}', String(safeHp))
            .replace('{max}', String(safeMax));
    }
}
