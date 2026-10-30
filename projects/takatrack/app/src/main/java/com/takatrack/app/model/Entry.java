package com.takatrack.app.model;

/** One money entry. type: 0 = expense, 1 = income. Amount in paisa. */
public class Entry {
    public long id;
    public int type;      // 0 expense, 1 income
    public int categoryId;
    public long paisa;
    public String note;
    public long createdAt;

    public Entry(long id, int type, int categoryId, long paisa, String note, long createdAt) {
        this.id = id;
        this.type = type;
        this.categoryId = categoryId;
        this.paisa = paisa;
        this.note = note == null ? "" : note;
        this.createdAt = createdAt;
    }
}
