const { ccclass, property } = cc._decorator;

@ccclass
export default class TopDownPlayer extends cc.Component {

    @property
    speed: number = 150;

    private rb: cc.RigidBody = null;
    private moveDir: cc.Vec2 = cc.v2(0, 0);

    onLoad() {
        this.rb = this.getComponent(cc.RigidBody);

        if (this.rb) {
            this.rb.type = cc.RigidBodyType.Dynamic;
            this.rb.gravityScale = 0;
            this.rb.fixedRotation = true;
            this.rb.linearVelocity = cc.v2(0, 0);
        }

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);

        cc.log("[TopDownPlayer] loaded");
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
    }

    onKeyDown(event: cc.Event.EventKeyboard) {
        switch (event.keyCode) {
            case cc.macro.KEY.w:
            case cc.macro.KEY.up:
                this.moveDir.y = 1;
                break;
            case cc.macro.KEY.s:
            case cc.macro.KEY.down:
                this.moveDir.y = -1;
                break;
            case cc.macro.KEY.a:
            case cc.macro.KEY.left:
                this.moveDir.x = -1;
                break;
            case cc.macro.KEY.d:
            case cc.macro.KEY.right:
                this.moveDir.x = 1;
                break;
        }
    }

    onKeyUp(event: cc.Event.EventKeyboard) {
        switch (event.keyCode) {
            case cc.macro.KEY.w:
            case cc.macro.KEY.up:
                if (this.moveDir.y === 1) this.moveDir.y = 0;
                break;
            case cc.macro.KEY.s:
            case cc.macro.KEY.down:
                if (this.moveDir.y === -1) this.moveDir.y = 0;
                break;
            case cc.macro.KEY.a:
            case cc.macro.KEY.left:
                if (this.moveDir.x === -1) this.moveDir.x = 0;
                break;
            case cc.macro.KEY.d:
            case cc.macro.KEY.right:
                if (this.moveDir.x === 1) this.moveDir.x = 0;
                break;
        }
    }

    update(dt: number) {
        if (!this.rb) return;

        let dir = this.moveDir;

        if (dir.mag() > 0) {
            dir = dir.normalize();
        }

        this.rb.linearVelocity = cc.v2(
            dir.x * this.speed,
            dir.y * this.speed
        );
    }
}