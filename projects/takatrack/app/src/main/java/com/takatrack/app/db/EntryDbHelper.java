package com.takatrack.app.db;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.takatrack.app.model.Entry;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

public class EntryDbHelper extends SQLiteOpenHelper {
    private static final String DB_NAME = "takatrack.db";
    private static final int DB_VERSION = 1;
    private static final String TABLE = "entries";

    public EntryDbHelper(Context c) {
        super(c, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE " + TABLE + " (" +
                "_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "type INTEGER NOT NULL," +
                "category_id INTEGER NOT NULL," +
                "paisa INTEGER NOT NULL," +
                "note TEXT NOT NULL DEFAULT ''," +
                "created_at INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX idx_created ON " + TABLE + "(created_at)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int o, int n) {}

    public long insert(int type, int categoryId, long paisa, String note, long at) {
        ContentValues cv = new ContentValues();
        cv.put("type", type);
        cv.put("category_id", categoryId);
        cv.put("paisa", paisa);
        cv.put("note", note == null ? "" : note);
        cv.put("created_at", at);
        return getWritableDatabase().insert(TABLE, null, cv);
    }

    public int delete(long id) {
        return getWritableDatabase().delete(TABLE, "_id=?", new String[]{String.valueOf(id)});
    }

    private static long[] monthRange(int year, int month0) {
        Calendar s = Calendar.getInstance();
        s.clear();
        s.set(year, month0, 1, 0, 0, 0);
        Calendar e = (Calendar) s.clone();
        e.add(Calendar.MONTH, 1);
        return new long[]{s.getTimeInMillis(), e.getTimeInMillis()};
    }

    public List<Entry> monthEntries(int year, int month0) {
        long[] r = monthRange(year, month0);
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT _id, type, category_id, paisa, note, created_at FROM " + TABLE +
                        " WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC",
                new String[]{String.valueOf(r[0]), String.valueOf(r[1])});
        List<Entry> out = new ArrayList<>();
        while (c.moveToNext()) {
            out.add(new Entry(c.getLong(0), c.getInt(1), c.getInt(2), c.getLong(3), c.getString(4), c.getLong(5)));
        }
        c.close();
        return out;
    }

    public long[] monthSums(int year, int month0) {
        // [0] = income, [1] = expense
        long[] r = monthRange(year, month0);
        long[] out = new long[2];
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT type, COALESCE(SUM(paisa),0) FROM " + TABLE +
                        " WHERE created_at >= ? AND created_at < ? GROUP BY type",
                new String[]{String.valueOf(r[0]), String.valueOf(r[1])});
        while (c.moveToNext()) {
            if (c.getInt(0) == 1) out[0] = c.getLong(1); else out[1] = c.getLong(1);
        }
        c.close();
        return out;
    }

    /** Expense totals per Category.ordinal(). */
    public long[] expenseByCategory(int year, int month0) {
        long[] r = monthRange(year, month0);
        long[] out = new long[6];
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT category_id, COALESCE(SUM(paisa),0) FROM " + TABLE +
                        " WHERE created_at >= ? AND created_at < ? AND type=0 GROUP BY category_id",
                new String[]{String.valueOf(r[0]), String.valueOf(r[1])});
        while (c.moveToNext()) {
            out[com.takatrack.app.model.Category.byId(c.getInt(0)).ordinal()] += c.getLong(1);
        }
        c.close();
        return out;
    }
}
