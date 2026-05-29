// 把 Tiled map 內多個「物件層」轉成 box2d 靜態碰撞器。
//
// 工作流程（LIN 的規定）：
//   1. Tiled 內為每種地形類型分別建一個物件層，命名為 ground / floor / wall / death...
//   2. Tiled Project 設定 Group 集中管理這些層
//   3. 這個元件在 onLoad 一次性把每一層的物件全部轉成碰撞器
//
// 使用步驟見 LIN/collision_setup.md，工作流程規範見 LIN/cocos_workflow.md

const { ccclass, property, requireComponent } = cc._decorator;

interface TMXObject {
    name?: string;
    type?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    points?: cc.Vec2[];
    polylinePoints?: cc.Vec2[];
}

/** 一個 Tiled 物件層 → 一組碰撞器 的設定 */
@ccclass('LayerSpec')
export class LayerSpec {
    @property({ displayName: 'Tiled 物件層名稱', tooltip: '跟 .tmx 裡的 layer name 一致' })
    layerName: string = '';

    @property({ displayName: 'Tag', tooltip: '碰撞器 tag，給程式判斷用（0=未分類）。慣例見 cocos_workflow.md' })
    tag: number = 0;

    @property({ displayName: 'Sensor', tooltip: '勾起來＝trigger 觸發器，不阻擋物理，只發 contact event' })
    sensor: boolean = false;
}

@ccclass
@requireComponent(cc.TiledMap)
export default class TiledColliderBuilder extends cc.Component {

    @property({ type: [LayerSpec], displayName: '物件層設定（每個 Tiled 物件層一筆）' })
    layers: LayerSpec[] = [];

    @property({ displayName: 'Debug log（看每層建了多少碰撞器）' })
    debug: boolean = false;

    private _built: cc.Node[] = [];

    onLoad() {
        const physics = cc.director.getPhysicsManager();
        if (!physics.enabled) {
            cc.warn('[TiledColliderBuilder] cc.PhysicsManager 未啟用 — 在 onLoad 設 physics.enabled = true');
        }

        const tiled = this.getComponent(cc.TiledMap);
        for (const spec of this.layers) {
            this._buildLayer(tiled, spec);
        }
    }

    onDestroy() {
        for (const n of this._built) if (cc.isValid(n)) n.destroy();
        this._built.length = 0;
    }

    private _buildLayer(tiled: cc.TiledMap, spec: LayerSpec) {
        if (!spec.layerName) return;
        const group = tiled.getObjectGroup(spec.layerName);
        if (!group) {
            cc.warn(`[TiledColliderBuilder] 找不到物件層 "${spec.layerName}"（.tmx 內是否存在這層？）`);
            return;
        }
        const objects = group.getObjects() as TMXObject[];
        let made = 0;
        for (const obj of objects) {
            if (this._build(obj, spec)) made++;
        }
        if (this.debug) {
            cc.log(`[TiledColliderBuilder] "${spec.layerName}" → ${made} 個碰撞器 (tag=${spec.tag}${spec.sensor ? ', sensor' : ''})`);
        }
    }

    private _build(obj: TMXObject, spec: LayerSpec): boolean {
        const node = new cc.Node(`${spec.layerName}:${obj.name || obj.type || 'obj'}`);
        node.parent = this.node;

        const rb = node.addComponent(cc.RigidBody);
        rb.type = cc.RigidBodyType.Static;

        const isPolygon = obj.points && obj.points.length >= 3;
        const isPolyline = obj.polylinePoints && obj.polylinePoints.length >= 2;

        let col: cc.PhysicsCollider;
        if (isPolygon) {
            const c = node.addComponent(cc.PhysicsPolygonCollider);
            c.points = obj.points.slice();
            node.setPosition(obj.x, obj.y);
            col = c;
        } else if (isPolyline) {
            const c = node.addComponent(cc.PhysicsChainCollider);
            c.points = obj.polylinePoints.slice();
            c.loop = false;
            node.setPosition(obj.x, obj.y);
            col = c;
        } else {
            const c = node.addComponent(cc.PhysicsBoxCollider);
            c.size = cc.size(obj.width, obj.height);
            c.offset = cc.v2(obj.width / 2, obj.height / 2);
            node.setPosition(obj.x, obj.y);
            col = c;
        }

        col.tag = spec.tag;
        col.sensor = spec.sensor;
        col.apply();

        if (obj.rotation) node.angle = -obj.rotation;
        this._built.push(node);
        return true;
    }
}
