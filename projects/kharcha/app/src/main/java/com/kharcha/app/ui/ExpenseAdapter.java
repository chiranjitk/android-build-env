package com.kharcha.app.ui;

import android.view.LayoutInflater;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.recyclerview.widget.RecyclerView;

import com.kharcha.app.R;
import com.kharcha.app.databinding.ItemExpenseBinding;
import com.kharcha.app.db.ExpenseDbHelper;
import com.kharcha.app.model.Category;
import com.kharcha.app.model.Expense;
import com.kharcha.app.util.Fmt;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class ExpenseAdapter extends RecyclerView.Adapter<ExpenseAdapter.VH> {

    private final List<Expense> items = new ArrayList<>();
    private final ExpenseDbHelper db;
    private final Consumer<Boolean> onDataChanged; // host reloads data after delete

    public ExpenseAdapter(ExpenseDbHelper db, Consumer<Boolean> onDataChanged) {
        this.db = db;
        this.onDataChanged = onDataChanged;
    }

    public void submit(List<Expense> list) {
        items.clear();
        if (list != null) items.addAll(list);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemExpenseBinding b = ItemExpenseBinding.inflate(
                LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(b);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int pos) {
        Expense e = items.get(pos);
        Category c = Category.byId(e.categoryId);
        h.b.emoji.setText(c.emoji);
        h.b.emoji.getBackground().setTint(c.color);
        h.b.label.setText(c.label);
        h.b.note.setText(e.note);
        h.b.note.setVisibility(e.note.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        h.b.amount.setText(Fmt.taka(e.paisa));
        h.b.amount.setTextColor(c.color | 0xFF000000);

        h.b.getRoot().setOnLongClickListener(v -> {
            new AlertDialog.Builder(v.getContext())
                    .setTitle(R.string.delete_title)
                    .setMessage(Fmt.taka(e.paisa) + " - " + c.label)
                    .setPositiveButton(R.string.delete_yes, (d, w) -> {
                        db.delete(e.id);
                        onDataChanged.accept(true);
                    })
                    .setNegativeButton(R.string.delete_no, null)
                    .show();
            return true;
        });
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        final ItemExpenseBinding b;
        VH(ItemExpenseBinding b) { super(b.getRoot()); this.b = b; }
    }
}
