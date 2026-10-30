package com.kharcha.app.model;

/** The 6 fixed expense categories (Bangla labels + emoji + color). */
public enum Category {
    FOOD     (1, "খাবার",     "🍛", 0xFFE65100),
    TRANSPORT(2, "যাতায়াত",  "🚌", 0xFF00695C),
    MARKET   (3, "বাজার",     "🛒", 0xFF2E7D32),
    BILL     (4, "বিল",       "💡", 0xFFF9A825),
    MEDICINE (5, "ওষুধ",      "💊", 0xFFC62828),
    OTHER    (6, "অন্যান্য",   "📦", 0xFF6D4C41);

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
