// Take a look at the license at the top of the repository in the LICENSE file.

// This is similar to the GVariantIter provided by glib, but that would
// introduce a heap allocation and doesn't provide a way to determine how
// many items are left in the iterator.

use std::iter::{DoubleEndedIterator, ExactSizeIterator, FusedIterator};

use crate::{translate::*, Variant};

// rustdoc-stripper-ignore-next
/// Iterator over items in a variant.
#[derive(Debug)]
pub struct VariantIter {
    variant: Variant,
    head: usize,
    tail: usize,
}

impl VariantIter {
    pub(crate) fn new(variant: Variant) -> Self {
        let tail = variant.n_children();
        Self {
            variant,
            head: 0,
            tail,
        }
    }
}

impl Iterator for VariantIter {
    type Item = Variant;

    fn next(&mut self) -> Option<Variant> {
        if self.head == self.tail {
            None
        } else {
            let value = self.variant.child_value(self.head);
            self.head += 1;
            Some(value)
        }
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let size = self.tail - self.head;
        (size, Some(size))
    }

    fn count(self) -> usize {
        self.tail - self.head
    }

    fn nth(&mut self, n: usize) -> Option<Variant> {
        let (end, overflow) = self.head.overflowing_add(n);
        if end >= self.tail || overflow {
            self.head = self.tail;
            None
        } else {
            self.head = end + 1;
            Some(self.variant.child_value(end))
        }
    }

    fn last(self) -> Option<Variant> {
        if self.head == self.tail {
            None
        } else {
            Some(self.variant.child_value(self.tail - 1))
        }
    }
}

impl DoubleEndedIterator for VariantIter {
    fn next_back(&mut self) -> Option<Variant> {
        if self.head == self.tail {
            None
        } else {
            self.tail -= 1;
            Some(self.variant.child_value(self.tail))
        }
    }

    fn nth_back(&mut self, n: usize) -> Option<Variant> {
        let (end, overflow) = self.tail.overflowing_sub(n);
        if end <= self.head || overflow {
            self.head = self.tail;
            None
        } else {
            self.tail = end - 1;
            Some(self.variant.child_value(end - 1))
        }
    }
}

impl ExactSizeIterator for VariantIter {}

impl FusedIterator for VariantIter {}

// rustdoc-stripper-ignore-next
/// Iterator over items in a variant of type `as`.
#[derive(Debug)]
pub struct VariantStrIter<'a> {
    variant: &'a Variant,
    head: usize,
    tail: usize,
}

impl<'a> VariantStrIter<'a> {
    pub(crate) fn new(variant: &'a Variant) -> Self {
        let tail = variant.n_children();
        Self {
            variant,
            head: 0,
            tail,
        }
    }

    fn impl_get(&self, i: usize) -> &'a str {
        unsafe {
            let mut p: *mut libc::c_char = std::ptr::null_mut();
            let s = b"&s\0";
            ffi::g_variant_get_child(
                self.variant.to_glib_none().0,
                i,
                s as *const u8 as *const _,
                &mut p,
                std::ptr::null::<i8>(),
            );
            let p = std::ffi::CStr::from_ptr(p);
            p.to_str().unwrap()
        }
    }
}

impl<'a> Iterator for VariantStrIter<'a> {
    type Item = &'a str;

    fn next(&mut self) -> Option<&'a str> {
        if self.head == self.tail {
            None
        } else {
            let v = self.impl_get(self.head);
            self.head += 1;
            Some(v)
        }
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let size = self.tail - self.head;
        (size, Some(size))
    }

    fn count(self) -> usize {
        self.tail - self.head
    }

    fn nth(&mut self, n: usize) -> Option<&'a str> {
        let (end, overflow) = self.head.overflowing_add(n);
        if end >= self.tail || overflow {
            self.head = self.tail;
            None
        } else {
            self.head = end + 1;
            Some(self.impl_get(end))
        }
    }

    fn last(self) -> Option<&'a str> {
        if self.head == self.tail {
            None
        } else {
            Some(self.impl_get(self.tail - 1))
        }
    }
}

impl<'a> DoubleEndedIterator for VariantStrIter<'a> {
    fn next_back(&mut self) -> Option<&'a str> {
        if self.head == self.tail {
            None
        } else {
            self.tail -= 1;
            Some(self.impl_get(self.tail))
        }
    }

    fn nth_back(&mut self, n: usize) -> Option<&'a str> {
        let (end, overflow) = self.tail.overflowing_sub(n);
        if end <= self.head || overflow {
            self.head = self.tail;
            None
        } else {
            self.tail = end - 1;
            Some(self.impl_get(end - 1))
        }
    }
}

impl<'a> ExactSizeIterator for VariantStrIter<'a> {}

impl<'a> FusedIterator for VariantStrIter<'a> {}
