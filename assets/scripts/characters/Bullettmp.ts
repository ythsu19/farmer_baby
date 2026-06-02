const { ccclass, property } = cc._decorator;

@ccclass
export default class Bullet extends cc.Component {

    @property({ displayName: '速度' })
    speed: number = 600;

    @property({ displayName: '傷害' })
    damage: number = 20;

    @property({ displayName: '存活時間（秒）' })
    lifetime: number = 2.0;

    @property({ displayName: '最大射程（像素）' })
    maxRange: number = 1000;

    private _dir: number    = 1;
    private _timer: number  = 0;
    private _startX: number = 0;
    private _pool: cc.NodePool = null;

    init(dir: number, pool: cc.NodePool) {
        this._dir    = dir;
        this._pool   = pool;
        this._timer  = 0;
        this._startX = this.node.x;
        this.node.scaleX = dir;
    }

    update(dt: number) {
        this._timer  += dt;
        this.node.x  += this.speed * this._dir * dt;

        const expired    = this._timer >= this.lifetime;
        const outOfRange = Math.abs(this.node.x - this._startX) >= this.maxRange;
        if (expired || outOfRange) this._recycle();
    }

    onCollisionEnter(other: cc.Collider, self: cc.Collider) {
        if (other.node.group === 'player') return;

        const enemy = other.node.getComponent('EnemyBase') as any;
        if (enemy?.takeDamage) enemy.takeDamage(this.damage);

        this._recycle();
    }

    private _recycle() {
        this.node.active = false;
        if (this._pool) this._pool.put(this.node);
        else            this.node.destroy();
    }
}
