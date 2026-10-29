// Take a look at the license at the top of the repository in the LICENSE file.

// rustdoc-stripper-ignore-next
//! Module for registering shared types for Rust types.

use crate::{prelude::*, translate::*};

pub unsafe trait RefCounted: Clone + Sized + 'static {
    // rustdoc-stripper-ignore-next
    /// The inner type
    type InnerType;

    // rustdoc-stripper-ignore-next
    /// The function used to increment the inner type refcount
    unsafe fn ref_(this: *const Self::InnerType) -> *const Self::InnerType;

    // rustdoc-stripper-ignore-next
    /// Provides access to a raw pointer to InnerType
    fn as_ptr(&self) -> *const Self::InnerType;

    // rustdoc-stripper-ignore-next
    /// Converts the RefCounted object to a raw pointer to InnerType
    unsafe fn into_raw(self) -> *const Self::InnerType;

    // rustdoc-stripper-ignore-next
    /// Converts a raw pointer to InnerType to a RefCounted object
    unsafe fn from_raw(this: *const Self::InnerType) -> Self;
}

unsafe impl<T> RefCounted for std::sync::Arc<T>
where
    T: 'static,
{
    type InnerType = T;

    #[inline]
    unsafe fn ref_(this: *const Self::InnerType) -> *const Self::InnerType {
        std::sync::Arc::increment_strong_count(this);
        this
    }

    #[inline]
    fn as_ptr(&self) -> *const Self::InnerType {
        std::sync::Arc::as_ptr(self)
    }

    #[inline]
    unsafe fn into_raw(self) -> *const Self::InnerType {
        std::sync::Arc::into_raw(self)
    }

    #[inline]
    unsafe fn from_raw(this: *const Self::InnerType) -> Self {
        std::sync::Arc::from_raw(this)
    }
}

unsafe impl<T> RefCounted for std::rc::Rc<T>
where
    T: 'static,
{
    type InnerType = T;

    #[inline]
    unsafe fn ref_(this: *const Self::InnerType) -> *const Self::InnerType {
        use std::mem::ManuallyDrop;
        let this_rc = ManuallyDrop::new(std::rc::Rc::from_raw(this));
        std::rc::Rc::into_raw(ManuallyDrop::take(&mut this_rc.clone()))
    }

    #[inline]
    fn as_ptr(&self) -> *const Self::InnerType {
        std::rc::Rc::as_ptr(self)
    }

    #[inline]
    unsafe fn into_raw(self) -> *const Self::InnerType {
        std::rc::Rc::into_raw(self)
    }

    #[inline]
    unsafe fn from_raw(this: *const Self::InnerType) -> Self {
        std::rc::Rc::from_raw(this)
    }
}

// rustdoc-stripper-ignore-next
/// Trait for defining shared types.
///
/// Links together the type name with the type itself.
///
/// See [`register_shared_type`] for registering an implementation of this trait
/// with the type system.
///
/// [`register_shared_type`]: fn.register_shared_type.html
pub trait SharedType: StaticType + Clone + Sized + 'static {
    // rustdoc-stripper-ignore-next
    /// Shared type name.
    ///
    /// This must be unique in the whole process.
    const NAME: &'static str;

    // rustdoc-stripper-ignore-next
    /// The inner refcounted type
    type RefCountedType: RefCounted;

    // rustdoc-stripper-ignore-next
    /// Converts the SharedType into its inner RefCountedType
    fn into_refcounted(self) -> Self::RefCountedType;

    // rustdoc-stripper-ignore-next
    /// Constructs a SharedType from a RefCountedType
    fn from_refcounted(this: Self::RefCountedType) -> Self;
}

// rustdoc-stripper-ignore-next
/// Register a boxed `glib::Type` ID for `T`.
///
/// This must be called only once and will panic on a second call.
///
/// See [`Shared!`] for defining a function that ensures that
/// this is only called once and returns the type id.
///
/// [`Shared!`]: ../../derive.Shared.html
pub fn register_shared_type<T: SharedType>() -> crate::Type {
    unsafe {
        use std::ffi::CString;
        unsafe extern "C" fn shared_ref<T: SharedType>(v: ffi::gpointer) -> ffi::gpointer {
            T::RefCountedType::ref_(v as *const <T::RefCountedType as RefCounted>::InnerType)
                as ffi::gpointer
        }
        unsafe extern "C" fn shared_unref<T: SharedType>(v: ffi::gpointer) {
            let _ = T::RefCountedType::from_raw(
                v as *const <T::RefCountedType as RefCounted>::InnerType,
            );
        }

        let type_name = CString::new(T::NAME).unwrap();
        assert_eq!(
            gobject_ffi::g_type_from_name(type_name.as_ptr()),
            gobject_ffi::G_TYPE_INVALID,
            "Type {} has already been registered",
            type_name.to_str().unwrap()
        );

        let type_ = crate::Type::from_glib(gobject_ffi::g_boxed_type_register_static(
            type_name.as_ptr(),
            Some(shared_ref::<T>),
            Some(shared_unref::<T>),
        ));
        assert!(type_.is_valid());

        type_
    }
}
