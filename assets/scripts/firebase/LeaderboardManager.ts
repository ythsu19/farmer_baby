// LeaderboardManager — 血量排行榜（存 Firebase Firestore）
//
// 排名規則：打贏 Boss 時剩餘血量越高越前面（hp 由大到小）。
//
// 資料結構（Firestore collection 'leaderboard'，每個玩家一筆，doc id = uid）：
//   { name: string, hp: number, uid: string, updatedAt: <server timestamp> }
//   用 uid 當 doc id → 同一玩家只留一筆，提交新成績時只在「血量更高」才覆蓋。
//
// 用法：
//   // 打贏時提交成績（剩餘血量）
//   await LeaderboardManager.submitHp(85, '阿寶');
//   // 讀前 10 名
//   const list = await LeaderboardManager.getTop(10);
//   // list = [{ name, hp, uid }, ...] 已照血量由高到低排好
//
// ⚠️ 只在 Web 平台有效（依賴 FirebaseLoader）。需先在 Firebase Console 開 Firestore。

import FirebaseLoader from './FirebaseLoader';
import AuthManager from './AuthManager';

export interface LeaderboardEntry {
    name: string;
    hp: number;
    uid: string;
}

export interface LbResult {
    ok: boolean;
    message?: string;
}

const COLLECTION = 'leaderboard';

export default class LeaderboardManager {

    private static async _db(): Promise<any> {
        await FirebaseLoader.ensureReady();
        const fb = (window as any).firebase;
        if (!fb || !fb.firestore) throw new Error('[Leaderboard] Firestore 未載入');
        return fb.firestore();
    }

    /**
     * 提交剩餘血量。只有比自己舊紀錄血量更高才會更新。
     * 需要先登入（用登入的 uid 當 doc id）；沒登入會用 name 當匿名 id。
     * @param hp   打贏 Boss 時剩餘血量（越高越好）
     * @param name 顯示在榜上的暱稱
     */
    public static async submitHp(hp: number, name: string): Promise<LbResult> {
        if (!(hp >= 0)) return { ok: false, message: '血量不正確' };
        if (!name || !name.trim()) return { ok: false, message: '請輸入暱稱' };

        try {
            const db = await this._db();
            const fb = (window as any).firebase;

            // 用登入 uid 當 doc id；沒登入 → 用暱稱當 id（匿名）
            const user = AuthManager.getCurrentUser();
            const docId = user ? user.uid : ('anon_' + name.trim());
            const uid = user ? user.uid : docId;

            const ref = db.collection(COLLECTION).doc(docId);
            const snap = await ref.get();

            // 已有紀錄且舊的血量更高或相同 → 不覆蓋（保留最佳）
            if (snap.exists) {
                const old = snap.data();
                if (old && typeof old.hp === 'number' && old.hp >= hp) {
                    return { ok: true, message: '沒有刷新紀錄（保留更高血量的成績）' };
                }
            }

            await ref.set({
                name: name.trim(),
                hp: Math.round(hp),
                uid: uid,
                updatedAt: fb.firestore.FieldValue.serverTimestamp(),
            });
            return { ok: true };
        } catch (e) {
            return { ok: false, message: this._err(e) };
        }
    }

    /**
     * 讀取前 N 名（血量由高到低）。
     * @param limit 取幾名（預設 10）
     */
    public static async getTop(limit: number = 10): Promise<LeaderboardEntry[]> {
        const db = await this._db();
        const query = db.collection(COLLECTION)
            .orderBy('hp', 'desc')
            .limit(limit);
        const snap = await query.get();

        const list: LeaderboardEntry[] = [];
        snap.forEach((doc: any) => {
            const d = doc.data();
            if (d && typeof d.hp === 'number') {
                list.push({ name: d.name || '???', hp: d.hp, uid: d.uid || doc.id });
            }
        });
        return list;
    }

    /** 把血量格式化成顯示字串（給 UI 用） */
    public static formatHp(hp: number): string {
        return `${Math.round(hp)} HP`;
    }

    private static _err(e: any): string {
        const code = (e && e.code) ? e.code : '';
        if (code === 'permission-denied') return '沒有權限（請檢查 Firestore 安全規則）';
        if (code === 'unavailable') return '連線失敗，請檢查網路';
        return '排行榜錯誤：' + (e && e.message ? e.message : code || '未知');
    }
}
