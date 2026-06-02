// Damager — 接觸到玩家就對玩家造成傷害（陷阱 / 接觸傷害敵人共用）
//
// 用法：
//   - 掛在 enemy 群組的節點上（陷阱、刺、接觸型怪物）
//   - 節點要有 cc.RigidBody（Static 即可）+ cc.PhysicsBoxCollider（solid 或 sensor 都行）
//   - 跟 player 接觸時自動找對方 PlayerHealth 呼叫 takeDamage
//
// 模式：
//   continuous = false（預設）→ 只在接觸瞬間打一次（適合刺、地雷）
//   continuous = true          → 接觸期間每幀嘗試傷害（適合火坑、酸池；
//                                 受 PlayerHealth 無敵冷卻自然節流，每 ~0.8s 才會真扣血）

const { ccclass, property, requireComponent } = cc._decorator;

@ccclass
@requireComponent(cc.RigidBody)
export default class Damager extends cc.Component {

    @property({ displayName: '傷害' })
    damage: number = 10;

    @property({ displayName: '持續傷害', tooltip: '勾起 → 站在上面持續被打（受 PlayerHealth 無敵節流）；不勾 → 接觸瞬間只打一次' })
    continuous: boolean = false;

    private _contacts: Set<cc.Node> = new Set();

    onLoad() {
        const rb = this.getComponent(cc.RigidBody);
        rb.enabledContactListener = true;
    }

    onBeginContact(_c: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        if (other.node.group !== 'player') return;
        this._contacts.add(other.node);
        this._tryDamage(other.node);
    }

    onEndContact(_c: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        this._contacts.delete(other.node);
    }

    update() {
        if (!this.continuous) return;
        this._contacts.forEach((n) => this._tryDamage(n));
    }

    private _tryDamage(playerNode: cc.Node) {
        const hp: any = playerNode.getComponent('PlayerHealth');
        if (hp && typeof hp.takeDamage === 'function') {
            hp.takeDamage(this.damage, this.node);
        }
    }
}
