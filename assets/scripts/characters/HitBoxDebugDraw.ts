// HitBoxDebugDraw — 只畫「這個節點自己」的碰撞箱輪廓（偵錯用）
//
// 為什麼需要它？
//   box2d 內建的 debug draw（PhysicsManager.debugDrawFlags）是「全域」的，
//   一開就畫場景裡所有 collider，沒辦法只畫單一個。
//   想「只看鐮刀 hitbox、不看角色和身體的」→ 用這個元件，掛在要看的那個
//   collider 節點上，它只用 cc.Graphics 畫自己這個 collider 的形狀。
//
// 用法：
//   1. 掛在 scytheHitBox 節點上（跟 PhysicsBoxCollider / PhysicsPolygonCollider 同節點）
//   2. 不用設任何東西，跑遊戲就會畫出這個 collider 的綠框
//   3. 看完把元件移除 / disable 即可（正式發佈不要留）
//
// 注意：
//   - 會自己在同節點加一個 cc.Graphics 來畫，畫的是 collider 的 points/size + offset
//   - 支援 PhysicsPolygonCollider（多邊形）與 PhysicsBoxCollider（方框）
//   - 即使節點 active=false 就不會 update，所以鐮刀平常關著時看不到是正常的；
//     想常駐看形狀，先把該節點 active 打開

const { ccclass, property } = cc._decorator;

@ccclass
export default class HitBoxDebugDraw extends cc.Component {

    @property({ tooltip: '線框顏色（預設綠色）' })
    color: cc.Color = cc.Color.GREEN;

    @property({ tooltip: '線寬' })
    lineWidth: number = 2;

    @property({ tooltip: '每幀重畫（collider 形狀/位置會變時需要）；固定不變可關掉省效能' })
    redrawEveryFrame: boolean = true;

    private _g: cc.Graphics = null;
    private _poly: cc.PhysicsPolygonCollider = null;
    private _box: cc.PhysicsBoxCollider = null;

    onLoad() {
        this._poly = this.getComponent(cc.PhysicsPolygonCollider);
        this._box = this.getComponent(cc.PhysicsBoxCollider);

        this._g = this.getComponent(cc.Graphics);
        if (!this._g) this._g = this.addComponent(cc.Graphics);

        this._draw();
    }

    update() {
        if (this.redrawEveryFrame) this._draw();
    }

    private _draw() {
        if (!this._g) return;
        this._g.clear();
        this._g.lineWidth = this.lineWidth;
        this._g.strokeColor = this.color;

        if (this._poly && this._poly.points && this._poly.points.length >= 2) {
            const off = this._poly.offset || cc.v2();
            const pts = this._poly.points;
            this._g.moveTo(pts[0].x + off.x, pts[0].y + off.y);
            for (let i = 1; i < pts.length; i++) {
                this._g.lineTo(pts[i].x + off.x, pts[i].y + off.y);
            }
            this._g.close();
            this._g.stroke();
            return;
        }

        if (this._box) {
            const off = this._box.offset || cc.v2();
            const w = this._box.size.width / 2;
            const h = this._box.size.height / 2;
            this._g.moveTo(off.x - w, off.y - h);
            this._g.lineTo(off.x + w, off.y - h);
            this._g.lineTo(off.x + w, off.y + h);
            this._g.lineTo(off.x - w, off.y + h);
            this._g.close();
            this._g.stroke();
        }
    }
}
