package com.kharcha.app.model;

/** One expense row. Amount stored in paisa (long) - no float errors. */
public class Expense {
    public long id;
    public int categoryId;
    public long paisa;
    public String note;
    public long createdAt;

    public Expense(long id, int categoryId, long paisa, String note, long createdAt) {
        this.id = id;
        this.categoryId = categoryId;
        this.paisa = paisa;
        this.note = note == null ? "" : note;
        this.createdAt = createdAt;
    }
}
