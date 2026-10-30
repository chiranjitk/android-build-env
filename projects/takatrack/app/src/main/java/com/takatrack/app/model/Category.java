package com.takatrack.app.model;

/** Expense categories for TakaTrack (English UI). */
public enum Category {
    FOOD     (1, "Food",     "🍛", 0xFFE65100),
    TRAVEL   (2, "Travel",   "🚌", 0xFF00695C),
    BILLS    (3, "Bills",    "💡", 0xFFF9A825),
    SHOPPING (4, "Shopping", "🛍", 0xFF8E24AA),
    HEALTH   (5, "Health",   "💊", 0xFFC62828),
    OTHER    (6, "Other",    "📦", 0xFF6D4C41);

    public final int id;
    public final String label;
    public final String emoji;
    public final int color;

    Category(int id, String label, String emoji, int color) {
        this.id = id;
        this.label = label;
        this.emoji = emoji;
        this.color = color;
    }

    public static Category byId(int id) {
        for (Category c : values()) if (c.id == id) return c;
        return OTHER;
    }
}
