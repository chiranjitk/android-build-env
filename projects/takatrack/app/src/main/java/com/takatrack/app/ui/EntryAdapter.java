package com.takatrack.app.ui;

import android.graphics.Typeface;
import android.view.LayoutInflater;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.takatrack.app.R;
import com.takatrack.app.databinding.ItemEntryBinding;
import com.takatrack.app.db.EntryDbHelper;
import com.takatrack.app.model.Category;
import com.takatrack.app.model.Entry;
import com.takatrack.app.util.Money;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;

public class EntryAdapter extends RecyclerView.Adapter<EntryAdapter.VH> {

    private final List<Entry> items = new ArrayList<>();
    private final EntryDbHelper db;
    private final Consumer<Boolean> onDataChanged;
    private final SimpleDateFormat dayFmt =
            new SimpleDateFormat("dd MMM, HH:mm", Locale.getDefault());

    public EntryAdapter(EntryDbHelper db, Consumer<Boolean> onDataChanged) {
        this.db = db;
        this.onDataChanged = onDataChanged;
    }

    public void submit(List<Entry> list) {
        items.clear();
        if (list != null) items.addAll(list);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemEntryBinding b = ItemEntryBinding.inflate(
                LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(b);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int pos) {
        Entry e = items.get(pos);
        boolean income = e.type == 1;
        Category c = Category.byId(e.categoryId);

        h.b.emoji.setText(income ? "💰" : c.emoji);
        h.b.emoji.getBackground().setTint(income ? 0xFF2E7D32 : c.color);
        h.b.label.setText(income
                ? h.b.getRoot().getContext().getString(R.string.income)
                : c.label);
        h.b.note.setText(e.note);
        h.b.note.setVisibility(e.note.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        h.b.date.setText(dayFmt.format(new Date(e.createdAt)));

        h.b.amount.setText((income ? "+" : "-") + Money.rs(e.paisa));
        int color = ContextCompat.getColor(h.b.getRoot().getContext(),
                income ? R.color.income_green : R.color.expense_red);
        h.b.amount.setTextColor(color);
        h.b.amount.setTypeface(null, Typeface.BOLD);

        h.b.getRoot().setOnLongClickListener(v -> {
            new AlertDialog.Builder(v.getContext())
                    .setTitle(R.string.delete_title)
                    .setMessage((income ? "+" : "-") + Money.rs(e.paisa))
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
        final ItemEntryBinding b;
        VH(ItemEntryBinding b) { super(b.getRoot()); this.b = b; }
    }
}
