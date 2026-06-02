const { ccclass, property } = cc._decorator;
import Bullet from './Bullet';

@ccclass
export default class PlayerShooter extends cc.Component {

    @property(cc.Prefab)
    bulletPrefab: cc.Prefab = null;

    @property({ displayName: '子彈生成 X 偏移' })
    spawnOffsetX: number = 40;

    @property({ displayName: '子彈生成 Y 偏移' })
    spawnOffsetY: number = 0;

    @property({ displayName: '物件池大小', min: 1 })
    poolSize: number = 10;

    private _pool: cc.NodePool = null;

    onLoad() {
        cc.director.getCollisionManager().enabled = true;

        this._pool = new cc.NodePool();

        if (this.bulletPrefab) {
            for (let i = 0; i < this.poolSize; i++) {
                this._pool.put(cc.instantiate(this.bulletPrefab));
            }
        }

        this.node.on('shoot', this._onShoot, this);
    }

    onDestroy() {
        this.node.off('shoot', this._onShoot, this);
        this._pool.clear();
    }

    private _onShoot(data: { facingRight: boolean }) {
        if (!this.bulletPrefab) return;

        const dir  = data.facingRight ? 1 : -1;
        const node = this._pool.size() > 0
            ? this._pool.get()
            : cc.instantiate(this.bulletPrefab);

        node.parent = this.node.parent;
        node.active = true;
        node.setPosition(
            this.node.x + this.spawnOffsetX * dir,
            this.node.y + this.spawnOffsetY,
        );

        node.getComponent(Bullet).init(dir, this._pool);
    }
}
