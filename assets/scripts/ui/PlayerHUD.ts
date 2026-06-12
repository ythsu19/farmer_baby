// PlayerHUD — 螢幕右上 / 左上的玩家狀態列（HP 血條 + 數字 + 金錢）
//
// 用途：
//   一支元件統一處理玩家 HUD：HP 用血條(ProgressBar) + 文字(Label) 並陳，金錢用文字。
//   掛在「Canvas 下的 HUD 節點」上 — Cocos 2.4 Canvas 預設就是 screen-space，
//   不會跟 camera 移動，所以 HUD 永遠跟著畫面，不用像 TutorialHint 那樣特別處理。
//
// 預期擺放（Cocos 場景樹）：
//   Canvas
//     ├── Main Camera
//     ├── (其他 in-game 節點)
//     └── HUD                 ← 掛 PlayerHUD.ts；建議 Widget 對齊「左上 / 右上」
//           ├── HpBar         ← cc.ProgressBar（Filled 模式即可）
//           ├── HpLabel       ← cc.Label，顯示 "50 / 100"
//           └── MoneyLabel    ← cc.Label，顯示 "$ 100"
//
// 資料來源：
//   - HP：訂閱 playerNode 的 'hp-changed' { hp, maxHp, delta } event（PlayerHealth 發）
//     onLoad 時也立刻讀一次當前 HP 初始化
//   - 金錢：先 hardcode initialMoney，之後接 PlayerWallet / Store 後改成 event-driven
//     對外暴露 setMoney(amount) / addMoney(delta) 給外部呼叫
//
// 為什麼不重用 PlayerHpLabel.ts？
//   PlayerHpLabel 只負責一顆 Label（純文字 "HP 50/100"），HUD 是整組元件的容器。
//   讓兩者各做各的：PlayerHpLabel 可以單獨用在 debug / 其他畫面，PlayerHUD 是正式玩家 HUD。

const { ccclass, property } = cc._decorator;

@ccclass
export default class PlayerHUD extends cc.Component {

    @property({ type: cc.Node, displayName: '玩家節點', tooltip: '拉 Player 節點（掛 PlayerHealth 的那顆）' })
    playerNode: cc.Node = null;

    // ── HP ───────────────────────────────────────────────
    @property({ type: cc.ProgressBar, displayName: 'HP 血條', tooltip: '建議 ProgressBar.Type = Filled；留空 → 不顯示血條' })
    hpBar: cc.ProgressBar = null;

    @property({ type: cc.Label, displayName: 'HP 文字', tooltip: '顯示 "50 / 100"；留空 → 不顯示文字' })
    hpLabel: cc.Label = null;

    @property({ displayName: 'HP 文字格式', tooltip: '{hp} 跟 {max} 會被取代成實際數值' })
    hpFormat: string = '{hp} / {max}';

    // ── 金錢 ─────────────────────────────────────────────
    @property({ type: cc.Label, displayName: '金錢文字', tooltip: '顯示金錢；留空 → 不顯示' })
    moneyLabel: cc.Label = null;

    @property({ displayName: '金錢初始值', tooltip: '尚未接金錢系統前的暫定值；之後接 PlayerWallet / Store 後改成 event-driven' })
    initialMoney: number = 100;

    @property({ displayName: '金錢文字格式', tooltip: '{n} 會被取代成實際金額' })
    moneyFormat: string = '$ {n}';

    private _money: number = 0;

    onLoad() {
        this._money = this.initialMoney;
        this._renderMoney();

        if (this.playerNode) {
            this.playerNode.on('hp-changed', this._onHpChanged, this);
        } else {
            cc.warn('[PlayerHUD] 未綁定 playerNode，HP 不會更新');
        }
    }

    start() {
        // 為什麼初始化讀 HP 放在 start 不放在 onLoad？
        //   Cocos lifecycle：所有元件的 onLoad 先全跑完，才會跑所有元件的 start。
        //   PlayerHealth._hp 在 class 宣告時 = 0，要等 PlayerHealth.onLoad() 才會被設成 maxHp。
        //   如果這支元件的 onLoad 比 PlayerHealth.onLoad 早跑（節點順序決定），
        //   就會讀到 _hp = 0 → 畫面顯示「0 / 100」。
        //   放 start 保證 PlayerHealth.onLoad 一定跑過了，讀到的是正確初始值。
        if (!this.playerNode) return;
        const hp = this.playerNode.getComponent('PlayerHealth') as any;
        if (hp) this._renderHp(hp.hp, hp.maxHp);
    }

    onDestroy() {
        if (this.playerNode && this.playerNode.isValid) {
            this.playerNode.off('hp-changed', this._onHpChanged, this);
        }
    }

    // ── 公開 API（之後接金錢系統時呼叫） ─────────────────
    setMoney(amount: number) {
        this._money = Math.max(0, Math.floor(amount));
        this._renderMoney();
    }

    addMoney(delta: number) {
        this.setMoney(this._money + delta);
    }

    get money(): number { return this._money; }

    // ── 內部 ─────────────────────────────────────────────
    private _onHpChanged(data: { hp: number, maxHp: number, delta: number }) {
        if (!data) return;
        this._renderHp(data.hp, data.maxHp);
    }

    private _renderHp(hp: number, max: number) {
        const safeHp = Math.max(0, hp);
        const safeMax = Math.max(1, max);

        if (this.hpBar) {
            this.hpBar.progress = Math.min(1, safeHp / safeMax);
        }
        if (this.hpLabel) {
            this.hpLabel.string = this.hpFormat
                .replace('{hp}', String(safeHp))
                .replace('{max}', String(safeMax));
        }
    }

    private _renderMoney() {
        if (!this.moneyLabel) return;
        this.moneyLabel.string = this.moneyFormat.replace('{n}', String(this._money));
    }
}
