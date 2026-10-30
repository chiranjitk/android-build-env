package com.takatrack.app.ui;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

import com.takatrack.app.model.Category;

/** Vertical bars - one per expense category. */
public class BarChartView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint labelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private long[] totals = new long[6];
    private long max = 1;

    public BarChartView(Context c, AttributeSet a) {
        super(c, a);
        labelPaint.setTextAlign(Paint.Align.CENTER);
        labelPaint.setColor(0xFF6E6E6E);
    }

    public void setData(long[] byCategory) {
        this.totals = byCategory == null ? new long[6] : byCategory;
        max = 1;
        for (long t : totals) max = Math.max(max, t);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float dp = getResources().getDisplayMetrics().density;
        float w = getWidth(), h = getHeight();
        float labelH = 20 * dp;
        float chartH = h - labelH;
        int n = totals.length;
        float slot = w / n;
        float barW = Math.min(32 * dp, slot * 0.55f);

        labelPaint.setTextSize(11 * dp);
        float r = 6 * dp;

        for (int i = 0; i < n; i++) {
            float cx = slot * i + slot / 2f;
            // baseline
            paint.setColor(0xFFE0EDE8);
            canvas.drawRect(cx - barW / 2, chartH - 2 * dp, cx + barW / 2, chartH, paint);

            if (totals[i] > 0) {
                float bh = (chartH - 6 * dp) * (totals[i] / (float) max);
                RectF bar = new RectF(cx - barW / 2, chartH - bh, cx + barW / 2, chartH);
                paint.setColor(Category.values()[i].color);
                canvas.drawRoundRect(bar, r, r, paint);
            }
            canvas.drawText(Category.values()[i].emoji, cx, h - 6 * dp, labelPaint);
        }
    }
}
