// BossBodyHurtBox — Boss 身體受擊箱（被玩家子彈打到）
//
// 掛在 boss 底下的 bodyHurtBox 子節點上。
// 該節點需有一個物理碰撞器（PhysicsPolygonCollider 多邊形 / 或 PhysicsBoxCollider，
// 都勾 Is Sensor），group 設為 enemy。身體輪廓不規則可用多邊形貼合。
//
// 子彈(Bullet.ts)撞到會找對方的 takeDamage(damage, attacker) 介面。
// 因為受擊箱是「子節點」而不是根節點，子彈撞到的是這個子節點，
// 所以本元件實作 takeDamage，再轉呼叫上層 Boss.applyDamage（普通傷害）。
//
// 為什麼受擊箱要拆成子節點？
//   因為帽子是獨立弱點（另一個子節點），身體與帽子要分開判定，
//   各自一個 collider 子節點才能用不同倍率扣血。

// （不用 @requireComponent 限定碰撞器型別 → box / polygon 都能掛。）

const { ccclass } = cc._decorator;

@ccclass
export default class BossBodyHurtBox extends cc.Component {

    private _boss: any = null;

    onLoad() {
        this._boss = this._findBoss();
    }

    /** Bullet.ts 撞到時會呼叫這個 */
    public takeDamage(damage: number, attacker?: cc.Node): boolean {
        if (!this._boss) this._boss = this._findBoss();
        if (!this._boss || typeof this._boss.applyDamage !== 'function') return false;
        return this._boss.applyDamage(damage, attacker, false);
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
