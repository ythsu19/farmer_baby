// 把 Tiled map 的物件層轉成 box2d 靜態碰撞器。
//
// 用途：在 Tiled 內畫好「碰撞」物件層（rectangle / polygon），
//       這個元件在 onLoad 讀那一層，每個物件生一個帶 RigidBody(Static)+Collider 的子節點。
//
// 使用步驟見 LIN/collision_setup.md

const { ccclass, property, requireComponent, executionOrder } = cc._decorator;

interface TMXObject {
    name?: string;
    type?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    visible?: boolean;
    points?: cc.Vec2[];        // polygon / polyline
    polylinePoints?: cc.Vec2[];
    gid?: number;
}

@ccclass
@requireComponent(cc.TiledMap)
@executionOrder(-100)
export default class TiledColliderBuilder extends cc.Component {

    @property({ displayName: 'Tiled 物件層名稱（要存在於 .tmx 內）' })
    objectLayerName: string = 'collision';

    @property({ displayName: '碰撞器掛在這個父節點下（空 = 用本節點）' })
    container: cc.Node = null;

    @property({ displayName: '建立後標記每個碰撞器名稱', tooltip: '方便在 Cocos 階層除錯' })
    nameColliders: boolean = true;

    @property({ displayName: '只處理特定 type 的物件（空 = 全部）' })
    filterType: string = '';

    @property({ displayName: '碰撞器要可見（除錯用，會發出 debug log）' })
    debug: boolean = false;

    private _built: cc.Node[] = [];

    onLoad() {
        const physics = cc.director.getPhysicsManager();
        if (!physics.enabled) {
            cc.warn('[TiledColliderBuilder] cc.PhysicsManager 未啟用 — 在場景某處設 cc.director.getPhysicsManager().enabled = true');
        }

        const tiled = this.getComponent(cc.TiledMap);
        const group = tiled.getObjectGroup(this.objectLayerName);
        if (!group) {
            cc.warn(`[TiledColliderBuilder] 找不到物件層 "${this.objectLayerName}"`);
            return;
        }

        const parent = this.container || this.node;
        const objects = group.getObjects() as TMXObject[];
        let made = 0;

        for (const obj of objects) {
            if (this.filterType && obj.type !== this.filterType) continue;
            if (this._build(obj, parent)) made++;
        }

        if (this.debug) cc.log(`[TiledColliderBuilder] 從 "${this.objectLayerName}" 建了 ${made} 個碰撞器`);
    }

    onDestroy() {
        for (const n of this._built) {
            if (cc.isValid(n)) n.destroy();
        }
        this._built.length = 0;
    }

    private _build(obj: TMXObject, parent: cc.Node): boolean {
        const node = new cc.Node(this.nameColliders ? (obj.name || obj.type || 'TerrainCollider') : '');
        node.parent = parent;

        const rb = node.addComponent(cc.RigidBody);
        rb.type = cc.RigidBodyType.Static;

        const isPolygon = obj.points && obj.points.length >= 3;
        const isPolyline = obj.polylinePoints && obj.polylinePoints.length >= 2;

        if (isPolygon) {
            const col = node.addComponent(cc.PhysicsPolygonCollider);
            col.points = obj.points.slice();
            node.setPosition(obj.x, obj.y);
            col.apply();
        } else if (isPolyline) {
            const col = node.addComponent(cc.PhysicsChainCollider);
            col.points = obj.polylinePoints.slice();
            col.loop = false;
            node.setPosition(obj.x, obj.y);
            col.apply();
        } else {
            const col = node.addComponent(cc.PhysicsBoxCollider);
            col.size = cc.size(obj.width, obj.height);
            col.offset = cc.v2(obj.width / 2, obj.height / 2);
            node.setPosition(obj.x, obj.y);
            col.apply();
        }

        if (obj.rotation) node.angle = -obj.rotation;
        this._built.push(node);
        return true;
    }
}
