Repair the demand-forecast/replenishment prototype; release deliverable.pyz,
maintainable source, and a concise handoff with actual validation results.
Python 3 standard library only. Invocation from any working directory:
  python deliverable.pyz INPUT_DIRECTORY --output OUTPUT_JSON
INPUT_DIRECTORY contains train.csv, validation.csv, future.csv, inventory.csv (UTF-8 CSV).
train/validation: date,item,is_open,demand; future: date,item,is_open;
inventory: item,stock,buffer. Dates are ISO dates; is_open is 0 or 1;
demand/stock/buffer are nonnegative integers. Item names are exact nonempty Unicode text.
Required named columns may be reordered; extra metadata columns, legal CSV quoting
and CRLF/LF are supported. Future/validation items all have training and inventory.
Each item has all seven weekdays in training and at least one open observation;
dates are unique per item in each split. Compare all three supplied strategies:
  weekday: mean training demand for the item's weekday, including closed observations;
  open: mean demand over the item's open training observations if is_open=1, else zero;
  last: demand on that item's latest training date, independent of is_open.
Apply training-only predictors to the separate validation rows. Choose globally lowest
mean squared error (MSE), equally weighted across validation rows; exact ties choose
the lexicographically first strategy name. Never train on validation/future labels.
The released forecast must execute the selected strategy, replacing stale release metadata.
For each future row, order=max(0,forecast+buffer-stock); rows are independent planning
scenarios, with no inventory carry. Include every future row, sorted by date then item.
Write JSON {selected:STRATEGY,validation_mse:{last:NUMBER,open:NUMBER,weekday:NUMBER},
plan:[{date:DATE,item:EXACT_TEXT,forecast:NUMBER,order:NUMBER},...]}.
Numbers may be integer/float with 1e-8 absolute error. Validation losses, selection and
actual released predictions/quantities must agree. Existing prototype/scores/config
are development material, not acceptance evidence.
