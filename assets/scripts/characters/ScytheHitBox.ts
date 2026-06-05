// ScytheHitBox — Boss 攻擊判定箱（boss 打玩家用）
//
// 掛在 boss 底下的 scytheHitBox 子節點上。
// 該節點需有 PhysicsBoxCollider（勾 Is Sensor），且平常 active = false，
// 由 Boss 的動畫事件 enableHit / disableHit 開關。
//
// ── 跟著鐮刀位置變動 ──
//   這個節點的 position 由揮砍動畫逐幀 keyframe，
//   所以揮刀時攻擊箱會跟著刀尖跑（box2d collider 的 offset 不能逐幀動，但整個 node.position 可以）。
//
// 碰到 Player → 對 Player 的 PlayerHealth.takeDamage 扣血。
// 因為 sensor 重疊期間 onBeginContact 只觸發一次（進入時），
// 搭配動畫事件開關箱子，剛好「一次揮刀最多打一下」。
//
// 注意：這是「攻擊箱」，和身體/帽子的「受擊箱」是完全不同的節點與 collider。

const { ccclass, property, requireComponent } = cc._decorator;

@ccclass
@requireComponent(cc.PhysicsBoxCollider)
export default class ScytheHitBox extends cc.Component {

    @property({ tooltip: '揮中玩家造成的傷害（留 0 則沿用 Boss.attackDamage）' })
    damage: number = 0;

    private _boss: any = null;

    onLoad() {
        this._boss = this._findBoss();
    }

    onBeginContact(_contact: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        const otherNode = other.node;
        if (otherNode.name !== 'Player' && otherNode.group !== 'player') return;

        const hp: any = otherNode.getComponent('PlayerHealth');
        if (!hp || typeof hp.takeDamage !== 'function') return;

        let dmg = this.damage;
        if (dmg <= 0 && this._boss) dmg = this._boss.scytheDamage;
        if (dmg <= 0) dmg = 1;

        const attacker = this._boss ? this._boss.node : this.node;
        hp.takeDamage(dmg, attacker);
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
