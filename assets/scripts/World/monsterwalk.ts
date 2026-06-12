const { ccclass, property } = cc._decorator;

@ccclass
export default class Monster extends cc.Component {

    @property({ tooltip: '怪物的移動速度' })
    moveSpeed: number = 100;

    @property({ tooltip: '巡邏範圍的單側最大距離，以起點為中心向左右巡邏' })
    patrolDistance: number = 150;

    @property({ tooltip: '怪物的最大血量' })
    maxHealth: number = 3;

    @property({ tooltip: '受擊/擊退動畫的持續時間，秒' })
    knockbackDuration: number = 0.5;

    @property({ tooltip: '被擊退時的後退速度' })
    knockbackSpeed: number = 150;

    private currentHealth: number = 0;
    private rb: cc.RigidBody = null;
    private anim: cc.Animation = null;

    private moveDirection: number = -1;
    private startX: number = 0;

    private isDead: boolean = false;
    private isKnockedBack: boolean = false;

    onLoad() {
        cc.director.getPhysicsManager().enabled = true;

        this.currentHealth = this.maxHealth;
        this.rb = this.getComponent(cc.RigidBody);
        this.anim = this.getComponent(cc.Animation);
    }

    start() {
        if (this.rb) {
            this.rb.fixedRotation = true;
        }

        // 記錄怪物一開始的位置，之後以這個位置為中心巡邏
        this.startX = this.node.x;

        if (this.anim && !this.isDead && !this.isKnockedBack) {
            this.anim.play('onion_walk');
        }
    }

    update(dt: number) {
        if (!this.rb) return;
        if (this.isDead || this.isKnockedBack) return;

        const currentX = this.node.x;

        // 到左邊界，改往右
        if (this.moveDirection === -1 && currentX <= this.startX - this.patrolDistance) {
            this.moveDirection = 1;
        }

        // 到右邊界，改往左
        else if (this.moveDirection === 1 && currentX >= this.startX + this.patrolDistance) {
            this.moveDirection = -1;
        }

        // 用物理速度移動
        const velocity = this.rb.linearVelocity;
        velocity.x = this.moveDirection * this.moveSpeed;
        this.rb.linearVelocity = velocity;

        this.updateFacingDirection();
    }

    onBeginContact(
        contact: cc.PhysicsContact,
        selfCollider: cc.PhysicsCollider,
        otherCollider: cc.PhysicsCollider
    ) {
        if (this.isDead) return;

        const otherNodeName = otherCollider.node.name;

        // 撞到牆就轉向
        if (otherNodeName === 'wall' || otherCollider.tag === 1) {
            if (!this.isKnockedBack) {
                this.moveDirection *= -1;
            }
        }

        // 被玩家子彈打到
        if (otherNodeName === 'Bullet') {
            const bulletNode = otherCollider.node;

            const bulletWorldPos = bulletNode.convertToWorldSpaceAR(cc.v2(0, 0));
            const monsterWorldPos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));

            const knockbackDir = monsterWorldPos.x >= bulletWorldPos.x ? 1 : -1;

            bulletNode.destroy();

            this.takeDamage(1, knockbackDir);
        }
    }

    public takeDamage(damage: number, knockbackDir: number = 0) {
        if (this.isDead) return;

        this.currentHealth -= damage;
        console.log(`怪物受傷，扣除 ${damage} 滴血，剩餘血量: ${this.currentHealth}`);

        if (this.currentHealth <= 0) {
            this.die();
        } else {
            this.playKnockback(knockbackDir);
        }
    }

    private playKnockback(knockbackDir: number = 0) {
        if (this.isDead) return;

        this.isKnockedBack = true;

        if (this.rb) {
            const finalDir = knockbackDir !== 0 ? knockbackDir : -this.moveDirection;
            this.rb.linearVelocity = cc.v2(finalDir * this.knockbackSpeed, this.rb.linearVelocity.y);
        }

        if (this.anim) {
            this.anim.play('onion_knockback');
        }

        this.scheduleOnce(() => {
            if (!this.isDead) {
                this.isKnockedBack = false;

                if (this.rb) {
                    this.rb.linearVelocity = cc.v2(0, this.rb.linearVelocity.y);
                }

                if (this.anim) {
                    this.anim.play('onion_walk');
                }
            }
        }, this.knockbackDuration);
    }

    private die() {
        if (this.isDead) return;

        this.isDead = true;
        console.log("怪物死亡");

        this.scheduleOnce(() => {
            if (this.rb) {
                this.rb.linearVelocity = cc.v2(0, 0);
                this.rb.type = cc.RigidBodyType.Static;
            }

            const collider = this.getComponent(cc.PhysicsCollider);
            if (collider) {
                collider.sensor = true;
                collider.apply();
            }

            if (this.anim) {
                this.anim.play('onion_death');
            }

            this.scheduleOnce(() => {
                if (this.node.isValid) {
                    this.node.destroy();
                }
            }, 1.0);
        }, 0);
    }

    private updateFacingDirection() {
        this.node.scaleX = this.moveDirection * Math.abs(this.node.scaleX);
    }
}