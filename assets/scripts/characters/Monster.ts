
import OnionBullet from './OnionBullet';
const { ccclass, property } = cc._decorator;

@ccclass
export default class Monster extends cc.Component {

    @property({ tooltip: '怪物的移動速度' })
    moveSpeed: number = 100;

    @property({ tooltip: '巡邏範圍的單側最大距離 (以起點為中心向左右巡邏)' })
    patrolDistance: number = 150;

    @property({ tooltip: '怪物的最大血量' })
    maxHealth: number = 3; 

    @property({ tooltip: '碰撞時對玩家造成的傷害' })
    attackDamage: number = 1;

    @property({ tooltip: '偵測玩家的距離 (視野範圍)' })
    detectDistance: number = 200;

    @property({ tooltip: '每次攻擊的持續時間 (秒)' })
    attackDuration: number = 1.0; 

    @property({ tooltip: '受擊/擊退動畫的持續時間 (秒)' })
    knockbackDuration: number = 0.5; 

    @property({ tooltip: '被擊退時的後退速度' })
    knockbackSpeed: number = 150;

    // ★ 新增 1：引入子彈的預製體 (Prefab)
    @property({ type: cc.Prefab, tooltip: '要發射的子彈(催淚彈) Prefab' })
    bulletPrefab: cc.Prefab = null;

    // ★ 新增 2：設定子彈生成的相對位置
    @property({ tooltip: '子彈生成的 X 軸偏移量 (離怪物多遠生成)' })
    bulletSpawnOffsetX: number = 40;
    
    @property({ tooltip: '子彈發射的延遲時間(秒)，配合動畫吐出氣體的瞬間' })
    fireDelay: number = 0.3;

    private currentHealth: number = 0;
    private rb: cc.RigidBody = null;
    private anim: cc.Animation = null; 
    private moveDirection: number = -1;
    
    private startX: number = 0;
    
    private isAttacking: boolean = false;
    private isDead: boolean = false; 
    private isKnockedBack: boolean = false; 
    private playerNode: cc.Node = null;

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
        
        this.startX = this.node.x;

        this.playerNode = cc.find('Player') || cc.find('Canvas/Player');
        if (!this.playerNode) {
            console.warn("Monster 找不到 Player 節點，請確認玩家節點名稱是否為 'Player'");
        }
        
        if (this.anim && !this.isAttacking && !this.isDead && !this.isKnockedBack) {
            this.anim.play('onion_walk');
        }
    }

    update(dt: number) {
        if (!this.rb) return;

        if (this.isDead || this.isKnockedBack) return;

        if (this.isAttacking) return; 

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
        if (!this.playerNode || this.isDead || this.isKnockedBack) return;

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
        if (this.isDead || this.isKnockedBack) return;
        
        this.isAttacking = true;

        if (this.rb) {
            this.rb.linearVelocity = cc.v2(0, this.rb.linearVelocity.y);
        }

        if (this.anim) {
            this.anim.play('onion_attack');
        }

        // ★ 新增 3：設定計時器，延遲發射子彈 (配合動畫動作)
        this.scheduleOnce(() => {
            // 確保要發射時，怪物沒有死掉也沒有被擊退中斷
            if (!this.isDead && !this.isKnockedBack) {
                this.fireBullet();
            }
        }, this.fireDelay);

        this.scheduleOnce(() => {
            if (!this.isDead && !this.isKnockedBack) { 
                this.endAttack();
            }
        }, this.attackDuration);
    }

    // ★ 新增 4：發射子彈的核心邏輯
    private fireBullet() {
        if (!this.bulletPrefab) {
            console.warn("未綁定子彈 Prefab！");
            return;
        }

        // 1. 生成子彈實體
        let bulletNode = cc.instantiate(this.bulletPrefab);
        
        // 2. 將子彈設為怪物父節點的子節點 (通常是 Canvas 或某個場景節點)
        // 注意：千萬不要把子彈設為怪物的子節點，否則怪物回頭子彈會跟著回頭！
        bulletNode.parent = this.node.parent;

        // 3. 計算生成位置 (怪物當前位置 + 面朝方向的偏移量)
        let spawnX = this.node.x + (this.moveDirection * this.bulletSpawnOffsetX);
        let spawnY = this.node.y; // 如果氣體是從嘴巴出來，可以在這裡微調 Y 軸 (例如 this.node.y + 10)
        bulletNode.setPosition(spawnX, spawnY);

        // 4. 初始化子彈方向
        let bulletScript = bulletNode.getComponent(OnionBullet); // 這裡不用加引號
        if (bulletScript) {
            bulletScript.init(this.moveDirection);
        }
    }

    private endAttack() {
        this.isAttacking = false;
        if (this.anim && !this.isDead && !this.isKnockedBack) {
            this.anim.play('onion_walk');
        }
    }

    onBeginContact(contact: cc.PhysicsContact, selfCollider: cc.PhysicsCollider, otherCollider: cc.PhysicsCollider) {
        if (this.isDead) return;

        const otherNodeName = otherCollider.node.name;

        if (otherNodeName === 'wall' || otherCollider.tag === 1) {
            if (!this.isAttacking && !this.isKnockedBack) {
                this.moveDirection *= -1;
            }
        }

        if (otherNodeName === 'Player') {
            console.log("碰到玩家實體！造成碰撞傷害：" + this.attackDamage);
        }

        if (otherNodeName === 'Bullet') {
            let bulletNode = otherCollider.node;

            // ★ 計算世界座標，判斷擊退方向
            let bulletWorldPos = bulletNode.convertToWorldSpaceAR(cc.v2(0, 0));
            let monsterWorldPos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));
            
            let knockbackDir = monsterWorldPos.x >= bulletWorldPos.x ? 1 : -1;

            otherCollider.node.destroy(); 
            
            // ★ 將方向參數帶入
            this.takeDamage(1, knockbackDir); 
        }
    }

    // ★ 接收方向參數
    public takeDamage(damage: number, knockbackDir: number = 0) {
        if (this.isDead) return; 

        this.currentHealth -= damage;
        console.log(`怪物受傷，扣除 ${damage} 滴血，剩餘血量: ${this.currentHealth}`);
        
        if (this.currentHealth <= 0) {
            this.die();
        } else {
            // ★ 將方向參數傳入擊退函式
            this.playKnockback(knockbackDir);
        }
    }

    // ★ 接收方向參數並套用物理表現
    private playKnockback(knockbackDir: number = 0) {
        if (this.isDead) return;
        
        this.isKnockedBack = true;
        this.isAttacking = false; 

        if (this.rb) {
            let finalDir = knockbackDir !== 0 ? knockbackDir : -this.moveDirection;
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

        console.log("怪物死亡！等待物理引擎解鎖...");

        this.scheduleOnce(() => {
            if (this.rb) {
                this.rb.linearVelocity = cc.v2(0, 0);
                this.rb.type = cc.RigidBodyType.Static; 
            }

            let collider = this.getComponent(cc.PhysicsCollider);
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