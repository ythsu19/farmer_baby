const { ccclass, property } = cc._decorator;

// 類別名沿用 EnemyBase，讓 Bullet 的 getComponent('EnemyBase') 也能打到小怪
// 注意：因為 BossWeakPoint 也用 EnemyBase 這個名字，cc 同個專案不能有兩個同名 ccclass
// 所以這裡用 BossMinion 當 class name，但提供 takeDamage 給 Bullet 透過 getComponent('BossMinion') 抓
// → 比較簡單的做法：改 Bullet 找 'EnemyBase' OR 'BossMinion'，但暫時先讓小怪也走 EnemyBase 機制
// 解法：小怪繼承不存在的問題 — 我們改 Bullet 那邊用 duck typing 找 takeDamage 即可（後續優化）
@ccclass
export default class BossMinion extends cc.Component {

    @property({ type: cc.Integer, tooltip: "小怪血量" })
    maxHp: number = 30;

    @property({ type: cc.Float, tooltip: "移動速度" })
    speed: number = 120;

    @property({ type: cc.Integer, tooltip: "撞到玩家造成的傷害" })
    contactDamage: number = 10;

    @property({ tooltip: "玩家所在的 group name（碰撞時比對）" })
    playerGroup: string = "player";

    private currentHp: number = 0;
    private playerNode: cc.Node = null;

    onLoad() {
        this.currentHp = this.maxHp;
        // 找場上的 Player 節點。專案規則禁止 cc.find，所以用 group 搜尋
        // 簡化：假設 Player 在同層或可由 Manager 注入。先用全場掃描當佔位，之後改注入
        const scene = cc.director.getScene();
        if (scene) {
            this.playerNode = this.findByGroup(scene, this.playerGroup);
        }
    }

    private findByGroup(root: cc.Node, group: string): cc.Node {
        if (root.group === group) return root;
        for (const c of root.children) {
            const found = this.findByGroup(c, group);
            if (found) return found;
        }
        return null;
    }

    update(dt: number) {
        if (!this.playerNode || !cc.isValid(this.playerNode)) return;
        // 朝玩家走
        const dx = this.playerNode.x - this.node.x;
        const dy = this.playerNode.y - this.node.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1) {
            this.node.x += (dx / len) * this.speed * dt;
            this.node.y += (dy / len) * this.speed * dt;
        }
    }

    // box2d 物理碰撞（main 已全面改用 box2d；舊的 onCollisionEnter 不會觸發）
    onBeginContact(_contact: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        if (other.node.group === this.playerGroup) {
            // main 玩家血量由 PlayerHealth 管（簽名 takeDamage(damage, attacker?)）
            const hp = other.node.getComponent("PlayerHealth") as any;
            if (hp?.takeDamage) hp.takeDamage(this.contactDamage, this.node);
        }
    }

    // _attacker 由子彈傳入；此處用不到但保留以對齊介面
    takeDamage(damage: number, _attacker?: cc.Node) {
        this.currentHp -= damage;
        if (this.currentHp <= 0) this.node.destroy();
    }
}
