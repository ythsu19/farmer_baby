const { ccclass, property } = cc._decorator;

@ccclass
export default class TileMapCollision extends cc.Component {

    @property
    objectGroupName: string = "wall";

    private tiledMap: cc.TiledMap = null;

    onLoad() {
        const physics = cc.director.getPhysicsManager();
        physics.enabled = true;
        physics.gravity = cc.v2(0, 0);

        physics.debugDrawFlags = 0;

        this.tiledMap = this.getComponent(cc.TiledMap);

        if (!this.tiledMap) {
            cc.error("[TileMapCollision] 找不到 TiledMap component");
            return;
        }

        // 放這裡
        cc.log("TileMap node pos =", this.node.x, this.node.y);
        cc.log("TileMap node scale =", this.node.scaleX, this.node.scaleY);
        cc.log("TileMap parent scale =", this.node.parent.scaleX, this.node.parent.scaleY);
        cc.log("TileMap anchor =", this.node.anchorX, this.node.anchorY);
        cc.log("TileMap node size =", this.node.width, this.node.height);

        const mapSize = this.tiledMap.getMapSize();
        const tileSize = this.tiledMap.getTileSize();

        cc.log("mapSize =", mapSize.width, mapSize.height);
        cc.log("tileSize =", tileSize.width, tileSize.height);
        cc.log("realMapSize =", mapSize.width * tileSize.width, mapSize.height * tileSize.height);

        const group = this.tiledMap.getObjectGroup(this.objectGroupName);

        if (!group) {
            cc.error("[TileMapCollision] 找不到 Object Layer:", this.objectGroupName);
            return;
        }

        const objects = group.getObjects();

        cc.log("[TileMapCollision] objects count =", objects.length);

        for (const obj of objects) {
            cc.log("obj =", JSON.stringify(obj));

            if (obj.polygon) {
                this.createPolygonCollider(obj);
            } else if (obj.width != null && obj.height != null) {
                this.createBoxCollider(obj);
            } else {
                cc.warn("[TileMapCollision] 不支援的物件，跳過：", obj);
            }
        }
    }

    private getMapInfo() {
        const mapNode = this.tiledMap.node;

        const mapSize = this.tiledMap.getMapSize();
        const tileSize = this.tiledMap.getTileSize();

        return {
            mapNode: mapNode,
            mapWidth: mapSize.width * tileSize.width,
            mapHeight: mapSize.height * tileSize.height,
            anchorX: mapNode.anchorX,
            anchorY: mapNode.anchorY
        };
    }

    createBoxCollider(obj: any) {
        const info = this.getMapInfo();

        const node = new cc.Node("WallBoxCollider");
        node.parent = info.mapNode;

        const body = node.addComponent(cc.RigidBody);
        body.type = cc.RigidBodyType.Static;

        const collider = node.addComponent(cc.PhysicsBoxCollider);
        collider.size = cc.size(obj.width, obj.height);

        node.x = obj.x + obj.width / 2 - info.mapWidth * info.anchorX;
        node.y = obj.y - obj.height / 2 - info.mapHeight * info.anchorY;

        collider.apply();

        cc.log("[TileMapCollision] create box:",
            "obj =", obj.x, obj.y,
            "offset =", obj.offset.x, obj.offset.y,
            "node =", node.x, node.y,
            "size =", obj.width, obj.height
        );
    }

    createPolygonCollider(obj: any) {
        const info = this.getMapInfo();

        const node = new cc.Node("WallPolygonCollider");
        node.parent = info.mapNode;

        const body = node.addComponent(cc.RigidBody);
        body.type = cc.RigidBodyType.Static;

        const collider = node.addComponent(cc.PhysicsPolygonCollider);

        const points: cc.Vec2[] = [];

        for (const p of obj.polygon) {
            points.push(cc.v2(p.x, p.y));
        }

        collider.points = points;

        node.x = obj.x - info.mapWidth * info.anchorX;
        node.y = obj.y - info.mapHeight * info.anchorY;

        collider.apply();

        cc.log("[TileMapCollision] create polygon:", node.x, node.y, points);
    }
}