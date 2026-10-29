// Take a look at the license at the top of the repository in the LICENSE file.

use crate::translate::*;

// rustdoc-stripper-ignore-next
/// A `CollationKey` allows ordering strings using the linguistically correct rules for the current locale.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct CollationKey(String);

impl<T: AsRef<str>> From<T> for CollationKey {
    // rustdoc-stripper-ignore-next
    /// Converts a string into a `CollationKey` that can be compared with other
    /// collation keys produced by the same function using `std::cmp::Ordering::cmp()`.
    #[doc(alias = "g_utf8_collate_key")]
    fn from(s: T) -> Self {
        let key =
            unsafe { from_glib_full(ffi::g_utf8_collate_key(s.as_ref().to_glib_none().0, -1)) };
        Self(key)
    }
}

// rustdoc-stripper-ignore-next
/// A `FilenameCollationKey` allows ordering file names using the linguistically correct rules for the current locale.
/// Compared to `CollationKey`, filename collation keys take into consideration dots and other characters
/// commonly found in file names.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct FilenameCollationKey(String);

impl<T: AsRef<str>> From<T> for FilenameCollationKey {
    // rustdoc-stripper-ignore-next
    /// Converts a string into a `FilenameCollationKey` that can be compared with other
    /// collation keys produced by the same function using `std::cmp::Ordering::cmp()`.
    #[doc(alias = "g_utf8_collate_key_for_filename")]
    fn from(s: T) -> Self {
        let key = unsafe {
            from_glib_full(ffi::g_utf8_collate_key_for_filename(
                s.as_ref().to_glib_none().0,
                -1,
            ))
        };
        Self(key)
    }
}
