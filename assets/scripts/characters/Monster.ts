const { ccclass, property } = cc._decorator;

@ccclass
export default class Monster extends cc.Component {

    @property({ tooltip: '怪物的移動速度' })
    moveSpeed: number = 100;

    @property({ tooltip: '巡邏範圍的單側最大距離 (以起點為中心向左右巡邏)' })
    patrolDistance: number = 150;

    @property({ tooltip: '怪物的最大血量' })
    maxHealth: number = 10;

    @property({ tooltip: '碰撞時對玩家造成的傷害' })
    attackDamage: number = 1;

    @property({ tooltip: '偵測玩家的距離 (視野範圍)' })
    detectDistance: number = 200;

    @property({ tooltip: '每次攻擊的持續時間 (秒)，建議與攻擊動畫的長度一致' })
    attackDuration: number = 1.0; 

    private currentHealth: number = 0;
    private rb: cc.RigidBody = null;
    private anim: cc.Animation = null; // ★ 新增：用來控制動畫的變數
    private moveDirection: number = -1;
    
    private startX: number = 0;
    
    private isAttacking: boolean = false;
    private playerNode: cc.Node = null;

    onLoad() {
        cc.director.getPhysicsManager().enabled = true;
        this.currentHealth = this.maxHealth;
        this.rb = this.getComponent(cc.RigidBody);
        
        // ★ 獲取節點上的 Animation 組件
        this.anim = this.getComponent(cc.Animation);
    }

    start() {
        if (this.rb) {
            this.rb.fixedRotation = true;
        }
        
        this.startX = this.node.x;

        this.playerNode = cc.find('Player') || cc.find('Canvas/Player');
        if (!this.playerNode) {
            console.warn("Monster 找不到 Player 節點，請確認玩家節點名稱是否為 'Player'");
        }
        
        // 確保遊戲開始時播放走路動畫 (因為你截圖有勾選 Play On Load，這步為雙重保險)
        if (this.anim && !this.isAttacking) {
            this.anim.play('onion_walk');
        }
    }

    update(dt: number) {
        if (!this.rb) return;

        if (this.isAttacking) {
            return; 
        }

        this.checkPlayerInSight();

        if (this.isAttacking) return;

        let currentX = this.node.x;
        
        if (this.moveDirection === -1 && currentX <= this.startX - this.patrolDistance) {
            this.moveDirection = 1; 
        } 
        else if (this.moveDirection === 1 && currentX >= this.startX + this.patrolDistance) {
            this.moveDirection = -1; 
        }

        let velocity = this.rb.linearVelocity;
        velocity.x = this.moveDirection * this.moveSpeed;
        this.rb.linearVelocity = velocity;

        this.updateFacingDirection();
    }

    private checkPlayerInSight() {
        if (!this.playerNode) return;

        let dx = this.playerNode.x - this.node.x;
        let dy = this.playerNode.y - this.node.y;

        if (Math.abs(dy) > 50) return; 

        let canSeePlayer = false;
        
        if (this.moveDirection === 1 && dx > 0 && dx <= this.detectDistance) {
            canSeePlayer = true;
        }
        else if (this.moveDirection === -1 && dx < 0 && Math.abs(dx) <= this.detectDistance) {
            canSeePlayer = true;
        }

        if (canSeePlayer) {
            this.startAttack();
        }
    }

    private startAttack() {
        this.isAttacking = true;
        console.log("發現玩家！發動攻擊！");

        if (this.rb) {
            this.rb.linearVelocity = cc.v2(0, this.rb.linearVelocity.y);
        }

        // ★ 播放攻擊動畫 (填入截圖中設定的 Clip 名稱)
        if (this.anim) {
            this.anim.play('onion_attack');
        }

        this.scheduleOnce(() => {
            this.endAttack();
        }, this.attackDuration);
    }

    private endAttack() {
        this.isAttacking = false;
        console.log("攻擊結束，恢復巡邏");
        
        // ★ 攻擊結束後，切換回走路動畫
        if (this.anim) {
            this.anim.play('onion_walk');
        }
    }

    onBeginContact(contact: cc.PhysicsContact, selfCollider: cc.PhysicsCollider, otherCollider: cc.PhysicsCollider) {
        const otherNodeName = otherCollider.node.name;

        if (otherNodeName === 'wall' || otherCollider.tag === 1) {
            if (!this.isAttacking) {
                this.moveDirection *= -1;
            }
        }

        if (otherNodeName === 'Player') {
            console.log("碰到玩家實體！造成碰撞傷害：" + this.attackDamage);
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
        this.node.scaleX = this.moveDirection * Math.abs(this.node.scaleX);
    }
}