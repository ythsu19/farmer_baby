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

    @property({ type: cc.Prefab, tooltip: '要發射的子彈(催淚彈) Prefab' })
    bulletPrefab: cc.Prefab = null;

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
    public isDead: boolean = false; 
    private isKnockedBack: boolean = false;
    private players: cc.Node[] = [];

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
        
        // 確保不是從池子復活時才記錄初始 X
        if (this.startX === 0) {
            this.startX = this.node.x;
        }

        let p1 = cc.find('Player1') || cc.find('Canvas/Player1');
        let p2 = cc.find('Player2') || cc.find('Canvas/Player2');
        
        if (p1) this.players.push(p1);
        if (p2) this.players.push(p2);

        if (this.players.length === 0) {
            console.warn("Monster 找不到 Player1 或 Player2，請確認節點名稱是否正確！");
        }
        
        if (this.anim && !this.isAttacking && !this.isDead && !this.isKnockedBack) {
            this.anim.play('onion_walk');
        }
    }

    // =========================================================================
    // ★ 最強制復活 init 函式 (由 Manager 撈出節點時手動呼叫)
    // =========================================================================
    public initFromPool(spawnX: number) {
        console.log(`✨ 怪物 ${this.node.name} 正在進行記憶洗腦復活...`);

        this.currentHealth = this.maxHealth;
        this.isDead = false;
        this.isAttacking = false;
        this.isKnockedBack = false;
        this.moveDirection = -1; 
        
        this.startX = spawnX; 

        if (this.rb) {
            this.rb.linearVelocity = cc.v2(0, 0);
            
            // 延遲一幀保險，確保剛體順利解鎖為 Dynamic
            this.scheduleOnce(() => {
                if (this.rb && cc.isValid(this.rb.node)) {
                    this.rb.type = cc.RigidBodyType.Dynamic; 
                    console.log(`🦾 怪物 ${this.node.name} 剛體已成功解鎖為 Dynamic`);
                }
            }, 0);
        }

        let collider = this.getComponent(cc.PhysicsCollider);
        if (collider) {
            collider.sensor = false; 
            collider.apply(); 
        }

        this.node.opacity = 255; 
        this.node.scaleX = Math.abs(this.node.scaleX) * this.moveDirection; 

        if (this.anim) {
            this.anim.stop(); 
            this.anim.play('onion_walk');
        }
    }
    // =========================================================================

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
        if (this.players.length === 0 || this.isDead || this.isKnockedBack) return;

        let canSeePlayer = false;
        let monsterWorldPos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));

        for (let i = 0; i < this.players.length; i++) {
            let player = this.players[i];
            if (!player || !player.isValid) continue;

            let playerWorldPos = player.convertToWorldSpaceAR(cc.v2(0, 0));
            let dx = playerWorldPos.x - monsterWorldPos.x;
            let dy = playerWorldPos.y - monsterWorldPos.y;

            if (Math.abs(dy) > 80) continue; 

            if (this.moveDirection === 1 && dx > 0 && dx <= this.detectDistance) {
                canSeePlayer = true;
                break; 
            }
            else if (this.moveDirection === -1 && dx < 0 && Math.abs(dx) <= this.detectDistance) {
                canSeePlayer = true;
                break; 
            }
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

        this.scheduleOnce(() => {
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

    private fireBullet() {
        if (!this.bulletPrefab) return;

        let bulletNode = cc.instantiate(this.bulletPrefab);
        bulletNode.parent = this.node.parent;

        let spawnX = this.node.x + (this.moveDirection * this.bulletSpawnOffsetX);
        let spawnY = this.node.y; 
        bulletNode.setPosition(spawnX, spawnY);

        let bulletScript = bulletNode.getComponent(OnionBullet); 
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

        if (otherNodeName === 'Player1' || otherNodeName === 'Player2') {
            const ph = otherCollider.node.getComponent('PlayerHealth') as any;
            if (ph) ph.takeDamage(this.attackDamage, this.node);
        }

        if (otherNodeName === 'Bullet') {
            let bulletNode = otherCollider.node;
            let bulletWorldPos = bulletNode.convertToWorldSpaceAR(cc.v2(0, 0));
            let monsterWorldPos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));
            let knockbackDir = monsterWorldPos.x >= bulletWorldPos.x ? 1 : -1;

            this.scheduleOnce(() => {
                if (bulletNode.isValid) {
                    bulletNode.destroy(); 
                }
            }, 0);
            
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
        this.isAttacking = false; 

        this.scheduleOnce(() => {
            if (this.rb && !this.isDead) {
                let finalDir = knockbackDir !== 0 ? knockbackDir : -this.moveDirection;
                this.rb.linearVelocity = cc.v2(finalDir * this.knockbackSpeed, this.rb.linearVelocity.y);
            }
        }, 0);

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
                    let manager = cc.find('Canvas').getComponent('MonsterManager') as any;
                    if (manager && typeof manager.recycleMonster === 'function') {
                        manager.recycleMonster(this.node);
                    } else {
                        this.node.destroy(); 
                    }
                }
            }, 1.0); 
        }, 0); 
    }

    private updateFacingDirection() {
        this.node.scaleX = this.moveDirection * Math.abs(this.node.scaleX);
    }
}