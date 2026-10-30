package com.kharcha.app;

import android.os.Bundle;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.ViewCompat;

import com.google.android.material.chip.Chip;
import com.kharcha.app.databinding.ActivityAddExpenseBinding;
import com.kharcha.app.db.ExpenseDbHelper;
import com.kharcha.app.model.Category;
import com.kharcha.app.util.Fmt;

public class AddExpenseActivity extends AppCompatActivity {

    private ActivityAddExpenseBinding b;
    private ExpenseDbHelper db;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityAddExpenseBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());
        db = new ExpenseDbHelper(this);

        for (Category c : Category.values()) {
            Chip chip = new Chip(this);
            chip.setText(c.emoji + " " + c.label);
            chip.setCheckable(true);
            chip.setTag(c);
            chip.setId(ViewCompat.generateViewId());
            b.categoryChips.addView(chip);
        }
        ((Chip) b.categoryChips.getChildAt(0)).setChecked(true);

        b.btnBack.setOnClickListener(v -> finish());
        b.btnSave.setOnClickListener(v -> save());
    }

    private void save() {
        Long paisa = Fmt.parsePaisa(b.amountInput.getText().toString());
        if (paisa == null) {
            b.amountInput.setError(getString(R.string.err_amount));
            return;
        }
        Chip sel = b.categoryChips.findViewById(b.categoryChips.getCheckedChipId());
        if (sel == null) {
            Toast.makeText(this, R.string.err_category, Toast.LENGTH_SHORT).show();
            return;
        }
        Category c = (Category) sel.getTag();
        db.insert(c.id, paisa, b.noteInput.getText().toString().trim(),
                System.currentTimeMillis());
        Toast.makeText(this, R.string.saved, Toast.LENGTH_SHORT).show();
        finish();
    }
}
