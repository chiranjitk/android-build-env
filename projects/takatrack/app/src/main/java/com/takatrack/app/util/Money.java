package com.takatrack.app.util;

import java.math.BigDecimal;

/** ₹ formatting with Indian grouping. */
public final class Money {
    private Money() {}

    public static String rs(long paisa) {
        BigDecimal rupees = BigDecimal.valueOf(paisa, 2);
        String plain = rupees.toPlainString();
        boolean neg = plain.startsWith("-");
        if (neg) plain = plain.substring(1);
        String intPart = plain.substring(0, plain.indexOf('.'));
        String fracPart = plain.substring(plain.indexOf('.') + 1);
        String s = "₹" + group(intPart) + "." + fracPart;
        return neg ? "-" + s : s;
    }

    private static String group(String digits) {
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

    public static Long parsePaisa(String input) {
        if (input == null) return null;
        String s = input.trim();
        if (s.isEmpty()) return null;
        try {
            BigDecimal v = new BigDecimal(s);
            long paisa = v.movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact();
            return paisa > 0 ? paisa : null;
        } catch (ArithmeticException | NumberFormatException e) {
            return null;
        }
    }
}
