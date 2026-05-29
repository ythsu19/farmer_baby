// Mario 模式：單一 Tiled 物件層 + 物件 name 自動驅動 Cocos Group。
//
// 工作流程（LIN 規定）：
//   1. Tiled 內建一個物件層（預設叫 "objects"）
//   2. 物件命名為類別名稱（ground / floor / wall / coin / player_spawn / enemy_spawn ...）
//   3. Cocos Project Settings → Group Manager 加好對應 group 與碰撞矩陣
//   4. 這個元件 onLoad 自動讀物件層 → 每個物件依 name 建碰撞器並設 node.group = name
//
// 名稱規則：
//   - 名稱含 "spawn" → 出生點，不建碰撞器，存在 _spawnPoints 供別的元件查
//   - 名稱在 sensorNames 內 → sensor collider（trigger，不阻擋物理）
//   - 其他 → solid collider
//
// 細節請看 LIN/collision_setup.md，工作流程規範見 LIN/cocos_workflow.md

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

@ccclass
@requireComponent(cc.TiledMap)
export default class TiledColliderBuilder extends cc.Component {

    @property({ displayName: 'Tiled 物件層名稱', tooltip: '預設 "objects" — 跟 Tiled 內的層名一致' })
    objectLayerName: string = 'objects';

    @property({ displayName: '出生點關鍵字', tooltip: '物件 name 含此字串 → 視為出生點，不建碰撞器' })
    spawnKeyword: string = 'spawn';

    @property({ displayName: 'Sensor 物件名稱清單', type: [cc.String], tooltip: '名稱在此清單內 → sensor collider（不擋物理只發 contact event）' })
    sensorNames: string[] = ['coin', 'item', 'pickup', 'trigger', 'goal'];

    @property({ displayName: 'Debug log' })
    debug: boolean = false;

    private _spawnPoints: Map<string, cc.Vec2> = new Map();
    private _built: cc.Node[] = [];

    onLoad() {
        const tiled = this.getComponent(cc.TiledMap);
        const group = tiled.getObjectGroup(this.objectLayerName);
        if (!group) {
            cc.warn(`[TiledColliderBuilder] 找不到物件層 "${this.objectLayerName}"`);
            return;
        }

        const physics = cc.director.getPhysicsManager();
        if (!physics.enabled) {
            cc.warn('[TiledColliderBuilder] cc.PhysicsManager 未啟用 — 在 onLoad 設 enabled = true');
        }

        const objects = group.getObjects() as TMXObject[];
        const summary: Record<string, number> = {};
        let spawns = 0;
        let colliders = 0;

        for (const obj of objects) {
            const name = obj.name || obj.type;
            if (!name) {
                cc.warn(`[TiledColliderBuilder] 跳過未命名物件 @ (${obj.x},${obj.y})`);
                continue;
            }

            if (name.indexOf(this.spawnKeyword) >= 0) {
                const pos = cc.v2(obj.x + obj.width / 2, obj.y + obj.height / 2);
                this._spawnPoints.set(name, pos);
                summary[name] = (summary[name] || 0) + 1;
                spawns++;
                continue;
            }

            const isSensor = this.sensorNames.indexOf(name) >= 0;
            if (this._buildCollider(obj, name, isSensor)) {
                summary[name] = (summary[name] || 0) + 1;
                colliders++;
            }
        }

        if (this.debug) {
            cc.log(`[TiledColliderBuilder] "${this.objectLayerName}": 碰撞器×${colliders} + 出生點×${spawns}`, summary);
            cc.log('[TiledColliderBuilder] 出生點清單:', Array.from(this._spawnPoints.keys()));
        }
    }

    onDestroy() {
        for (const n of this._built) if (cc.isValid(n)) n.destroy();
        this._built.length = 0;
        this._spawnPoints.clear();
    }

    /** 取出生點位置（場景座標系）；找不到回 null */
    getSpawnPoint(name: string): cc.Vec2 | null {
        const p = this._spawnPoints.get(name);
        return p ? p.clone() : null;
    }

    /** 列出所有出生點名稱 */
    getSpawnNames(): string[] {
        return Array.from(this._spawnPoints.keys());
    }

    private _buildCollider(obj: TMXObject, name: string, isSensor: boolean): boolean {
        const isPolygon = obj.points && obj.points.length >= 3;
        const isPolyline = obj.polylinePoints && obj.polylinePoints.length >= 2;

        if (!isPolygon && !isPolyline && (obj.width === 0 || obj.height === 0)) {
            cc.warn(`[TiledColliderBuilder] 跳過零大小物件 "${name}"（要當出生點請名稱含 "${this.spawnKeyword}"）`);
            return false;
        }

        const node = new cc.Node(name);
        node.parent = this.node;
        node.group = name;  // 用 Cocos Group Manager 做碰撞過濾

        const rb = node.addComponent(cc.RigidBody);
        rb.type = cc.RigidBodyType.Static;

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

        col.sensor = isSensor;
        col.apply();

        if (obj.rotation) node.angle = -obj.rotation;
        this._built.push(node);
        return true;
    }
}
