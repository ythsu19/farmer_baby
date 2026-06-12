// AuthManager — Firebase Email/密碼 登入、註冊、登出的封裝
//
// 用法（在 UI 腳本裡）：
//   import AuthManager from '../firebase/AuthManager';
//   const res = await AuthManager.register(email, password);
//   if (res.ok) { /* 成功，res.uid / res.email 可用 */ }
//   else        { /* 失敗，res.message 是中文錯誤訊息可直接顯示 */ }
//
// 設計：
//   - 所有方法都 async，回傳統一的 { ok, uid?, email?, message? } 結果，UI 不用碰 firebase 細節
//   - 第一次呼叫會自動 await FirebaseLoader.ensureReady()（載 SDK）
//   - 錯誤碼翻成中文，直接丟給玩家看
//
// ⚠️ 只在 Web 平台有效（依賴 FirebaseLoader）。

import FirebaseLoader from './FirebaseLoader';

/** 統一回傳格式 */
export interface AuthResult {
    ok: boolean;
    uid?: string;
    email?: string;
    message?: string;   // 失敗時的中文訊息
}

export default class AuthManager {

    /** 拿到 firebase.auth() 物件（已確保 SDK 載好） */
    private static async _auth(): Promise<any> {
        await FirebaseLoader.ensureReady();
        return (window as any).firebase.auth();
    }

    /** 註冊新帳號 */
    public static async register(email: string, password: string): Promise<AuthResult> {
        const v = this._validate(email, password);
        if (v) return { ok: false, message: v };
        try {
            const auth = await this._auth();
            const cred = await auth.createUserWithEmailAndPassword(email.trim(), password);
            const user = cred.user;
            return { ok: true, uid: user.uid, email: user.email };
        } catch (e) {
            return { ok: false, message: this._translateError(e) };
        }
    }

    /** 登入既有帳號 */
    public static async login(email: string, password: string): Promise<AuthResult> {
        const v = this._validate(email, password);
        if (v) return { ok: false, message: v };
        try {
            const auth = await this._auth();
            const cred = await auth.signInWithEmailAndPassword(email.trim(), password);
            const user = cred.user;
            return { ok: true, uid: user.uid, email: user.email };
        } catch (e) {
            return { ok: false, message: this._translateError(e) };
        }
    }

    /** 登出 */
    public static async logout(): Promise<AuthResult> {
        try {
            const auth = await this._auth();
            await auth.signOut();
            return { ok: true };
        } catch (e) {
            return { ok: false, message: this._translateError(e) };
        }
    }

    /** 目前登入的使用者（沒登入回 null）。同步讀，需確保 SDK 已載入 */
    public static getCurrentUser(): { uid: string, email: string } | null {
        const w = window as any;
        if (!w.firebase || !w.firebase.auth) return null;
        const u = w.firebase.auth().currentUser;
        return u ? { uid: u.uid, email: u.email } : null;
    }

    /**
     * 監聽登入狀態變化（登入/登出時都會觸發）。
     * 回傳一個取消監聽的函式。
     */
    public static async onAuthChanged(cb: (user: { uid: string, email: string } | null) => void): Promise<() => void> {
        const auth = await this._auth();
        return auth.onAuthStateChanged((u: any) => {
            cb(u ? { uid: u.uid, email: u.email } : null);
        });
    }

    // ── 內部：輸入檢查 ───────────────────────────────
    private static _validate(email: string, password: string): string | null {
        if (!email || !email.trim()) return '請輸入電子郵件';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return '電子郵件格式不正確';
        if (!password) return '請輸入密碼';
        if (password.length < 6) return '密碼至少要 6 個字元';
        return null;
    }

    // ── 內部：Firebase 錯誤碼 → 中文 ─────────────────
    private static _translateError(e: any): string {
        const code = (e && e.code) ? e.code : '';
        switch (code) {
            case 'auth/email-already-in-use': return '這個電子郵件已經註冊過了';
            case 'auth/invalid-email':        return '電子郵件格式不正確';
            case 'auth/weak-password':        return '密碼太弱（至少 6 個字元）';
            case 'auth/user-not-found':       return '找不到這個帳號';
            case 'auth/wrong-password':       return '密碼錯誤';
            case 'auth/invalid-credential':   return '帳號或密碼錯誤';
            case 'auth/invalid-login-credentials': return '帳號或密碼錯誤（或帳號尚未註冊）';
            case 'auth/too-many-requests':    return '嘗試太多次，請稍後再試';
            case 'auth/network-request-failed': return '網路連線失敗，請檢查網路';
            default:
                return '發生錯誤：' + (e && e.message ? e.message : code || '未知錯誤');
        }
    }
}
