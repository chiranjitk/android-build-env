package com.takatrack.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.takatrack.app.databinding.ActivityMainBinding;
import com.takatrack.app.db.EntryDbHelper;
import com.takatrack.app.ui.EntryAdapter;
import com.takatrack.app.util.Money;

import java.util.Calendar;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding b;
    private EntryDbHelper db;
    private EntryAdapter adapter;
    private Calendar month;

    private final ActivityResultLauncher<Intent> addLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),
                    r -> reload());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        db = new EntryDbHelper(this);
        month = Calendar.getInstance();

        adapter = new EntryAdapter(db, ok -> reload());
        b.list.setLayoutManager(new LinearLayoutManager(this));
        b.list.setAdapter(adapter);

        b.btnPrev.setOnClickListener(v -> { month.add(Calendar.MONTH, -1); reload(); });
        b.btnNext.setOnClickListener(v -> { month.add(Calendar.MONTH, 1); reload(); });
        b.fab.setOnClickListener(v ->
                addLauncher.launch(new Intent(this, AddEntryActivity.class)));

        reload();
    }

    private void reload() {
        int y = month.get(Calendar.YEAR);
        int m = month.get(Calendar.MONTH);

        b.monthTitle.setText(monthTitle(y, m));

        long[] sums = db.monthSums(y, m);
        b.incomeText.setText(Money.rs(sums[0]));
        b.expenseText.setText(Money.rs(sums[1]));
        long balance = sums[0] - sums[1];
        b.balanceText.setText(Money.rs(balance));

        b.barChart.setData(db.expenseByCategory(y, m));

        java.util.List<com.takatrack.app.model.Entry> items = db.monthEntries(y, m);
        b.emptyView.setVisibility(items.isEmpty() ? View.VISIBLE : View.GONE);
        adapter.submit(items);
    }

    private static final String[] MONTHS = {"January", "February", "March", "April",
            "May", "June", "July", "August", "September", "October", "November", "December"};

    private static String monthTitle(int year, int month0) {
        return MONTHS[month0] + " " + year;
    }
}
