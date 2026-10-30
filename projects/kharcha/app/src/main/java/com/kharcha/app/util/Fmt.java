package com.kharcha.app.util;

import java.math.BigDecimal;
import java.util.Calendar;
import java.util.Locale;

/** Formatting helpers - ₹ INR + Bangla digits + Bangla months. */
public final class Fmt {
    private static final String BD = "০১২৩৪৫৬৭৮৯";
    private static final String[] MONTHS = {
            "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
            "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
    };

    private Fmt() {}

    /** Convert ASCII digits to Bangla digits. */
    public static String bn(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            b.append(c >= '0' && c <= '9' ? BD.charAt(c - '0') : c);
        }
        return b.toString();
    }

    public static String bn(long n) { return bn(String.valueOf(n)); }

    /** paisa -> "₹১,২৩৪.৫০" (Indian grouping, Bangla digits). */
    public static String taka(long paisa) {
        BigDecimal rupees = BigDecimal.valueOf(paisa, 2);
        String plain = rupees.toPlainString();          // e.g. 1234.50
        String intPart = plain.substring(0, plain.indexOf('.'));
        String fracPart = plain.substring(plain.indexOf('.') + 1);
        return "₹" + bn(indianGroup(intPart)) + "." + bn(fracPart);
    }

    /** Indian numbering: 12,34,567 */
    private static String indianGroup(String digits) {
        if (digits.length() <= 3) return digits;
        String last3 = digits.substring(digits.length() - 3);
        String rest = digits.substring(0, digits.length() - 3);
        StringBuilder b = new StringBuilder();
        while (rest.length() > 2) {
            b.insert(0, "," + rest.substring(rest.length() - 2));
            rest = rest.substring(0, rest.length() - 2);
        }
        return rest + b + "," + last3;
    }

    /** "অক্টোবর ২০২৫" */
    public static String monthTitle(int year, int month0) {
        return MONTHS[month0] + " " + bn(year);
    }

    public static String monthTitle(Calendar c) {
        return monthTitle(c.get(Calendar.YEAR), c.get(Calendar.MONTH));
    }

    /** Parse "250" / "250.50" rupees -> paisa (long). Null if invalid/<=0. */
    public static Long parsePaisa(String input) {
        if (input == null) return null;
        String s = input.trim();
        if (s.isEmpty()) return null;
        // allow Bangla digits too
        StringBuilder a = new StringBuilder();
        for (char c : s.toCharArray()) {
            int i = BD.indexOf(c);
            a.append(i >= 0 ? (char) ('0' + i) : c);
        }
        try {
            BigDecimal v = new BigDecimal(a.toString());
            long paisa = v.movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact();
            return paisa > 0 ? paisa : null;
        } catch (ArithmeticException | NumberFormatException e) {
            return null;
        }
    }
}
