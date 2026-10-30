package com.kharcha.app.db;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.kharcha.app.model.Expense;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/** Local SQLite storage - no network, no permissions. */
public class ExpenseDbHelper extends SQLiteOpenHelper {
    private static final String DB_NAME = "kharcha.db";
    private static final int DB_VERSION = 1;
    private static final String TABLE = "expenses";

    public ExpenseDbHelper(Context c) {
        super(c, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE " + TABLE + " (" +
                "_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "category_id INTEGER NOT NULL," +
                "paisa INTEGER NOT NULL," +
                "note TEXT NOT NULL DEFAULT ''," +
                "created_at INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX idx_created ON " + TABLE + "(created_at)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldV, int newV) {
        // v1 only
    }

    public long insert(int categoryId, long paisa, String note, long createdAt) {
        ContentValues cv = new ContentValues();
        cv.put("category_id", categoryId);
        cv.put("paisa", paisa);
        cv.put("note", note == null ? "" : note);
        cv.put("created_at", createdAt);
        return getWritableDatabase().insert(TABLE, null, cv);
    }

    public int delete(long id) {
        return getWritableDatabase().delete(TABLE, "_id=?", new String[]{String.valueOf(id)});
    }

    /** [startMillis, endMillis) window for one local month. */
    private static long[] monthRange(int year, int month0) {
        Calendar s = Calendar.getInstance();
        s.clear();
        s.set(year, month0, 1, 0, 0, 0);
        Calendar e = (Calendar) s.clone();
        e.add(Calendar.MONTH, 1);
        return new long[]{s.getTimeInMillis(), e.getTimeInMillis()};
    }

    public List<Expense> monthExpenses(int year, int month0) {
        long[] r = monthRange(year, month0);
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT _id, category_id, paisa, note, created_at FROM " + TABLE +
                        " WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC",
                new String[]{String.valueOf(r[0]), String.valueOf(r[1])});
        List<Expense> out = new ArrayList<>();
        while (c.moveToNext()) {
            out.add(new Expense(c.getLong(0), c.getInt(1), c.getLong(2), c.getString(3), c.getLong(4)));
        }
        c.close();
        return out;
    }

    /** Total paisa for the month. */
    public long monthTotal(int year, int month0) {
        long[] r = monthRange(year, month0);
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT COALESCE(SUM(paisa),0) FROM " + TABLE +
                        " WHERE created_at >= ? AND created_at < ?",
                new String[]{String.valueOf(r[0]), String.valueOf(r[1])});
        long t = c.moveToFirst() ? c.getLong(0) : 0;
        c.close();
        return t;
    }

    /** Per-category totals, indexed by Category.ordinal(). */
    public long[] categoryTotals(int year, int month0) {
        long[] r = monthRange(year, month0);
        long[] out = new long[6];
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT category_id, COALESCE(SUM(paisa),0) FROM " + TABLE +
                        " WHERE created_at >= ? AND created_at < ? GROUP BY category_id",
                new String[]{String.valueOf(r[0]), String.valueOf(r[1])});
        while (c.moveToNext()) {
            int idx = com.kharcha.app.model.Category.byId(c.getInt(0)).ordinal();
            out[idx] += c.getLong(1);
        }
        c.close();
        return out;
    }
}
