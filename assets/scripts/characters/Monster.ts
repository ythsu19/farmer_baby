const { ccclass, property } = cc._decorator;

@ccclass
export default class Monster extends cc.Component {

    @property({ tooltip: '怪物的移動速度' })
    moveSpeed: number = 100;

    @property({ tooltip: '巡邏範圍的單側最大距離 (以起點為中心向左右巡邏)' })
    patrolDistance: number = 150; // ★ 新增：設定巡邏範圍

    @property({ tooltip: '怪物的最大血量' })
    maxHealth: number = 10;

    @property({ tooltip: '碰撞時對玩家造成的傷害' })
    attackDamage: number = 1;

    private currentHealth: number = 0;
    private rb: cc.RigidBody = null;
    private moveDirection: number = -1; // -1 表示向左，1 表示向右
    
    private startX: number = 0; // ★ 新增：用來記錄怪物的出生初始位置

    onLoad() {
        cc.director.getPhysicsManager().enabled = true;
        this.currentHealth = this.maxHealth;
        this.rb = this.getComponent(cc.RigidBody);
    }

    start() {
        if (this.rb) {
            this.rb.fixedRotation = true;
        }
        
        // ★ 遊戲開始時，記錄怪物一開始的 X 座標
        this.startX = this.node.x;
    }

    update(dt: number) {
        if (!this.rb) return;

        // ★ 核心邏輯：檢查是否超出巡邏範圍
        let currentX = this.node.x;
        
        // 如果正在向左走，且目前座標小於「起點減去巡邏距離」 (到達左邊界)
        if (this.moveDirection === -1 && currentX <= this.startX - this.patrolDistance) {
            this.moveDirection = 1; // 轉向右
        } 
        // 如果正在向右走，且目前座標大於「起點加上巡邏距離」 (到達右邊界)
        else if (this.moveDirection === 1 && currentX >= this.startX + this.patrolDistance) {
            this.moveDirection = -1; // 轉向左
        }

        // 設置水平移動速度，保持垂直速度不變
        let velocity = this.rb.linearVelocity;
        velocity.x = this.moveDirection * this.moveSpeed;
        this.rb.linearVelocity = velocity;

        // 翻轉怪物面向
        this.updateFacingDirection();
    }

    onBeginContact(contact: cc.PhysicsContact, selfCollider: cc.PhysicsCollider, otherCollider: cc.PhysicsCollider) {
        const otherNodeName = otherCollider.node.name;

        // 如果中途撞到牆壁或其他怪物，依然可以提早回頭 (保留之前的邏輯)
        if (otherNodeName === 'wall' || otherCollider.tag === 1) {
            this.moveDirection *= -1;
        }

        // 碰到玩家
        if (otherNodeName === 'Player') {
            console.log("打中玩家了！造成傷害：" + this.attackDamage);
        }
    }

    public takeDamage(damage: number) {
        this.currentHealth -= damage;
        console.log(`怪物受傷，剩餘血量: ${this.currentHealth}`);
        if (this.currentHealth <= 0) {
            this.die();
        }
    }

    private die() {
        console.log("怪物死亡！");
        this.node.destroy();
    }

    private updateFacingDirection() {
        this.node.scaleX = -this.moveDirection * Math.abs(this.node.scaleX);
    }
}