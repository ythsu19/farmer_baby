const { ccclass, property } = cc._decorator;

/**
 * 玩家血量文字顯示。
 * 掛在一個 Label 節點上，綁定玩家節點，監聽 'hp-changed' 事件即時更新。
 *
 * 相容兩種血量元件（專案目前並存）：
 *   - PlayerHealth     emit('hp-changed', { hp, maxHp, delta })
 *   - PlayerController emit('hp-changed', hp)   ← 只帶數字，不帶 maxHp
 *
 * maxHp 在 onLoad 從玩家節點上的血量元件讀一次快取起來，
 * 之後就算事件只帶數字也能正確顯示分母。
 */
@ccclass
export default class PlayerHpLabel extends cc.Component {

    @property({ type: cc.Node, tooltip: "玩家節點（掛有 PlayerHealth 或 PlayerController）" })
    playerNode: cc.Node = null;

    @property({ type: cc.Label, tooltip: "顯示血量的 Label；留空則抓自己節點上的 Label" })
    label: cc.Label = null;

    private _maxHp: number = 0;

    onLoad() {
        if (!this.label) this.label = this.getComponent(cc.Label);

        if (!this.playerNode) {
            cc.warn("【PlayerHpLabel】未綁定 playerNode");
            return;
        }

        this.playerNode.on('hp-changed', this.onHpChanged, this);

        // 從玩家身上的血量元件讀初始 hp / maxHp（兩種元件都有 hp、maxHp）
        const hpComp = this.readHpComponent();
        if (hpComp) {
            this._maxHp = hpComp.maxHp;
            this.render(hpComp.hp, this._maxHp);
        } else {
            cc.warn("【PlayerHpLabel】playerNode 上找不到血量元件（PlayerHealth / PlayerController）");
        }
    }

    onDestroy() {
        if (this.playerNode && this.playerNode.isValid) {
            this.playerNode.off('hp-changed', this.onHpChanged, this);
        }
    }

    /** 不寫死元件名稱：依序找已知的血量元件 */
    private readHpComponent(): { hp: number, maxHp: number } | null {
        const names = ['PlayerHealth', 'PlayerController'];
        for (let i = 0; i < names.length; i++) {
            const c = this.playerNode.getComponent(names[i]) as any;
            if (c && typeof c.hp === 'number' && typeof c.maxHp === 'number') return c;
        }
        return null;
    }

    /** hp-changed 可能帶純數字（PlayerController）或物件（PlayerHealth） */
    private onHpChanged(data: number | { hp: number, maxHp: number, delta: number }) {
        if (typeof data === 'number') {
            this.render(data, this._maxHp);
        } else if (data && typeof data.hp === 'number') {
            if (typeof data.maxHp === 'number') this._maxHp = data.maxHp;
            this.render(data.hp, this._maxHp);
        }
    }

    private render(hp: number, max: number) {
        if (!this.label) return;
        this.label.string = `HP  ${Math.max(0, hp)} / ${max}`;
    }
}
