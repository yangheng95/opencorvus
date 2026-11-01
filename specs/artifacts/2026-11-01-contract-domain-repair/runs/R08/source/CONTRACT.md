Repair the calibrated temperature-monitoring report project. Deliver
deliverable.pyz, maintainable source and concise tested handoff; Python 3 standard library.
Invocation: python deliverable.pyz INPUT_DIRECTORY --output REPORT_JSON
UTF-8 CSV files sensors.csv(sensor,gain,offset_c,low_c,high_c) and
readings.csv(sequence,sensor,temperature,unit) have required named columns; reordered
columns, extra metadata, legal quoting/CRLF/LF are supported. All decimal fields are
finite base-10 decimals. sensor and sequence are exact nonempty text, including numeric-
looking IDs, Unicode, punctuation and whitespace; sequences are distinct. Every reading
has one matching sensor. gain is positive; low_c<=high_c, either bound may be negative.
unit is C, F or K. Convert the original temperature to Celsius first:
 C: value; F: (value-32)*5/9; K: value-273.15.
Signed C/F values are valid down to absolute zero (-273.15 C or -459.67 F); Kelvin
values must be >=0. Determine physical validity in the value's original unit, before
calibration. Calibration is calibrated_c=celsius*gain+offset_c. Apply the sensor's
Celsius thresholds to calibrated_c: below low_c=LOW, above high_c=HIGH, inclusive=OK.
For valid input exit0 and JSON {success:true,readings:[{sequence:TEXT,sensor:TEXT,
celsius:NUMBER,calibrated_c:NUMBER,status:LOW|OK|HIGH},...],counts:{LOW:N,OK:N,HIGH:N}}.
Preserve reading order. Numeric output tolerance is 1e-8 absolute error.
For the first reading below absolute zero exit2 and JSON {success:false,error:
{code:BELOW_ABSOLUTE_ZERO,sequence:EXACT_TEXT,sensor:EXACT_TEXT}}. This is an explicit
error contract, not a successful monitoring report. JSON booleans retain their type.
Use the original units and calibration stages correctly; one numeric-domain guard
cannot be copied between original values, converted values and calibrated thresholds.
The final zipapp must work from arbitrary cwd using only Python and supplied inputs.
