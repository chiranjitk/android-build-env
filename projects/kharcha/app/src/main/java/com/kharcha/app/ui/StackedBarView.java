package com.kharcha.app.ui;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

import com.kharcha.app.model.Category;

/** Horizontal stacked bar - one segment per category (rounded ends via Path clip). */
public class StackedBarView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF full = new RectF();
    private final Path clip = new Path();
    private long[] totals = new long[6];

    public StackedBarView(Context c, AttributeSet a) {
        super(c, a);
    }

    public void setData(long[] categoryTotals) {
        this.totals = categoryTotals == null ? new long[6] : categoryTotals;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float h = Math.min(getHeight(), 56 * getResources().getDisplayMetrics().density);
        float top = (getHeight() - h) / 2f;
        float left = 0, right = getWidth();
        float r = h / 2f;
        full.set(left, top, right, top + h);

        long sum = 0;
        for (long t : totals) sum += t;

        clip.reset();
        clip.addRoundRect(full, r, r, Path.Direction.CW);
        int save = canvas.save();
        canvas.clipPath(clip);

        if (sum == 0) {
            paint.setColor(0xFFEFE7E0);
            canvas.drawRect(full, paint);
        } else {
            float x = left;
            for (int i = 0; i < totals.length; i++) {
                if (totals[i] <= 0) continue;
                float w = right * (totals[i] / (float) sum);
                paint.setColor(Category.values()[i].color);
                canvas.drawRect(x, top, x + w, top + h, paint);
                x += w;
            }
        }
        canvas.restoreToCount(save);
    }
}
