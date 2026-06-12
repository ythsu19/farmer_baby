// BossHUD — Boss 血量顯示（長條圖 + 數字，不用 cc.ProgressBar）
//
// 為什麼不用 ProgressBar？
//   ProgressBar 要建 bar 子節點、掛 Sprite、設 Bar Sprite 欄位，步驟繁瑣易出錯。
//   這裡改成「自己控制一個 Sprite 節點的寬度」：血量比例 0~1 直接對應填充條的 width。
//   你只要在場景放一張圖（任何 Sprite）當填充條，拖進 fillNode 欄位即可。
//
// 長條圖怎麼縮才會從左往右減少？
//   把 fillNode 的「錨點 AnchorX 設成 0」（最左），width 改變時就固定左邊、往右伸縮。
//   本元件 onLoad 會自動把 anchorX 設 0，你不用手動調。
//
// 預期擺放（Cocos 場景樹）：
//   Canvas
//     └── BossHUD                 ← 掛本元件；建議 Widget 對齊「上方置中」
//           ├── HpBarBg(Sprite)   ← 血條底框（深色），固定不動，選填
//           ├── HpBarFill(Sprite) ← 填充條（紅色），會被本元件改 width → 拖進 fillNode
//           └── HpLabel(Label)    ← 數字 "30 / 30"，選填
//
// 資料來源：
//   - 訂閱 bossNode 的 'hp-changed' { hp, maxHp, delta }（Boss.ts 發）
//   - 初始值在 start 讀一次（理由見 start() 註解）
//   - Boss 死亡(emit 'died') → 依 hideOnDeath 決定是否隱藏整個 HUD

const { ccclass, property } = cc._decorator;

@ccclass
export default class BossHUD extends cc.Component {

    @property({ type: cc.Node, displayName: 'Boss 節點', tooltip: '拉 Boss 節點（掛 Boss.ts 的那顆）' })
    bossNode: cc.Node = null;

    @property({
        type: cc.Node,
        displayName: '血條填充節點',
        tooltip: '拉「填充條」Sprite 節點（紅色那條）。本元件會改它的 width 來表示血量。留空 → 不顯示長條。'
    })
    fillNode: cc.Node = null;

    @property({
        displayName: '血條滿血寬度',
        tooltip: '滿血時填充條的寬度 (px)。血量比例會 × 這個值。建議填你血條設計的長度，例如 400。'
    })
    fullWidth: number = 400;

    @property({ type: cc.Label, displayName: 'HP 文字', tooltip: '顯示血量的 Label；留空 → 不顯示數字' })
    hpLabel: cc.Label = null;

    @property({ displayName: 'HP 文字格式', tooltip: '{hp} 跟 {max} 會被取代成實際數值' })
    hpFormat: string = '{hp} / {max}';

    @property({ displayName: 'Boss 死亡後隱藏', tooltip: '勾 → Boss 被 destroy 時把這個 HUD 節點關掉' })
    hideOnDeath: boolean = true;

    onLoad() {
        // 填充條錨點固定在最左 → 改 width 時從左固定、往右伸縮（血條從右邊減少）
        if (this.fillNode) this.fillNode.anchorX = 0;

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
        const safeHp = Math.max(0, hp);
        const safeMax = Math.max(1, max);
        const ratio = Math.min(1, safeHp / safeMax);

        // 長條：用 width 表示血量（錨點在左 → 從右邊往左扣血）
        if (this.fillNode) {
            this.fillNode.width = this.fullWidth * ratio;
        }
        // 數字
        if (this.hpLabel) {
            this.hpLabel.string = this.hpFormat
                .replace('{hp}', String(safeHp))
                .replace('{max}', String(safeMax));
        }
    }
}
