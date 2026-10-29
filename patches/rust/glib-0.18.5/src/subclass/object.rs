// Take a look at the license at the top of the repository in the LICENSE file.

// rustdoc-stripper-ignore-next
//! Module that contains all types needed for creating a direct subclass of `GObject`
//! or implementing virtual methods of it.

use std::{mem, ptr};

use super::{prelude::*, Signal};
use crate::{prelude::*, translate::*, Cast, Object, ParamSpec, Slice, Value};

// rustdoc-stripper-ignore-next
/// Trait for implementors of `glib::Object` subclasses.
///
/// This allows overriding the virtual methods of `glib::Object`. Except for
/// `finalize` as implementing `Drop` would allow the same behavior.
pub trait ObjectImpl: ObjectSubclass + ObjectImplExt {
    // rustdoc-stripper-ignore-next
    /// Properties installed for this type.
    fn properties() -> &'static [ParamSpec] {
        &[]
    }

    // rustdoc-stripper-ignore-next
    /// Signals installed for this type.
    fn signals() -> &'static [Signal] {
        &[]
    }

    // rustdoc-stripper-ignore-next
    /// Property setter.
    ///
    /// This is called whenever the property of this specific subclass with the
    /// given index is set. The new value is passed as `glib::Value`.
    ///
    /// `value` is guaranteed to be of the correct type for the given property.
    fn set_property(&self, _id: usize, _value: &Value, _pspec: &ParamSpec) {
        unimplemented!()
    }

    // rustdoc-stripper-ignore-next
    /// Property getter.
    ///
    /// This is called whenever the property value of the specific subclass with the
    /// given index should be returned.
    ///
    /// The returned `Value` must be of the correct type for the given property.
    #[doc(alias = "get_property")]
    fn property(&self, _id: usize, _pspec: &ParamSpec) -> Value {
        unimplemented!()
    }

    // rustdoc-stripper-ignore-next
    /// Constructed.
    ///
    /// This is called once construction of the instance is finished.
    ///
    /// Should chain up to the parent class' implementation.
    fn constructed(&self) {
        self.parent_constructed();
    }

    // rustdoc-stripper-ignore-next
    /// Disposes of the object.
    ///
    /// When `dispose()` ends, the object should not hold any reference to any other member object.
    /// The object is also expected to be able to answer client method invocations (with possibly an
    /// error code but no memory violation) until it is dropped. `dispose()` can be executed more
    /// than once.
    fn dispose(&self) {}

    // rustdoc-stripper-ignore-next
    /// Function to be called when property change is notified for with
    /// `self.notify("property")`.
    fn notify(&self, pspec: &ParamSpec) {
        self.parent_notify(pspec)
    }

    fn dispatch_properties_changed(&self, pspecs: &[ParamSpec]) {
        self.parent_dispatch_properties_changed(pspecs)
    }
}

#[doc(alias = "get_property")]
unsafe extern "C" fn property<T: ObjectImpl>(
    obj: *mut gobject_ffi::GObject,
    id: u32,
    value: *mut gobject_ffi::GValue,
    pspec: *mut gobject_ffi::GParamSpec,
) {
    let instance = &*(obj as *mut T::Instance);
    let imp = instance.imp();

    let v = imp.property(id as usize, &from_glib_borrow(pspec));

    // We first unset the value we get passed in, in case it contained
    // any previous data. Then we directly overwrite it with our new
    // value, and pass ownership of the contained data to the C GValue
    // by forgetting it on the Rust side.
    //
    // Without this, by using the GValue API, we would have to create
    // a copy of the value when setting it on the destination just to
    // immediately free the original value afterwards.
    gobject_ffi::g_value_unset(value);
    let v = mem::ManuallyDrop::new(v);
    ptr::write(value, ptr::read(v.to_glib_none().0));
}

unsafe extern "C" fn set_property<T: ObjectImpl>(
    obj: *mut gobject_ffi::GObject,
    id: u32,
    value: *mut gobject_ffi::GValue,
    pspec: *mut gobject_ffi::GParamSpec,
) {
    let instance = &*(obj as *mut T::Instance);
    let imp = instance.imp();
    imp.set_property(
        id as usize,
        &*(value as *mut Value),
        &from_glib_borrow(pspec),
    );
}

unsafe extern "C" fn constructed<T: ObjectImpl>(obj: *mut gobject_ffi::GObject) {
    let instance = &*(obj as *mut T::Instance);
    let imp = instance.imp();

    imp.constructed();
}

unsafe extern "C" fn notify<T: ObjectImpl>(
    obj: *mut gobject_ffi::GObject,
    pspec: *mut gobject_ffi::GParamSpec,
) {
    let instance = &*(obj as *mut T::Instance);
    let imp = instance.imp();
    imp.notify(&from_glib_borrow(pspec));
}

unsafe extern "C" fn dispatch_properties_changed<T: ObjectImpl>(
    obj: *mut gobject_ffi::GObject,
    n_pspecs: u32,
    pspecs: *mut *mut gobject_ffi::GParamSpec,
) {
    let instance = &*(obj as *mut T::Instance);
    let imp = instance.imp();
    imp.dispatch_properties_changed(Slice::from_glib_borrow_num(pspecs, n_pspecs as _));
}

unsafe extern "C" fn dispose<T: ObjectImpl>(obj: *mut gobject_ffi::GObject) {
    let instance = &*(obj as *mut T::Instance);
    let imp = instance.imp();

    imp.dispose();

    // Chain up to the parent's dispose.
    let data = T::type_data();
    let parent_class = data.as_ref().parent_class() as *mut gobject_ffi::GObjectClass;
    if let Some(ref func) = (*parent_class).dispose {
        func(obj);
    }
}

// rustdoc-stripper-ignore-next
/// Trait containing only the property related functions of `ObjectImpl`.
/// Implemented by the `Props` macro.
/// When implementing `ObjectImpl` you may want to delegate the function calls to this trait.
pub trait DerivedObjectProperties: ObjectSubclass {
    // rustdoc-stripper-ignore-next
    /// Properties installed for this type.
    fn derived_properties() -> &'static [ParamSpec] {
        &[]
    }

    // rustdoc-stripper-ignore-next
    /// Similar to [`ObjectImpl`](trait.ObjectImpl.html) but auto-generated by the [`Properties`] macro
    /// to allow handling more complex use-cases.
    fn derived_set_property(&self, _id: usize, _value: &Value, _pspec: &ParamSpec) {
        unimplemented!()
    }

    // rustdoc-stripper-ignore-next
    /// Similar to [`ObjectImpl`](trait.ObjectImpl.html) but auto-generated by the [`Properties`] macro
    /// to allow handling more complex use-cases.
    fn derived_property(&self, _id: usize, _pspec: &ParamSpec) -> Value {
        unimplemented!()
    }
}

// rustdoc-stripper-ignore-next
/// Extension trait for `glib::Object`'s class struct.
///
/// This contains various class methods and allows subclasses to override signal class handlers.
pub unsafe trait ObjectClassSubclassExt: Sized + 'static {
    fn override_signal_class_handler<F>(&mut self, name: &str, class_handler: F)
    where
        F: Fn(&super::SignalClassHandlerToken, &[Value]) -> Option<Value> + Send + Sync + 'static,
    {
        unsafe {
            super::types::signal_override_class_handler(
                name,
                *(self as *mut _ as *mut ffi::GType),
                class_handler,
            );
        }
    }
}

unsafe impl ObjectClassSubclassExt for crate::Class<Object> {}

unsafe impl<T: ObjectImpl> IsSubclassable<T> for Object {
    fn class_init(class: &mut crate::Class<Self>) {
        let klass = class.as_mut();
        klass.set_property = Some(set_property::<T>);
        klass.get_property = Some(property::<T>);
        klass.constructed = Some(constructed::<T>);
        klass.notify = Some(notify::<T>);
        klass.dispatch_properties_changed = Some(dispatch_properties_changed::<T>);
        klass.dispose = Some(dispose::<T>);

        let pspecs = <T as ObjectImpl>::properties();
        if !pspecs.is_empty() {
            unsafe {
                let mut pspecs_ptrs = Vec::with_capacity(pspecs.len() + 1);

                pspecs_ptrs.push(ptr::null_mut());

                for pspec in pspecs {
                    pspecs_ptrs.push(pspec.to_glib_none().0);
                }

                gobject_ffi::g_object_class_install_properties(
                    klass,
                    pspecs_ptrs.len() as u32,
                    pspecs_ptrs.as_mut_ptr(),
                );
            }
        }

        let type_ = T::type_();
        let signals = <T as ObjectImpl>::signals();
        for signal in signals {
            signal.register(type_);
        }
    }

    #[inline]
    fn instance_init(_instance: &mut super::InitializingObject<T>) {}
}

mod sealed {
    pub trait Sealed {}
    impl<T: super::ObjectImplExt> Sealed for T {}
}

pub trait ObjectImplExt: sealed::Sealed + ObjectSubclass {
    // rustdoc-stripper-ignore-next
    /// Chain up to the parent class' implementation of `glib::Object::constructed()`.
    #[inline]
    fn parent_constructed(&self) {
        unsafe {
            let data = Self::type_data();
            let parent_class = data.as_ref().parent_class() as *mut gobject_ffi::GObjectClass;

            if let Some(ref func) = (*parent_class).constructed {
                func(self.obj().unsafe_cast_ref::<Object>().to_glib_none().0);
            }
        }
    }

    // rustdoc-stripper-ignore-next
    /// Chain up to the parent class' implementation of `glib::Object::notify()`.
    #[inline]
    fn parent_notify(&self, pspec: &ParamSpec) {
        unsafe {
            let data = Self::type_data();
            let parent_class = data.as_ref().parent_class() as *mut gobject_ffi::GObjectClass;

            if let Some(ref func) = (*parent_class).notify {
                func(
                    self.obj().unsafe_cast_ref::<Object>().to_glib_none().0,
                    pspec.to_glib_none().0,
                );
            }
        }
    }

    // rustdoc-stripper-ignore-next
    /// Chain up to the parent class' implementation of `glib::Object::dispatch_properties_changed()`.
    #[inline]
    fn parent_dispatch_properties_changed(&self, pspecs: &[ParamSpec]) {
        unsafe {
            let data = Self::type_data();
            let parent_class = data.as_ref().parent_class() as *mut gobject_ffi::GObjectClass;

            if let Some(ref func) = (*parent_class).dispatch_properties_changed {
                func(
                    self.obj().unsafe_cast_ref::<Object>().to_glib_none().0,
                    pspecs.len() as _,
                    pspecs.as_ptr() as *mut _,
                );
            }
        }
    }

    // rustdoc-stripper-ignore-next
    /// Chain up to parent class signal handler.
    fn signal_chain_from_overridden(
        &self,
        token: &super::SignalClassHandlerToken,
        values: &[Value],
    ) -> Option<Value> {
        unsafe {
            super::types::signal_chain_from_overridden(self.obj().as_ptr() as *mut _, token, values)
        }
    }
}

impl<T: ObjectImpl> ObjectImplExt for T {}
