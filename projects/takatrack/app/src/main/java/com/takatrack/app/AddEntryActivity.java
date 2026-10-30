package com.takatrack.app;

import android.os.Bundle;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.ViewCompat;

import com.google.android.material.chip.Chip;
import com.takatrack.app.databinding.ActivityAddEntryBinding;
import com.takatrack.app.db.EntryDbHelper;
import com.takatrack.app.model.Category;
import com.takatrack.app.util.Money;

public class AddEntryActivity extends AppCompatActivity {

    private ActivityAddEntryBinding b;
    private EntryDbHelper db;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityAddEntryBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());
        db = new EntryDbHelper(this);

        for (Category c : Category.values()) {
            Chip chip = new Chip(this);
            chip.setText(c.emoji + " " + c.label);
            chip.setCheckable(true);
            chip.setTag(c);
            chip.setId(ViewCompat.generateViewId());
            b.categoryChips.addView(chip);
        }
        ((Chip) b.categoryChips.getChildAt(0)).setChecked(true);
        b.typeToggle.check(R.id.btnTypeExpense);

        b.btnTypeIncome.setOnClickListener(v -> {
            b.categoryHeader.setVisibility(android.view.View.GONE);
            b.categoryChips.setVisibility(android.view.View.GONE);
        });
        b.btnTypeExpense.setOnClickListener(v -> {
            b.categoryHeader.setVisibility(android.view.View.VISIBLE);
            b.categoryChips.setVisibility(android.view.View.VISIBLE);
        });

        b.btnBack.setOnClickListener(v -> finish());
        b.btnSave.setOnClickListener(v -> save());
    }

    private void save() {
        Long paisa = Money.parsePaisa(b.amountInput.getText().toString());
        if (paisa == null) {
            b.amountInput.setError(getString(R.string.err_amount));
            return;
        }
        boolean income = b.typeToggle.getCheckedButtonId() == R.id.btnTypeIncome;

        int categoryId = 6; // OTHER default for income
        if (!income) {
            Chip sel = b.categoryChips.findViewById(b.categoryChips.getCheckedChipId());
            if (sel == null) {
                Toast.makeText(this, R.string.err_amount, Toast.LENGTH_SHORT).show();
                return;
            }
            categoryId = ((Category) sel.getTag()).id;
        }

        db.insert(income ? 1 : 0, categoryId, paisa,
                b.noteInput.getText().toString().trim(), System.currentTimeMillis());
        Toast.makeText(this, R.string.saved, Toast.LENGTH_SHORT).show();
        finish();
    }
}
