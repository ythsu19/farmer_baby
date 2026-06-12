const { ccclass } = cc._decorator;

@ccclass
export default class TopDownManager extends cc.Component {

    onLoad() {
        const physics = cc.director.getPhysicsManager();

        physics.enabled = true;

        // 俯視圖不要重力
        physics.gravity = cc.v2(0, 0);

        // 可以先開著看碰撞框
        physics.debugDrawFlags = cc.PhysicsManager.DrawBits.e_shapeBit;
    }
}

