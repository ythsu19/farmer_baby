const { ccclass, property } = cc._decorator;

/**
 * 玩家血量文字顯示。
 * 掛在一個 Label 節點上，綁定玩家節點，
 * 監聽 PlayerHealth 發出的 'hp-changed' 事件即時更新。
 *
 * 注意：main 的 PlayerHealth 發的 'hp-changed' 帶的是物件 { hp, maxHp, delta }，
 * 不是單一數字。
 */
@ccclass
export default class PlayerHpLabel extends cc.Component {

    @property({ type: cc.Node, tooltip: "玩家節點（掛有 PlayerHealth）" })
    playerNode: cc.Node = null;

    @property({ type: cc.Label, tooltip: "顯示血量的 Label；留空則抓自己節點上的 Label" })
    label: cc.Label = null;

    onLoad() {
        if (!this.label) this.label = this.getComponent(cc.Label);

        if (this.playerNode) {
            // PlayerHealth 受傷/補血時 emit('hp-changed', { hp, maxHp, delta })
            this.playerNode.on('hp-changed', this.onHpChanged, this);

            // 初始顯示目前血量（從 PlayerHealth 讀）
            const hp = this.playerNode.getComponent('PlayerHealth') as any;
            if (hp) this.render(hp.hp, hp.maxHp);
        } else {
            cc.warn("【PlayerHpLabel】未綁定 playerNode");
        }
    }

    onDestroy() {
        if (this.playerNode && this.playerNode.isValid) {
            this.playerNode.off('hp-changed', this.onHpChanged, this);
        }
    }

    private onHpChanged(data: { hp: number, maxHp: number, delta: number }) {
        if (!data) return;
        this.render(data.hp, data.maxHp);
    }

    private render(hp: number, max: number) {
        if (!this.label) return;
        this.label.string = `HP  ${Math.max(0, hp)} / ${max}`;
    }
}
