// BossHatWeakPoint — 帽子弱點受擊箱（被玩家子彈打到，雙倍傷害）
//
// 掛在 boss 底下的 hat 子節點上（帽子那張圖）。
// 該節點需有 PhysicsBoxCollider（勾 Is Sensor），group 設為 enemy。
//
// 與 BossBodyHurtBox 唯一的差別：呼叫 applyDamage 時 fromHat=true，
// 由 Boss 套用 hatDamageMultiplier 倍率（弱點 → 扣更多血）。
//
// 受擊箱（這個 + 身體）與攻擊箱（ScytheHitBox）是完全分開的節點與 collider。

const { ccclass, requireComponent } = cc._decorator;

@ccclass
@requireComponent(cc.PhysicsBoxCollider)
export default class BossHatWeakPoint extends cc.Component {

    private _boss: any = null;

    onLoad() {
        this._boss = this._findBoss();
    }

    /** Bullet.ts 撞到時會呼叫這個 */
    public takeDamage(damage: number, attacker?: cc.Node): boolean {
        if (!this._boss) this._boss = this._findBoss();
        if (!this._boss || typeof this._boss.applyDamage !== 'function') return false;
        return this._boss.applyDamage(damage, attacker, true);   // fromHat = true → 弱點倍率
    }

    private _findBoss(): any {
        let n = this.node.parent;
        while (n) {
            const b = n.getComponent('Boss');
            if (b) return b;
            n = n.parent;
        }
        return null;
    }
}
