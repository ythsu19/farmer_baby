// LoginUI — 登入/註冊畫面的 UI 控制（接 AuthManager）
//
// 掛在登入畫面的根節點上，把下面這些 @property 在編輯器拖好：
//   - panelNode：整個登入 panel 的容器節點（一開始隱藏，按「開啟鈕」才顯示）
//   - emailInput / passwordInput：cc.EditBox（玩家輸入帳密）
//   - loginButton / registerButton：cc.Button（綁這支的 onLoginClick / onRegisterClick）
//   - statusLabel：cc.Label（顯示訊息；一開始隱藏，按登入/註冊後才出現）
//   - nextSceneName：登入成功後要跳的場景名（例如 MainMenu）
//
// 按鈕事件綁法（在 Button 的 Click Events 設）：
//   開啟登入鈕 → 拖掛此腳本的節點 → LoginUI.onOpenPanelClick
//   登入鈕     → LoginUI.onLoginClick
//   註冊鈕     → LoginUI.onRegisterClick
//   關閉鈕(選) → LoginUI.onClosePanelClick
//
// 也可直接呼叫 AuthManager.login/register，這支只是把 UI 流程串起來的範例。

import AuthManager from './AuthManager';

const { ccclass, property } = cc._decorator;

@ccclass
export default class LoginUI extends cc.Component {

    @property({ type: cc.Node, tooltip: '整個登入 panel 容器（一開始隱藏，按開啟鈕才顯示）。留空 → 不做顯示/隱藏' })
    panelNode: cc.Node = null;

    @property({ type: cc.Node, tooltip: '「開啟登入」按鈕節點。開啟 panel 時會把它藏起來，關閉 panel 時再顯示回來。留空 → 不控制' })
    openButtonNode: cc.Node = null;

    @property({ type: [cc.Node], tooltip: '開啟登入 panel 時要一起隱藏的其他 panel（例如排行榜）。關閉登入時會顯示回來。' })
    otherPanelsToHide: cc.Node[] = [];

    @property({ tooltip: '勾 → 一開始就隱藏 panel，要按開啟鈕才出現' })
    hidePanelAtStart: boolean = true;

    @property({ type: cc.EditBox, tooltip: '電子郵件輸入框' })
    emailInput: cc.EditBox = null;

    @property({ type: cc.EditBox, tooltip: '密碼輸入框（建議 InputFlag 設 Password 隱藏字元）' })
    passwordInput: cc.EditBox = null;

    @property({ type: cc.Label, tooltip: '狀態/錯誤訊息 Label（一開始隱藏，按登入/註冊才出現）' })
    statusLabel: cc.Label = null;

    @property({ type: cc.Button, tooltip: '登入按鈕（選填，純粹拿來防連點）' })
    loginButton: cc.Button = null;

    @property({ type: cc.Button, tooltip: '註冊按鈕（選填，純粹拿來防連點）' })
    registerButton: cc.Button = null;

    @property({ tooltip: '登入/註冊成功後要跳的場景名稱（留空 → 不跳場景，改成自動關閉 panel）' })
    nextSceneName: string = '';

    @property({ tooltip: '沒設跳場景時：成功後過幾秒自動關閉 panel（讓玩家先看到「成功！」）' })
    closeDelayOnSuccess: number = 1;

    private _busy: boolean = false;

    onLoad() {
        // 一開始隱藏 panel（要按開啟鈕才顯示）
        if (this.panelNode && this.hidePanelAtStart) {
            this.panelNode.active = false;
        }
        // 一開始隱藏狀態訊息（按登入/註冊才出現）
        this._hideStatus();
    }

    // ── 按鈕事件 ──────────────────────────────────
    /** 開啟鈕：顯示登入 panel，同時把開啟鈕本身藏起來，並隱藏其他 panel（例如排行榜） */
    public onOpenPanelClick() {
        if (this.panelNode) this.panelNode.active = true;
        if (this.openButtonNode) this.openButtonNode.active = false;   // 藏開啟鈕
        // 隱藏其他會擋住/疊在一起的 panel（例如排行榜）
        for (const n of this.otherPanelsToHide) {
            if (n) n.active = false;
        }
        this._hideStatus();   // 每次開啟都先清掉上次的訊息
    }

    /** 關閉鈕（選用）：隱藏登入 panel，並把開啟鈕與其他 panel 顯示回來 */
    public onClosePanelClick() {
        if (this.panelNode) this.panelNode.active = false;
        if (this.openButtonNode) this.openButtonNode.active = true;    // 顯示回開啟鈕
        // 其他 panel 顯示回來
        for (const n of this.otherPanelsToHide) {
            if (n) n.active = true;
        }
    }

    public onLoginClick() {
        this._doAuth(false);
    }

    public onRegisterClick() {
        this._doAuth(true);
    }

    // ── 流程 ──────────────────────────────────────
    private async _doAuth(isRegister: boolean) {
        if (this._busy) return;
        this._busy = true;
        this._setButtonsEnabled(false);

        const email = this.emailInput ? this.emailInput.string : '';
        const password = this.passwordInput ? this.passwordInput.string : '';

        this._setStatus(isRegister ? '註冊中…' : '登入中…');

        const res = isRegister
            ? await AuthManager.register(email, password)
            : await AuthManager.login(email, password);

        this._busy = false;
        this._setButtonsEnabled(true);

        if (res.ok) {
            this._setStatus(isRegister ? '註冊成功！' : '登入成功！');
            cc.log('[LoginUI] 成功 uid=', res.uid, 'email=', res.email);
            if (this.nextSceneName) {
                // 有設場景 → 跳場景（panel 自然隨場景切換消失）
                cc.director.loadScene(this.nextSceneName);
            } else {
                // 沒設場景 → 延遲一下讓玩家看到「成功！」，再自動關掉 panel + 顯示回開啟鈕
                this.scheduleOnce(() => {
                    if (this.panelNode) this.panelNode.active = false;
                    if (this.openButtonNode) this.openButtonNode.active = true;
                    this._hideStatus();
                }, this.closeDelayOnSuccess);
            }
        } else {
            this._setStatus(res.message || '發生錯誤');
        }
    }

    /** 顯示狀態訊息（會把 statusLabel 節點打開） */
    private _setStatus(msg: string) {
        if (this.statusLabel) {
            this.statusLabel.node.active = true;   // 出現
            this.statusLabel.string = msg;
        } else {
            cc.log('[LoginUI]', msg);
        }
    }

    /** 隱藏狀態訊息（關掉 statusLabel 節點 → 一開始/開啟 panel 時不顯示） */
    private _hideStatus() {
        if (this.statusLabel) {
            this.statusLabel.string = '';
            this.statusLabel.node.active = false;
        }
    }

    private _setButtonsEnabled(on: boolean) {
        if (this.loginButton) this.loginButton.interactable = on;
        if (this.registerButton) this.registerButton.interactable = on;
    }
}
