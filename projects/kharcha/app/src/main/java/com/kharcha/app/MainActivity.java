package com.kharcha.app;

import android.os.Bundle;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.kharcha.app.databinding.ActivityMainBinding;
import com.kharcha.app.db.ExpenseDbHelper;
import com.kharcha.app.model.Category;
import com.kharcha.app.ui.ExpenseAdapter;
import com.kharcha.app.ui.StackedBarView;
import com.kharcha.app.util.Fmt;

import java.util.Calendar;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding b;
    private ExpenseDbHelper db;
    private ExpenseAdapter adapter;
    private Calendar month;

    private final ActivityResultLauncher<android.content.Intent> addLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),
                    r -> reload());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        db = new ExpenseDbHelper(this);
        month = Calendar.getInstance();

        adapter = new ExpenseAdapter(db, ok -> reload());
        b.list.setLayoutManager(new LinearLayoutManager(this));
        b.list.setAdapter(adapter);

        b.btnPrev.setOnClickListener(v -> { month.add(Calendar.MONTH, -1); reload(); });
        b.btnNext.setOnClickListener(v -> { month.add(Calendar.MONTH, 1); reload(); });
        b.fab.setOnClickListener(v ->
                addLauncher.launch(new android.content.Intent(this, AddExpenseActivity.class)));

        reload();
    }

    private void reload() {
        int y = month.get(Calendar.YEAR);
        int m = month.get(Calendar.MONTH);

        b.monthTitle.setText(Fmt.monthTitle(month));
        long total = db.monthTotal(y, m);
        b.totalText.setText(Fmt.taka(total));

        long[] totals = db.categoryTotals(y, m);
        b.stackedBar.setData(totals);
        buildLegend(totals, total);

        java.util.List<com.kharcha.app.model.Expense> items = db.monthExpenses(y, m);
        boolean empty = items.isEmpty();
        b.emptyView.setVisibility(empty ? View.VISIBLE : View.GONE);
        b.listHeader.setVisibility(empty ? View.GONE : View.VISIBLE);
        adapter.submit(items);
    }

    private void buildLegend(long[] totals, long grand) {
        b.legend.removeAllViews();
        float density = getResources().getDisplayMetrics().density;
        Category[] cats = Category.values();
        for (int i = 0; i < cats.length; i++) {
            if (totals[i] <= 0) continue;

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(android.view.Gravity.CENTER_VERTICAL);
            row.setPadding(0, (int) (5 * density), 0, (int) (5 * density));

            View dot = new View(this);
            LinearLayout.LayoutParams dp = new LinearLayout.LayoutParams(
                    (int) (12 * density), (int) (12 * density));
            dp.rightMargin = (int) (8 * density);
            dot.setLayoutParams(dp);
            dot.setBackground(new android.graphics.drawable.ShapeDrawable(
                    new android.graphics.drawable.shapes.OvalShape()));
            dot.getBackground().setTint(cats[i].color);
            row.addView(dot);

            TextView label = new TextView(this);
            label.setText(cats[i].emoji + " " + cats[i].label);
            label.setTextSize(13);
            label.setTextColor(getColor(R.color.on_surface));
            row.addView(label, new LinearLayout.LayoutParams(0,
                    LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

            TextView value = new TextView(this);
            String pct = grand > 0 ? " (" + Fmt.bn(Math.round(totals[i] * 100.0 / grand)) + "%)" : "";
            value.setText(Fmt.taka(totals[i]) + pct);
            value.setTextSize(13);
            value.setTypeface(null, android.graphics.Typeface.BOLD);
            value.setTextColor(cats[i].color | 0xFF000000);
            row.addView(value, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));

            b.legend.addView(row);
        }
        if (grand == 0) {
            TextView none = new TextView(this);
            none.setText("—");
            none.setTextColor(getColor(R.color.on_surface_muted));
            none.setTextSize(13);
            b.legend.addView(none);
        }
    }
}
